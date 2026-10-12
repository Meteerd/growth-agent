import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { type Concept, type RenderVersion, type ReviseResponse, RevisionLayer, type RevisionPlan } from "@/contracts";
import { structured } from "./agent/claude";
import { makeCtx } from "./agent/context";
import { reviewRender } from "./agent/phases/review";
import { dubFlagship } from "./audio/dub";
import type { SoundOverrides } from "./audio/soundtrack";
import { type BrandVoice, brandVoice, DEFAULT_SETTINGS, readVoices } from "./audio/voices";
import type { Db } from "./db/client";
import { HttpError } from "./http";
import { newId, nowIso } from "./ids";
import { extractFrame } from "./media/ffmpeg";
import { searchSharedVoices } from "./providers/elevenlabs";
import { falLocked, imageToVideo } from "./providers/fal";
import { higgsfieldClip } from "./providers/higgsfield";
import {
  appendEvent,
  getAsset,
  getBlueprint,
  getBrand,
  getConcept,
  listAssets,
  listPacksByRun,
  listRenderVersions,
  listSpend,
  upsertAsset,
  upsertConcept,
  upsertPack,
  upsertRenderVersion,
  upsertReview,
} from "./repo";
import { renderConcept } from "./services/concepts";
import { fileToUrl, urlToFile } from "./video/files";

/**
 * A19: the operator steers a finished video from the studio. A chat command becomes a structured edit plan that
 * touches only the named layers (voice, music, sfx, captions, hook text, shots, pacing, language); everything else
 * is reused byte for byte (same clips, same frames, cached takes and music). Every render is a version with its
 * parent, plan, cost and review; the operator marks one as chosen. Ambiguous commands get ONE clarifying question.
 */

const PlanDraft = z.object({
  clarify: z
    .object({ question: z.string(), options: z.array(z.string()).min(2).max(4) })
    .nullable()
    .optional(),
  layers: z.array(RevisionLayer),
  summary: z.string(),
  voiceId: z.string().nullable().optional(),
  voiceSpeed: z.number().nullable().optional(),
  voiceStability: z.number().nullable().optional(),
  musicPrompt: z.string().nullable().optional(),
  sfx: z.enum(["on", "off", "softer", "louder"]).nullable().optional(),
  captions: z
    .object({
      sizePct: z.number().nullable().optional(),
      position: z.enum(["upper", "middle", "lower"]).nullable().optional(),
      case: z.enum(["as_is", "upper", "lower"]).nullable().optional(),
      fill: z.string().nullable().optional(),
      accent: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  hookText: z.string().nullable().optional(),
  shots: z
    .array(z.object({ idx: z.number(), instruction: z.string() }))
    .nullable()
    .optional(),
  language: z.string().nullable().optional(),
});

const VOICE_WORDS = /voice|voices|speaker|narrat|male|female|man|woman|accent|warm|deep|slow|fast|hlas|ses|tone/i;

interface VoiceOption {
  voiceId: string;
  name: string;
  gender?: string;
  age?: string;
  accent?: string;
  descriptive?: string;
  note?: string;
}

async function voiceOptions(db: Db, slug: string, language: string): Promise<VoiceOption[]> {
  const book = readVoices()[slug]?.[language];
  const out: VoiceOption[] = (book?.candidates ?? []).map((c) => ({ voiceId: c.voiceId, name: c.name, note: c.note }));
  const lib = await searchSharedVoices(db, { language, pageSize: 40 }).catch(() => []);
  for (const v of lib
    .filter((v) => ((v as { rate?: number }).rate ?? 1) <= 1)
    .sort((a, b) => (b.usage_character_count_1y ?? 0) - (a.usage_character_count_1y ?? 0))
    .slice(0, 14))
    if (!out.some((o) => o.voiceId === v.voice_id))
      out.push({
        voiceId: v.voice_id,
        name: v.name,
        gender: v.gender,
        age: v.age,
        accent: v.accent,
        descriptive: v.descriptive,
      });
  return out;
}

/** The edit plan for a command (or one clarifying question). Pure planning: nothing is rendered here. */
export async function planRevision(
  db: Db,
  c: Concept,
  message: string,
): Promise<{ clarify?: { question: string; options: string[] }; plan?: RevisionPlan; voice?: BrandVoice }> {
  const brand = (await getBrand(db, c.brandId))!;
  const bp = c.blueprintId ? await getBlueprint(db, c.blueprintId) : null;
  const current = brandVoice(brand.slug, c.language);
  const voices = VOICE_WORDS.test(message) ? await voiceOptions(db, brand.slug, c.language) : [];
  const r = await structured(
    { db, runId: c.runId, phase: "production" },
    {
      route: "production",
      system: `You are the editor of a finished short vertical ad. The operator gives one command. Turn it into an edit plan that changes ONLY what the command asks for; everything else stays exactly as it is. Layers: voice (another voice and/or speed/stability), music (a new instrumental prompt), sfx (on/off/softer/louder), captions (size % of width, position, case, colours), hook_text (the big title over the first shot), shots (regenerate the named shots with an instruction), pacing, language (dub into another language, ISO 639-1). If the command is ambiguous in a way that changes the result (e.g. "change the voice" without saying how, "make it better"), set clarify with ONE short question and 2 to 4 concrete options, and leave the plan empty. For a voice change pick voiceId ONLY from the given options. summary: one plain line of what changes and what is reused, e.g. "voice Lucy -> Hope (warmer, female); captions re-timed to the new words; clips and music reused". Keep the brand's rules: ${brand.rulePack}.`,
      user: JSON.stringify({
        command: message,
        language: c.language,
        currentVoice: current ? { voiceId: current.voiceId, name: current.name, persona: current.persona } : null,
        voiceOptions: voices,
        captionStyle: bp?.captionStyle,
        hookText: c.shots[0]?.onScreenText,
        shots: c.shots.map((s) => ({
          idx: s.idx,
          durationSec: s.durationSec,
          voiceover: s.voiceover,
          visual: s.visualPrompt.slice(0, 160),
        })),
      }),
      schema: PlanDraft,
      note: `revise plan ${c.id}`,
      maxTokens: 3000,
      demo: () => ({
        layers: ["captions" as const],
        summary: "demo: captions bigger; everything else reused",
        captions: { sizePct: 9 },
      }),
    },
  );
  const d = r.value;
  if (d.clarify) return { clarify: d.clarify };
  const pick = d.voiceId ? voices.find((v) => v.voiceId === d.voiceId) : undefined;
  const voice: BrandVoice | undefined =
    d.layers.includes("voice") && (pick || d.voiceSpeed || d.voiceStability)
      ? {
          ...(current ?? {
            modelId: "eleven_multilingual_v2",
            language: c.language,
            settings: DEFAULT_SETTINGS,
            persona: "",
            why: "",
            chosenAt: nowIso(),
            voiceId: "",
            name: "",
          }),
          voiceId: pick?.voiceId ?? current?.voiceId ?? "",
          name: pick?.name ?? current?.name ?? "",
          settings: {
            ...(current?.settings ?? DEFAULT_SETTINGS),
            ...(d.voiceSpeed ? { speed: Math.min(1.2, Math.max(0.7, d.voiceSpeed)) } : {}),
            ...(d.voiceStability ? { stability: Math.min(1, Math.max(0, d.voiceStability)) } : {}),
          },
        }
      : undefined;
  const clean = (o: object | null | undefined) =>
    o
      ? (Object.fromEntries(
          Object.entries(o).filter(([, v]) => v !== null && v !== undefined),
        ) as RevisionPlan["captions"])
      : undefined;
  const plan: RevisionPlan = {
    layers: d.layers,
    summary: d.summary,
    voice: voice
      ? { voiceId: voice.voiceId, name: voice.name, speed: voice.settings.speed, stability: voice.settings.stability }
      : undefined,
    musicPrompt: d.musicPrompt ?? undefined,
    sfx: d.sfx ?? undefined,
    captions: clean(d.captions),
    hookText: d.hookText ?? undefined,
    shots: d.shots ?? undefined,
    language: d.language ?? undefined,
  };
  return { plan, voice };
}

/** The original cut as version 1 when a concept has no versions yet. */
export async function ensureVersions(db: Db, c: Concept): Promise<RenderVersion[]> {
  const list = await listRenderVersions(db, c.id);
  if (list.length || !c.videoAssetId) return list;
  const a = await getAsset(db, c.videoAssetId);
  if (!a) return list;
  const v1: RenderVersion = {
    id: newId("render"),
    conceptId: c.id,
    version: 1,
    status: "ready",
    assetId: a.id,
    assetUrl: a.url,
    posterUrl: fs.existsSync(`${urlToFile(a.url)}.poster.jpg`) ? `${a.url}.poster.jpg` : undefined,
    shots: await shotProviders(db, c),
    costUsd: 0,
    chosen: true,
    createdAt: a.createdAt,
  };
  await upsertRenderVersion(db, v1);
  return [v1];
}

async function shotProviders(db: Db, c: Concept) {
  return Promise.all(
    c.shots.map(async (s) => {
      const clip = s.clipAssetId ? await getAsset(db, s.clipAssetId) : null;
      return {
        idx: s.idx,
        provider: clip ? `${clip.provider} ${clip.model ?? ""}`.trim() : "still",
        clipUrl: clip?.url,
      };
    }),
  );
}

const g = globalThis as unknown as { __revising?: Set<string> };

/** Plan a revision and, unless a question is needed, start rendering the new version in the background. */
export async function revise(
  db: Db,
  conceptId: string,
  message: string,
  fromRenderId?: string,
): Promise<ReviseResponse> {
  const c = await getConcept(db, conceptId);
  if (!c) throw new HttpError(404, "not_found", "Concept not found");
  g.__revising ??= new Set();
  if (g.__revising.has(c.id)) throw new HttpError(409, "already_revising", "A revision is already rendering");
  const versions = await ensureVersions(db, c);
  const parent = fromRenderId
    ? versions.find((v) => v.id === fromRenderId)
    : (versions.find((v) => v.chosen) ?? versions.at(-1));
  const p = await planRevision(db, c, message);
  if (p.clarify) return { status: "needs_clarification", question: p.clarify.question, options: p.clarify.options };
  const plan = p.plan!;
  const v: RenderVersion = {
    id: newId("render"),
    conceptId: c.id,
    version: (versions.at(-1)?.version ?? 0) + 1,
    parentId: parent?.id,
    message,
    plan,
    status: "rendering",
    shots: await shotProviders(db, c),
    costUsd: 0,
    chosen: false,
    createdAt: nowIso(),
  };
  await upsertRenderVersion(db, v);
  await appendEvent(db, {
    runId: c.runId,
    phase: "production",
    type: "revision",
    title: `Revision v${v.version}: ${plan.summary}`,
    refId: v.id,
    data: { conceptId: c.id, renderId: v.id, status: "rendering", plan },
  });
  g.__revising.add(c.id);
  void runRevision(db, c, v, p.voice).finally(() => g.__revising!.delete(c.id));
  return { status: "queued", plan, renderId: v.id };
}

async function runRevision(db: Db, c0: Concept, v: RenderVersion, voice?: BrandVoice) {
  const plan = v.plan!;
  const spent0 = (await listSpend(db, c0.runId)).reduce((a, s) => a + s.usd, 0);
  const keepVideo = c0.videoAssetId;
  try {
    let assetId: string;
    let assetUrl: string;
    if (plan.layers.includes("language") && plan.language && plan.language !== c0.language) {
      const d = await dubFlagship(db, c0.id, plan.language);
      assetId = d.asset.id;
      assetUrl = d.asset.url;
    } else {
      // shots named in the plan get a new clip; every other clip is reused as is
      if (plan.shots?.length) {
        // a named shot gets a new clip; a generated shot also gets a new frame from the instruction (a brand
        // photo keeps its real image)
        const c = (await getConcept(db, c0.id))!;
        const brand = (await getBrand(db, c.brandId))!;
        const { keyframeFor } = await import("./flagship");
        const shots = [...c.shots];
        for (const x of plan.shots) {
          const s = shots[x.idx];
          if (!s) continue;
          const next = {
            ...s,
            clipAssetId: undefined,
            motion: `${(s.motion ?? "").split(" Fix:")[0]} Fix: ${x.instruction}`.trim(),
            visualPrompt:
              s.source === "generated"
                ? `${s.visualPrompt.split(" Change:")[0]} Change: ${x.instruction}`
                : s.visualPrompt,
          };
          shots[x.idx] =
            s.source === "generated"
              ? {
                  ...next,
                  keyframeAssetId: (
                    await keyframeFor(db, brand, c, next, ` (v${v.version}: ${x.instruction.slice(0, 40)})`)
                  ).id,
                }
              : next;
        }
        await upsertConcept(db, { ...c, shots });
      }
      const overrides: SoundOverrides = {
        voice,
        musicPrompt: plan.musicPrompt,
        sfx: plan.sfx,
        captions: plan.captions,
        hookText: plan.hookText,
      };
      const r = await renderConcept(db, c0.id, "final", {
        label: `v${v.version}`,
        soundtrack: "voice_led",
        keepClips: !plan.shots?.length,
        animateAll: !!plan.shots?.length,
        overrides,
      });
      const a = { ...r.asset, model: `${r.asset.model}-flagship` };
      await upsertAsset(db, a);
      assetId = a.id;
      assetUrl = a.url;
      // the concept keeps showing the chosen version until the operator picks this one
      const c = (await getConcept(db, c0.id))!;
      if (keepVideo) await upsertConcept(db, { ...c, videoAssetId: keepVideo });
    }
    const file = urlToFile(assetUrl)!;
    await extractFrame(file, 1.2, `${file}.poster.jpg`, 720).catch(() => undefined);
    const c = (await getConcept(db, c0.id))!;
    const spent = (await listSpend(db, c0.runId)).reduce((a, s) => a + s.usd, 0);
    const ready: RenderVersion = {
      ...v,
      status: "ready",
      assetId,
      assetUrl,
      posterUrl: `${assetUrl}.poster.jpg`,
      shots: await shotProviders(db, c),
      costUsd: Math.round((spent - spent0) * 100) / 100,
    };
    await upsertRenderVersion(db, ready);
    await appendEvent(db, {
      runId: c.runId,
      phase: "production",
      type: "revision",
      title: `Revision v${v.version} ready`,
      refId: v.id,
      data: { conceptId: c.id, renderId: v.id, status: "ready", url: assetUrl },
    });
    // the self-review lands after the video (Claude frames + Gemini with sound)
    const bp = c.blueprintId ? await getBlueprint(db, c.blueprintId) : null;
    const ctx = (await makeCtx(db, c.runId, new AbortController().signal)).forPhase("review");
    const rv = await reviewRender(ctx, c, bp, assetId, 100 + v.version, []).catch(() => null);
    if (rv) {
      await upsertReview(db, rv);
      await upsertRenderVersion(db, {
        ...ready,
        review: { overall: rv.overall, perShot: rv.perShot.map((p) => p.score), notes: rv.notes },
      });
    }
  } catch (e) {
    await upsertRenderVersion(db, { ...v, status: "failed", error: e instanceof Error ? e.message : String(e) });
    const c = await getConcept(db, c0.id);
    if (c && keepVideo) await upsertConcept(db, { ...c, videoAssetId: keepVideo, status: "rendered" });
    await appendEvent(db, {
      runId: c0.runId,
      phase: "production",
      type: "revision",
      title: `Revision v${v.version} failed`,
      refId: v.id,
      detail: e instanceof Error ? e.message : String(e),
      data: { conceptId: c0.id, renderId: v.id, status: "failed" },
    });
  }
}

/** Mark a version as chosen: the concept's video and its unposted packs switch to it. */
export async function chooseVersion(db: Db, conceptId: string, renderId: string): Promise<RenderVersion> {
  const list = await listRenderVersions(db, conceptId);
  const v = list.find((x) => x.id === renderId);
  if (!v) throw new HttpError(404, "not_found", "Render version not found");
  if (v.status !== "ready" || !v.assetId) throw new HttpError(409, "not_ready", "This version is not ready");
  for (const x of list)
    if (x.chosen !== (x.id === renderId)) await upsertRenderVersion(db, { ...x, chosen: x.id === renderId });
  const c = (await getConcept(db, conceptId))!;
  await upsertConcept(db, { ...c, videoAssetId: v.assetId });
  for (const p of (await listPacksByRun(db, c.runId)).filter((x) => x.conceptId === c.id && x.status === "ready"))
    await upsertPack(db, { ...p, videoAssetId: v.assetId });
  return { ...v, chosen: true };
}

// ---------------------------------------------------------------- variants

/** Alternative clips per shot from fal and Higgsfield (in the background); the operator picks one per shot. */
export async function makeVariants(db: Db, conceptId: string, providers: ("fal" | "higgsfield")[], shots?: number[]) {
  const c = (await getConcept(db, conceptId))!;
  const targets = c.shots.filter((s) => !shots || shots.includes(s.idx));
  const dir = path.resolve(process.env.ASSETS_DIR || "data/assets", "runs", c.runId, c.id, "variants");
  fs.mkdirSync(dir, { recursive: true });
  for (const s of targets) {
    const kf = s.keyframeAssetId ? await getAsset(db, s.keyframeAssetId) : null;
    const img = kf ? urlToFile(kf.url) : null;
    if (!img) continue;
    const prompt = `${s.motion ?? "subtle natural handheld phone motion"}. Natural, physically plausible motion, real camera feel, no text, no morphing.`;
    await Promise.all(
      providers.map(async (p) => {
        const out = path.join(dir, `shot${s.idx}_${p}_${Date.now().toString(36)}.mp4`);
        const r =
          p === "fal"
            ? falLocked()
              ? null
              : await imageToVideo(db, {
                  imageFile: img,
                  prompt,
                  durationSec: s.durationSec > 5 ? 10 : 5,
                  out,
                  runId: c.runId,
                  demo: async () => null,
                }).catch(() => null)
            : await higgsfieldClip(db, {
                imageFile: img,
                prompt,
                durationSec: Math.max(5, Math.round(s.durationSec)),
                out,
                runId: c.runId,
                demo: async () => null,
              }).catch(() => null);
        if (!r?.file) return;
        await upsertAsset(db, {
          id: newId("asset"),
          brandId: c.brandId,
          conceptId: c.id,
          kind: "clip",
          url: fileToUrl(r.file),
          provider: p,
          model: r.model,
          costUsd: r.usd,
          width: 1080,
          height: 1920,
          durationSec: s.durationSec,
          demo: false,
          createdAt: nowIso(),
          shotIdx: s.idx,
        });
      }),
    );
  }
}

export async function listVariants(db: Db, conceptId: string) {
  const c = (await getConcept(db, conceptId))!;
  const clips = (await listAssets(db, conceptId)).filter((a) => a.kind === "clip" && a.shotIdx !== undefined);
  return {
    shots: c.shots.map((s) => ({
      idx: s.idx,
      variants: clips
        .filter((a) => a.shotIdx === s.idx)
        .map((a) => ({
          clipId: a.id,
          idx: s.idx,
          provider: a.provider,
          model: a.model,
          url: a.url,
          chosen: a.id === s.clipAssetId,
          costUsd: a.costUsd ?? 0,
        })),
    })),
  };
}

export async function chooseClip(db: Db, conceptId: string, idx: number, clipId: string): Promise<Concept> {
  const c = (await getConcept(db, conceptId))!;
  const a = await getAsset(db, clipId);
  if (!a || a.conceptId !== c.id || a.kind !== "clip") throw new HttpError(404, "not_found", "Clip not found");
  if (!c.shots.some((s) => s.idx === idx)) throw new HttpError(400, "bad_shot", `No shot ${idx}`);
  const next = { ...c, shots: c.shots.map((s) => (s.idx === idx ? { ...s, clipAssetId: clipId } : s)) };
  await upsertConcept(db, next);
  return next;
}
