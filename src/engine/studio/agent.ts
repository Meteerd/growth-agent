import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import sharp from "sharp";
import { z } from "zod";
import { liveClaudeTransport, MODEL, outputSchema, type StreamParams } from "../agent/claude";
import type { Db } from "../db/client";
import { callProvider } from "../providers/call";
import { claudeCost, claudeEstimate } from "../providers/prices";
import { listBrands, patchDossier, spentByProvider } from "../repo";
import { urlToFile } from "../video/files";
import { getConfig, getSettings, mustBrand, setConfig, setSettings } from "./config";
import { CAROUSELS, FORMATS } from "./formats";
import { IMAGE_MODEL_INFO } from "./images";
import { cancelJob, startJob } from "./jobs";
import { appendMessage, getAd, getJob, kvGet, listAds, listJobs, listMessages, listRefs, updateAd } from "./store";
import { ASPECTS, Competitor, IMAGE_MODELS, type Playbook, Testimonial } from "./types";

/**
 * The studio's chat agent: the operator talks, Claude configures brands and runs the pipeline through tools.
 * Long work (setup, scans, generation) runs as background jobs; the agent starts them and reports job ids.
 * The conversation is stored append-only (full content blocks, thinking included) per thread.
 */

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

// ---------------------------------------------------------------- tools

interface ToolDef<S extends z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run: (db: Db, input: z.infer<S>) => Promise<unknown>;
}
const tool = <S extends z.ZodType>(t: ToolDef<S>) => t as unknown as ToolDef<z.ZodType>;

const brandArg = z.string().describe("brand slug or name, e.g. 'hound' or 'aclinic'");

const short = (s: string | undefined, n = 160) => (s && s.length > n ? `${s.slice(0, n)}...` : (s ?? ""));

const TOOLS: ToolDef<z.ZodType>[] = [
  tool({
    name: "list_brands",
    description: "List the brands in the studio with their ad counts.",
    schema: z.object({}),
    run: async (db) => {
      const brands = await listBrands(db);
      return Promise.all(
        brands.map(async (b) => {
          const ads = await listAds(db, { brandId: b.id });
          return {
            slug: b.slug,
            name: b.name,
            url: b.url,
            countries: b.countries,
            ads: ads.length,
            approved: ads.filter((a) => a.status === "approved").length,
          };
        }),
      );
    },
  }),
  tool({
    name: "get_brand",
    description:
      "Everything about one brand: dossier, studio config (competitors, kit, notes), playbook summary, counts.",
    schema: z.object({ brand: brandArg }),
    run: async (db, i) => {
      const b = await mustBrand(db, i.brand);
      const cfg = await getConfig(db, b);
      const pb = await kvGet<Playbook>(db, `playbook:${b.id}`);
      const refs = await listRefs(db, b.id);
      const ads = await listAds(db, { brandId: b.id });
      return {
        slug: b.slug,
        name: b.name,
        url: b.url,
        vertical: b.vertical,
        rulePack: b.rulePack,
        dossier: {
          oneLiner: b.dossier.oneLiner,
          positioning: b.dossier.positioning,
          offers: b.dossier.offers,
          voice: b.dossier.voice,
          proof: b.dossier.proof,
          claimsForbidden: b.dossier.claimsForbidden,
        },
        config: { ...cfg, brandImages: cfg.brandImages.length },
        playbook: pb
          ? {
              summary: pb.summary,
              patterns: pb.patterns.map((p) => p.name),
              whiteSpace: pb.whiteSpace,
              createdAt: pb.createdAt,
            }
          : null,
        competitorAds: { total: refs.length, analysed: refs.filter((r) => r.body.analysis).length },
        ads: {
          total: ads.length,
          ready: ads.filter((a) => a.status === "ready").length,
          approved: ads.filter((a) => a.status === "approved").length,
        },
      };
    },
  }),
  tool({
    name: "add_brand",
    description:
      "Add a brand from its website and set it up (dossier, logo, photos, colours, phone screenshot, competitors). With autopilot=true it then scans competitor ads, writes the playbook and generates a first batch of 6 ads. Returns a job id. Takes 3 to 15 minutes.",
    schema: z.object({
      url: z.string(),
      name: z.string().optional(),
      countries: z.array(z.string()).optional().describe("ISO-2 market codes, e.g. ['SK','CZ']"),
      languages: z.array(z.string()).optional().describe("e.g. ['sk','cs']"),
      notes: z.array(z.string()).optional().describe("standing instructions from the operator"),
      autopilot: z.boolean().optional(),
    }),
    run: async (_db, i) => {
      const { autopilot, ...rest } = i;
      const job = await startJob(autopilot ? "autopilot" : "setup", null, rest);
      return { jobId: job.id, kind: job.kind };
    },
  }),
  tool({
    name: "update_brand_config",
    description:
      "Change a brand's studio config. Only the fields you pass change. notesAdd appends standing instructions; testimonials must be real customer words the operator gave you.",
    schema: z.object({
      brand: brandArg,
      countries: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional(),
      defaultLanguage: z.string().optional(),
      competitors: z.array(Competitor).optional().describe("replaces the whole list"),
      searchTerms: z.array(z.string()).optional(),
      placement: z.enum(["paid", "organic"]).optional(),
      imageModel: z.enum(IMAGE_MODELS).optional(),
      aspects: z.array(z.enum(ASPECTS)).optional(),
      colors: z.object({ primary: z.string(), accent: z.string(), ink: z.string(), paper: z.string() }).optional(),
      headFont: z.string().optional(),
      notesAdd: z.array(z.string()).optional(),
      notes: z.array(z.string()).optional().describe("replaces all notes"),
      testimonials: z.array(Testimonial).optional(),
      offer: z.string().optional(),
      disclaimers: z.array(z.string()).optional(),
      ctaUrl: z.string().optional(),
    }),
    run: async (db, i) => {
      const b = await mustBrand(db, i.brand);
      const cur = await getConfig(db, b);
      const { brand: _b, notesAdd, headFont, ...patch } = i;
      const next = await setConfig(db, b, {
        ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
        ...(notesAdd ? { notes: [...(i.notes ?? cur.notes), ...notesAdd] } : {}),
        ...(headFont ? { fonts: { ...cur.fonts, head: headFont } } : {}),
      });
      return { ok: true, config: { ...next, brandImages: next.brandImages.length } };
    },
  }),
  tool({
    name: "update_dossier",
    description:
      "Correct the brand's facts (what it is, positioning, voice, proof, claims). Operator edits are locked against later crawls.",
    schema: z.object({
      brand: brandArg,
      oneLiner: z.string().optional(),
      positioning: z.string().optional(),
      voice: z.object({ tone: z.string(), do: z.array(z.string()), dont: z.array(z.string()) }).optional(),
      proof: z.array(z.string()).optional(),
      claimsAllowed: z.array(z.string()).optional(),
      claimsForbidden: z.array(z.string()).optional(),
    }),
    run: async (db, i) => {
      const b = await mustBrand(db, i.brand);
      const { brand: _b, ...patch } = i;
      await patchDossier(
        db,
        b.id,
        Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
        "operator",
        "studio chat",
      );
      return { ok: true };
    },
  }),
  tool({
    name: "scan_competitors",
    description:
      "Pull the static and carousel ads the brand's competitors are running now from the Meta Ad Library (plus the category search terms). Returns a job id. A few minutes; costs cents.",
    schema: z.object({
      brand: brandArg,
      perSource: z.number().optional().describe("ads per competitor search, default 30"),
      only: z.array(z.string()).optional().describe("only these competitor names"),
      countries: z.array(z.string()).optional(),
    }),
    run: async (db, i) => {
      const b = await mustBrand(db, i.brand);
      const { brand: _b, ...rest } = i;
      const job = await startJob("scan", b.id, rest);
      return { jobId: job.id };
    },
  }),
  tool({
    name: "analyze_competitors",
    description:
      "Take apart the scanned competitor ads with vision and write the brand's playbook (what wins, angles, white space). Returns a job id.",
    schema: z.object({ brand: brandArg, limit: z.number().optional(), force: z.boolean().optional() }),
    run: async (db, i) => {
      const b = await mustBrand(db, i.brand);
      const job = await startJob("analyze", b.id, { limit: i.limit, force: i.force });
      return { jobId: job.id };
    },
  }),
  tool({
    name: "get_playbook",
    description: "The brand's competitive playbook (winning patterns, angles, white space, norms, do-nots).",
    schema: z.object({ brand: brandArg }),
    run: async (db, i) => {
      const b = await mustBrand(db, i.brand);
      return (
        (await kvGet<Playbook>(db, `playbook:${b.id}`)) ?? {
          none: "No playbook yet: scan and analyse competitors first.",
        }
      );
    },
  }),
  tool({
    name: "list_competitor_ads",
    description: "The strongest competitor ads found for a brand, with their teardown.",
    schema: z.object({ brand: brandArg, limit: z.number().optional(), advertiser: z.string().optional() }),
    run: async (db, i) => {
      const b = await mustBrand(db, i.brand);
      const refs = (await listRefs(db, b.id)).filter(
        (r) => !i.advertiser || r.advertiser.toLowerCase().includes(i.advertiser.toLowerCase()),
      );
      return refs.slice(0, i.limit ?? 12).map((r) => ({
        id: r.id,
        advertiser: r.advertiser,
        type: r.mediaType,
        score: r.score,
        days: r.body.daysRunning,
        variants: r.body.variants,
        active: r.body.active,
        url: r.body.adLibraryUrl,
        format: r.body.analysis?.format,
        hook: r.body.analysis?.hook,
        headline: r.body.analysis?.headline,
        angle: r.body.analysis?.angle,
        steal: r.body.analysis?.steal,
      }));
    },
  }),
  tool({
    name: "generate_ads",
    description:
      "Generate a batch of statics and carousels for a brand: plan diverse concepts from the playbook and competitor winners, write copy natively, check compliance, make images, render, review and auto-fix. Returns a job id. About 1 to 3 minutes per ad.",
    schema: z.object({
      brand: brandArg,
      count: z.number().describe("total ads, 1 to 12"),
      carousels: z.number().optional().describe("how many of them are carousels"),
      formats: z
        .array(z.string())
        .optional()
        .describe(`format ids: ${FORMATS.map((f) => f.id).join(", ")}`),
      angles: z.array(z.string()).optional(),
      language: z.string().optional(),
      aspect: z.enum(ASPECTS).optional(),
      model: z.enum(IMAGE_MODELS).optional(),
      notes: z.string().optional().describe("the operator's brief for this batch"),
      refIds: z.array(z.string()).optional().describe("competitor ad ids to remake"),
      placement: z.enum(["paid", "organic"]).optional(),
    }),
    run: async (db, i) => {
      const b = await mustBrand(db, i.brand);
      const { brand: _b, ...rest } = i;
      const job = await startJob("generate", b.id, rest);
      return { jobId: job.id };
    },
  }),
  tool({
    name: "list_ads",
    description: "The brand's generated ads (newest first) with status, score and headline.",
    schema: z.object({
      brand: brandArg,
      status: z.enum(["queued", "rendering", "ready", "approved", "rejected", "failed"]).optional(),
      limit: z.number().optional(),
    }),
    run: async (db, i) => {
      const b = await mustBrand(db, i.brand);
      return (await listAds(db, { brandId: b.id, status: i.status })).slice(0, i.limit ?? 20).map((a) => ({
        id: a.id,
        title: a.body.title,
        format: a.format,
        kind: a.kind,
        status: a.status,
        score: a.score,
        headline: a.body.copy.headline,
        slides: a.body.slides.length,
        issues: a.body.review?.issues.slice(0, 2),
        error: a.body.error,
      }));
    },
  }),
  tool({
    name: "get_ad",
    description:
      "One ad in full: concept, copy, slides (slots, image source and prompt), compliance, review, versions.",
    schema: z.object({ id: z.string() }),
    run: async (db, i) => {
      const a = await getAd(db, i.id);
      if (!a) return { error: "not found" };
      return { ...a, body: { ...a.body, versions: a.body.versions.length } };
    },
  }),
  tool({
    name: "look_at_ad",
    description: "See an ad's rendered slides (images) to judge it yourself before advising or revising.",
    schema: z.object({ id: z.string() }),
    run: async (db, i) => {
      const a = await getAd(db, i.id);
      if (!a) return { error: "not found" };
      const blocks: BetaContentBlockParam[] = [
        {
          type: "text",
          text: `${a.body.title} (${a.format}, ${a.kind}, score ${a.score ?? "?"}). Copy: ${JSON.stringify(a.body.copy)}`,
        },
      ];
      for (const s of a.body.slides.slice(0, 8)) {
        const f = s.png ? urlToFile(s.png) : null;
        if (!f) continue;
        const b64 = (await sharp(f).resize(540, 675, { fit: "inside" }).jpeg({ quality: 78 }).toBuffer()).toString(
          "base64",
        );
        blocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } });
      }
      return { __blocks: blocks };
    },
  }),
  tool({
    name: "revise_ad",
    description:
      "Change an ad from feedback (copy, layout, image, format). Keeps what the feedback does not touch. Returns a job id.",
    schema: z.object({ id: z.string(), feedback: z.string(), model: z.enum(IMAGE_MODELS).optional() }),
    run: async (db, i) => {
      const a = await getAd(db, i.id);
      if (!a) return { error: "not found" };
      const job = await startJob("revise", a.brandId, { adId: a.id, feedback: i.feedback, model: i.model });
      return { jobId: job.id };
    },
  }),
  tool({
    name: "set_ad_status",
    description: "Approve or reject an ad (approved ads are the ones to upload).",
    schema: z.object({ id: z.string(), status: z.enum(["approved", "rejected", "ready"]) }),
    run: async (db, i) => {
      await updateAd(db, i.id, { status: i.status });
      return { ok: true };
    },
  }),
  tool({
    name: "get_job",
    description: "Status of a background job: step, progress, cost, last log lines, output.",
    schema: z.object({ id: z.string() }),
    run: async (db, i) => {
      const j = await getJob(db, i.id);
      if (!j) return { error: "not found" };
      return {
        kind: j.kind,
        status: j.status,
        step: j.step,
        progress: Math.round(j.progress * 100),
        costUsd: Math.round(j.costUsd * 100) / 100,
        error: j.error,
        log: j.log.slice(-6).map((l) => l.msg),
        output: j.output,
      };
    },
  }),
  tool({
    name: "list_jobs",
    description: "Recent jobs (all brands or one).",
    schema: z.object({ brand: brandArg.optional() }),
    run: async (db, i) => {
      const b = i.brand ? await mustBrand(db, i.brand) : null;
      return (await listJobs(db, { brandId: b?.id, limit: 10 })).map((j) => ({
        id: j.id,
        kind: j.kind,
        status: j.status,
        step: j.step,
        progress: Math.round(j.progress * 100),
        costUsd: Math.round(j.costUsd * 100) / 100,
      }));
    },
  }),
  tool({
    name: "cancel_job",
    description: "Stop a running job.",
    schema: z.object({ id: z.string() }),
    run: async (_db, i) => ({ cancelled: cancelJob(i.id) }),
  }),
  tool({
    name: "get_spend",
    description: "Money spent per provider on this server, the caps, and the image models with their prices.",
    schema: z.object({}),
    run: async (db) => ({
      spentUsd: await spentByProvider(db),
      caps: Object.fromEntries(
        ["ANTHROPIC", "OPENAI", "FAL", "APIFY", "FIRECRAWL"].map((p) => [
          p.toLowerCase(),
          Number(process.env[`BUDGET_USD_${p}`] ?? 0),
        ]),
      ),
      imageModels: Object.entries(IMAGE_MODEL_INFO).map(([id, m]) => ({
        id,
        label: m.label,
        usdPerImage: m.usd,
        note: m.note,
      })),
      settings: await getSettings(db),
    }),
  }),
  tool({
    name: "update_settings",
    description: "Global studio settings: reviewThreshold (auto-fix below this score), maxAdsPerBatch.",
    schema: z.object({ reviewThreshold: z.number().optional(), maxAdsPerBatch: z.number().optional() }),
    run: async (db, i) => setSettings(db, Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined))),
  }),
  tool({
    name: "list_formats",
    description: "The format library and carousel blueprints the generator can use.",
    schema: z.object({}),
    run: async () => ({
      formats: FORMATS.map((f) => ({ id: f.id, name: f.name, stage: f.stage, when: f.when, needs: f.needs })),
      carousels: CAROUSELS,
    }),
  }),
];

const toolDefs = (): BetaToolUnion[] =>
  TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: outputSchema(t.schema) as { type: "object" },
    eager_input_streaming: true,
  })) as BetaToolUnion[];

// ---------------------------------------------------------------- system

const SYSTEM = `You are the operator's ad studio agent at Rekampols. The studio makes paid-social STATICS and CAROUSELS (Meta first) that remake what already wins in each brand's market. You configure brands and run the pipeline with your tools; the operator talks to you like to a senior creative strategist who also runs the machine.

The pipeline per brand: add_brand (site, dossier, kit, competitors) > scan_competitors (Meta Ad Library statics and carousels) > analyze_competitors (vision teardown + playbook) > generate_ads (plan, write natively, compliance gate, images, render, review, auto-fix) > the operator approves or you revise_ad from feedback. add_brand with autopilot=true does all of it.

How to work:
- Act. When the request is clear, call the tools; do not ask for confirmation of routine steps. Ask only when a choice really is the operator's (markets, an offer, a real testimonial, budget above ~$15 for one batch).
- Long work runs as jobs. After starting one, say what runs, roughly how long, and the job id; check it with get_job when the operator asks or before you report results. Do not poll in a loop.
- When reporting ads, lead with the best ones (score), what format and angle they use, and anything flagged (compliance warnings, low contrast, issues).
- Ground everything: competitors' winning patterns, the brand dossier, real customer words. Never invent numbers, reviews, testimonials, doctors or prices. If the operator gives you real testimonials, an offer or a doctor's name, store them with update_brand_config.
- Health brands (a.clinic, rule pack eu_rx_telehealth): no drug names (Wegovy, Ozempic, GLP-1...), no injections/pens, no before/after bodies, no promised kg, no "you" + condition. Paid Meta ads for prescription telehealth also need LegitScript certification: the creatives can be made, but say this when relevant.
- Image models: openai:gpt-image-2 (direct, proven, ~$0.21/image), fal:gpt-image-2.5-flare (~$0.05), fal:nano-banana-pro (best consistency, ~$0.15), fal:nano-banana-2.1, fal:seedream-5-lite (cheapest). Text is always drawn by templates, so the model only makes the scene.
- Be brief and concrete. Plain text, short paragraphs or lists. No em dashes.`;

// ---------------------------------------------------------------- loop

export interface AgentSink {
  text: (t: string) => void;
  tool: (name: string, input: unknown) => void;
  toolResult: (name: string, summary: string, isError: boolean) => void;
}

export async function chatTurn(
  db: Db,
  threadId: string,
  userText: string,
  context: { brand?: string },
  sink: AgentSink,
) {
  const prior = await listMessages(db, threadId);
  const messages: BetaMessageParam[] = prior.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as BetaMessageParam["content"],
  }));
  const stamp = context.brand ? `[The operator is looking at brand: ${context.brand}]\n` : "";
  const userMsg: BetaMessageParam = { role: "user", content: `${stamp}${userText}` };
  messages.push(userMsg);
  await appendMessage(db, threadId, "user", userMsg.content);
  const model = MODEL();
  const tools = toolDefs();
  let jsonRetries = 0;
  for (let turn = 0; turn < 12; turn++) {
    const out = await callProvider(db, {
      provider: "anthropic",
      note: "studio chat",
      estimateUsd: claudeEstimate(model, Math.ceil(JSON.stringify(messages).length / 3.2) + 6000, 8000),
      demo: (): BetaMessage | null => null,
      live: async () => {
        const msg = await liveClaudeTransport(
          {
            model,
            max_tokens: 32000,
            betas: [FALLBACK_BETA],
            fallbacks: "default",
            thinking: { type: "adaptive" },
            output_config: { effort: "medium" },
            system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
            tools,
            messages,
            cache_control: { type: "ephemeral" },
          } as StreamParams,
          sink.text,
        );
        return {
          result: msg,
          usd: claudeCost(msg.model || model, msg.usage),
          units: `${msg.usage.input_tokens} in / ${msg.usage.output_tokens} out`,
        };
      },
    }).catch((e) => {
      if (e instanceof Anthropic.APIError || jsonRetries++ >= 2) throw e;
      return null;
    });
    if (out === null) continue;
    const msg = out.value;
    if (!msg) {
      sink.text("The chat model is not live on this server (demo mode).");
      return;
    }
    if (msg.stop_reason === "refusal") {
      sink.text("\n(The model declined this request.)");
      return;
    }
    const assistant: BetaMessageParam = { role: "assistant", content: msg.content as BetaContentBlockParam[] };
    messages.push(assistant);
    await appendMessage(db, threadId, "assistant", assistant.content);
    if (msg.stop_reason === "pause_turn") continue;
    const uses = msg.content.filter(
      (b): b is Extract<BetaMessage["content"][number], { type: "tool_use" }> => b.type === "tool_use",
    );
    if (!uses.length) return;
    if (msg.stop_reason === "max_tokens") {
      sink.text("\n(The reply was cut off.)");
      return;
    }
    const results: BetaContentBlockParam[] = [];
    await Promise.all(
      uses.map(async (u, idx) => {
        const t = TOOLS.find((x) => x.name === u.name);
        sink.tool(u.name, u.input);
        let content: string;
        let isError = false;
        if (!t) {
          content = `Unknown tool ${u.name}`;
          isError = true;
        } else {
          const parsed = t.schema.safeParse(u.input);
          if (!parsed.success) {
            content = JSON.stringify({
              INVALID_INPUT: parsed.error.issues.slice(0, 5).map((x) => `${x.path.join(".")}: ${x.message}`),
            });
            isError = true;
          } else {
            try {
              const out = (await t.run(db, parsed.data)) as { __blocks?: BetaContentBlockParam[] } | unknown;
              if (out && typeof out === "object" && "__blocks" in out && Array.isArray(out.__blocks)) {
                sink.toolResult(u.name, "(images)", false);
                results[idx] = { type: "tool_result", tool_use_id: u.id, content: out.__blocks as never };
                return;
              }
              content = JSON.stringify(out).slice(0, 24000);
            } catch (e) {
              content = e instanceof Error ? e.message : String(e);
              isError = true;
            }
          }
        }
        sink.toolResult(u.name, short(content, 200), isError);
        results[idx] = { type: "tool_result", tool_use_id: u.id, content, ...(isError ? { is_error: true } : {}) };
      }),
    );
    const userTurn: BetaMessageParam = { role: "user", content: results };
    messages.push(userTurn);
    await appendMessage(db, threadId, "user", userTurn.content);
  }
}

/** The visible transcript of a thread (text and tool calls, no thinking). */
export async function transcript(db: Db, threadId: string) {
  const rows = await listMessages(db, threadId);
  const out: { role: "user" | "assistant"; text: string; tools: { name: string; input: unknown }[] }[] = [];
  for (const r of rows) {
    const content = r.content as string | BetaContentBlockParam[];
    if (typeof content === "string") {
      out.push({
        role: r.role as "user",
        text: content.replace(/^\[The operator is looking at brand: [^\]]+\]\n/, ""),
        tools: [],
      });
      continue;
    }
    if (r.role === "user") continue; // tool results
    const text = content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
    const tools = content
      .filter((b) => b.type === "tool_use")
      .map((b) => ({ name: (b as { name: string }).name, input: (b as { input: unknown }).input }));
    const last = out.at(-1);
    if (last?.role === "assistant") {
      last.text += text;
      last.tools.push(...tools);
    } else out.push({ role: "assistant", text, tools });
  }
  return out;
}
