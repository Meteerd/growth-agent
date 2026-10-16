import sharp from "sharp";
import { z } from "zod";
import type { Brand } from "@/contracts";
import { type BetaContentBlockParam, structured } from "../agent/claude";
import { urlToFile } from "../video/files";
import { getConfig } from "./config";
import { FORMATS, formatLibraryText } from "./formats";
import type { JobCtx } from "./jobs";
import { kvSet, listRefs, setRefAnalysis } from "./store";
import { type AdRef, Playbook, RefAnalysis } from "./types";

/**
 * Teardown of competitor statics and carousels (Claude vision, a few ads per call), then a playbook for the brand:
 * which formats and angles win in its market, the white space, and the norms to follow or break.
 */

const Batch = z.object({ ads: z.array(RefAnalysis.extend({ n: z.number() })) });

async function thumb(url: string, w = 540): Promise<string | null> {
  const f = urlToFile(url);
  if (!f) return null;
  try {
    return (
      await sharp(f)
        .resize(w, w * 1.25, { fit: "inside" })
        .jpeg({ quality: 78 })
        .toBuffer()
    ).toString("base64");
  } catch {
    return null;
  }
}

const SYSTEM = `You are a senior performance creative strategist. You take apart competitor STATIC and CAROUSEL ads from the Meta Ad Library so a brand can remake the structures that win (never copy the creative).

For each ad return:
- format: the closest id from the format library (or "other").
- hook: what stops the scroll, in a few words. headline: the main on-image text, verbatim (original language).
- layout: where things sit (e.g. "headline top 20%, phone mockup centre, CTA pill bottom-left").
- visualStyle: photo/UGC/illustration/graphic/UI mockup, polish level, palette.
- angle: the persuasion lever (authority, convenience, price, fear of missing out, identity, social proof, education...). persona: who it speaks to. emotion: the feeling it trades on.
- offer: the offer if any, verbatim, else "". cta: the CTA on the image or button.
- whyItWins: why this likely performs (use the run length and variant count given: long-running and many variants means it is a proven winner).
- steal: the structure worth reusing in one or two sentences, abstracted (no copying words or images). avoid: what not to copy (including compliance risks for health ads: drug names, before/after bodies, guarantees).
- slides: for carousels, what each card does, in order; else [].
- strength: 0 to 100 as a reference to learn from (craft + proof of performance).
- irrelevant: true when it is not a real competitor ad for this category (job ads, unrelated products, reposts).
Write in English. No em dashes.

${formatLibraryText()}`;

export async function analyzeRefs(ctx: JobCtx, brand: Brand, o: { limit?: number; force?: boolean } = {}) {
  const { db } = ctx;
  const all = await listRefs(db, brand.id);
  const todo = all.filter((r) => o.force || !r.body.analysis).slice(0, o.limit ?? 40);
  await ctx.step(`Taking apart ${todo.length} competitor ads`, 0.05);
  const batches: AdRef[][] = [];
  for (let i = 0; i < todo.length; i += 4) batches.push(todo.slice(i, i + 4));
  let done = 0;
  const queue = [...batches.entries()];
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        ctx.check();
        const [, batch] = item;
        const content: BetaContentBlockParam[] = [
          {
            type: "text",
            text: `Brand we work for: ${brand.name}: ${brand.dossier.oneLiner}. Market: ${brand.countries.join(", ")}.`,
          },
        ];
        for (const [n, r] of batch.entries()) {
          content.push({
            type: "text",
            text: `AD ${n} | ${r.mediaType === "video_cover" ? "VIDEO AD (only its cover frame shown: judge it as the static hook people see first)" : r.mediaType} | advertiser: ${r.advertiser} | running ${r.body.daysRunning ?? "?"} days, ${r.body.active ? "still active" : "stopped"} | variants using this creative: ${r.body.variants ?? 1} | CTA: ${r.body.cta ?? ""}\nPrimary text: ${(r.body.body ?? "").slice(0, 600)}\nHeadline field: ${r.body.title ?? ""}${r.body.cards.length ? `\nCards: ${r.body.cards.map((c, i) => `${i + 1}. ${c.title ?? ""} ${c.body ?? ""}`).join(" | ")}` : ""}`,
          });
          for (const u of r.body.images.slice(0, r.mediaType === "carousel" ? 4 : 1)) {
            const b = await thumb(u, r.mediaType === "carousel" ? 360 : 540);
            if (b) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b } });
          }
        }
        try {
          const res = await structured(
            { db },
            {
              route: "vision",
              system: SYSTEM,
              user: content,
              schema: Batch,
              note: `studio analyze ${brand.slug}: ${batch.length} ads`,
              maxTokens: 12000,
              demo: () => ({ ads: [] }),
            },
          );
          await ctx.cost(res.usd);
          for (const a of res.value.ads) {
            const r = batch[a.n];
            if (!r) continue;
            const { n: _n, ...analysis } = a;
            const score = analysis.irrelevant ? 0 : Math.round(r.score * 0.55 + analysis.strength * 0.45);
            await setRefAnalysis(db, r.id, { ...r.body, analysis }, score);
          }
        } catch (e) {
          await ctx.log(`A batch failed: ${e instanceof Error ? e.message : e}`);
        }
        done++;
        await ctx.step(
          `Analysed ${Math.min(done * 4, todo.length)} of ${todo.length}`,
          0.05 + (0.75 * done) / batches.length,
        );
      }
    }),
  );
  await ctx.step("Writing the playbook", 0.85);
  const playbook = await writePlaybook(ctx, brand);
  return { analysed: todo.length, patterns: playbook?.patterns.length ?? 0 };
}

export async function writePlaybook(ctx: JobCtx, brand: Brand) {
  const { db } = ctx;
  const cfg = await getConfig(db, brand);
  const refs = (await listRefs(db, brand.id))
    .filter((r) => r.body.analysis && !r.body.analysis.irrelevant)
    .slice(0, 60);
  if (!refs.length) return null;
  const rows = refs.map((r) => ({
    id: r.id,
    advertiser: r.advertiser,
    type: r.mediaType,
    days: r.body.daysRunning,
    variants: r.body.variants,
    active: r.body.active,
    score: r.score,
    ...r.body.analysis,
  }));
  const res = await structured(
    { db },
    {
      route: "strategy",
      system: `You are the creative strategist for ${brand.name}. From the teardown of competitor statics and carousels in its market, write the playbook the ad generator will follow. Weight the evidence by score (long-running, many variants, still active = proven). patterns: the 4 to 8 structures that win here (name, format id from the library, share = how common, refIds = the ads that show it, why it works, howWeUseIt for ${brand.name} specifically and compliantly). angles: the persuasion angles competitors lean on, with evidence and how we take a different or better position. whiteSpace: what nobody is doing that we could own. visualNorms / copyNorms: what the category looks and sounds like (so we can match it or break it on purpose). doNot: what to avoid (compliance for this brand's rules, tired clichés). Format ids: ${FORMATS.map((f) => f.id).join(", ")}. No em dashes.`,
      user: JSON.stringify({
        brand: {
          name: brand.name,
          oneLiner: brand.dossier.oneLiner,
          positioning: brand.dossier.positioning,
          rulePack: brand.rulePack,
          notes: cfg.notes,
        },
        competitorAds: rows,
      }),
      schema: Playbook,
      note: `studio playbook ${brand.slug}`,
      maxTokens: 16000,
      demo: () => ({
        summary: "",
        patterns: [],
        angles: [],
        whiteSpace: [],
        visualNorms: "",
        copyNorms: "",
        doNot: [],
      }),
    },
  );
  await ctx.cost(res.usd);
  const pb = { ...res.value, createdAt: new Date().toISOString(), refCount: refs.length };
  await kvSet(db, `playbook:${brand.id}`, pb);
  return pb;
}
