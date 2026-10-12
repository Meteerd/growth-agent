import { z } from "zod";
import { type Brand, CHANNELS, CONCEPT_FORMATS, type Concept, type Evidence } from "@/contracts";
import { checkAndRevise } from "../../compliance/check-and-revise";
import { renderEstimate } from "../../providers/prices";
import { getLatestPlan, listBlueprints, listConcepts, listEvidence, listQuestions, upsertConcept } from "../../repo";
import { rulePackText } from "../../rules";
import { generateKeyframes } from "../../services/concepts";
import { loadPrompt, structured } from "../claude";
import type { PhaseCtx } from "../context";
import { answersDigest, blueprintDigest, dossierDigest, evidenceDigest, keepIds } from "../digest";

export const ConceptDrafts = z.object({
  concepts: z.array(
    z.object({
      channel: z.enum(CHANNELS),
      format: z.enum(CONCEPT_FORMATS),
      aspect: z.enum(["9:16", "4:5", "1:1", "16:9"]),
      title: z.string(),
      hook: z.string(),
      angle: z.string(),
      language: z.string(),
      blueprintId: z.string().optional(),
      shotMap: z.array(z.object({ shotIdx: z.number(), blueprintShotIdx: z.number() })).optional(),
      variantOfIndex: z.number().optional(),
      shots: z.array(
        z.object({
          durationSec: z.number(),
          visualPrompt: z.string(),
          onScreenText: z.string().optional(),
          voiceover: z.string().optional(),
        }),
      ),
      caption: z.string(),
      hashtags: z.array(z.string()),
      cta: z.string(),
      remakesEvidenceIds: z.array(z.string()),
      remakeNote: z.string(),
      body: z.string().optional(),
    }),
  ),
});
export type ConceptDrafts = z.infer<typeof ConceptDrafts>;

export function styleBlock(b: Brand): string {
  const v = b.dossier.visual;
  return `${v.styleNotes ?? "Clean, natural light, brand-consistent."} Brand colors: ${v.colors.join(", ") || "neutral"}. Vertical 9:16 composition, subject centered with space for captions in the lower third.`;
}

const isVideo = (c: Pick<Concept, "format" | "shots">) =>
  !["static", "carousel", "text_post"].includes(c.format) && c.shots.length > 1;

const words = (t?: string) => (t ?? "").split(/\s+/).filter(Boolean).length;
const SEP = /^(→|·|-|\||\/)$/;

/**
 * Fallback shortening without a model: keep whole clauses (cut after punctuation or before an arrow). With no clause
 * boundary the text is kept as is: a long caption is better than one cut mid-phrase that changes the meaning.
 */
export function clipCaption(text: string, max = 8): string {
  const w = text.split(/\s+/).filter(Boolean);
  if (w.length <= max) return text;
  let cut = 0;
  for (let i = 1; i <= max; i++) {
    if (/[.!?;:,]$/.test(w[i - 1]!) || SEP.test(w[i] ?? "")) cut = i;
  }
  if (cut < 2) return text;
  const kept = w.slice(0, cut).filter((x) => !SEP.test(x));
  // never return an empty caption (e.g. a line of arrows only)
  return kept.length ? kept.join(" ").replace(/[,;:]$/, "") : text;
}
const Shortened = z.object({ captions: z.array(z.object({ key: z.string(), onScreenText: z.string() })) });

/**
 * Video captions over 12 words cannot be read in a 2 to 5 s shot. Shorten them (same language, same meaning, no new
 * claims) in one call before the compliance check, so the check covers the text that ships.
 */
export async function shortenVideoCaptions(ctx: PhaseCtx, concepts: Concept[]): Promise<Concept[]> {
  const long = concepts.filter(isVideo).flatMap((c) =>
    c.shots
      .filter((s) => words(s.onScreenText) > 12)
      .map((s) => ({
        key: `${c.id}:${s.idx}`,
        language: c.language,
        onScreenText: s.onScreenText!,
        voiceover: s.voiceover,
      })),
  );
  if (!long.length) return concepts;
  const r = await structured(
    { db: ctx.db, runId: ctx.run.id, phase: "production" },
    {
      route: "production",
      system: `You edit on-screen captions for short vertical videos. Rewrite each caption to at most 8 words in its own language, same meaning, no new claims, plain words. The voiceover carries the detail. Return every key.\n\n${rulePackText(ctx.brand.rulePack)}`,
      user: JSON.stringify(long),
      schema: Shortened,
      note: `production: shorten ${long.length} caption(s)`,
      maxTokens: 4000,
      demo: () => ({
        captions: long.map((l) => ({ key: l.key, onScreenText: clipCaption(l.onScreenText) })),
      }),
    },
  );
  const next = new Map(r.value.captions.filter((x) => words(x.onScreenText) > 0).map((x) => [x.key, x.onScreenText]));
  await ctx.emit("log", `Shortened ${next.size} on-screen caption(s) for readability`);
  return concepts.map((c) => ({
    ...c,
    shots: c.shots.map((s) => {
      const t = next.get(`${c.id}:${s.idx}`);
      return t ? { ...s, onScreenText: t } : s;
    }),
  }));
}

export function draftsToConcepts(
  runId: string,
  brand: Brand,
  drafts: ConceptDrafts["concepts"],
  evidence: Evidence[],
  blueprints: { id: string; shots: number }[],
): Concept[] {
  const ev = new Set(evidence.map((e) => e.id));
  const byId = new Map(blueprints.map((b) => [b.id, b]));
  // a draft whose blueprint id is unknown in this run (e.g. demo drafts on reused research) still gets linked:
  // the first multi-shot video concept takes the best-matching blueprint of the run
  let fallbackUsed = drafts.some((d) => d.blueprintId && byId.has(d.blueprintId));
  const pick = (n: number) => blueprints.find((b) => b.shots === n) ?? blueprints[0];
  const proportional = (n: number, m: number) =>
    Array.from({ length: n }, (_, i) => ({ shotIdx: i, blueprintShotIdx: Math.min(m - 1, Math.floor((i * m) / n)) }));
  const sfx = runId.slice(-8);
  const ids = drafts.map((_, i) => `concept_${sfx}_${i + 1}`);
  return drafts.map((d, i) => {
    const shots = d.shots.map((s, idx) => ({
      idx,
      durationSec: Math.min(
        8,
        Math.max(d.format === "carousel" || d.format === "static" ? 1 : 1.5, Number(s.durationSec) || 3),
      ),
      visualPrompt: s.visualPrompt,
      onScreenText: s.onScreenText,
      voiceover: s.voiceover,
      approved: false,
    }));
    let bp = d.blueprintId ? byId.get(d.blueprintId) : undefined;
    const videoLike =
      shots.length > 1 && !["static", "carousel", "text_post"].includes(d.format) && d.variantOfIndex === undefined;
    if (!bp && !fallbackUsed && blueprints.length && (d.blueprintId || d.shotMap?.length || videoLike)) {
      bp = pick(shots.length);
      fallbackUsed = true;
    }
    const validMap =
      bp &&
      d.shotMap?.length &&
      d.shotMap.every((m) => m.shotIdx < shots.length && m.blueprintShotIdx < (bp?.shots ?? 0))
        ? d.shotMap
        : undefined;
    const c: Concept = {
      id: ids[i],
      runId,
      brandId: brand.id,
      channel: d.channel,
      format: d.format,
      aspect: d.aspect,
      title: d.title,
      hook: d.hook,
      angle: d.angle,
      language: d.language,
      shots,
      caption: d.caption,
      hashtags: d.hashtags.map((h) => (h.startsWith("#") || d.format === "text_post" ? h : `#${h}`)),
      cta: d.cta,
      remakesEvidenceIds: keepIds(d.remakesEvidenceIds, ev),
      compliance: "pending",
      estimatedCostUsd: isVideo({ format: d.format, shots }) ? renderEstimate(shots, "draft").totalUsd : 0,
      status: "draft",
      createdAt: new Date(Date.now() + i).toISOString(),
      remakeNote: d.remakeNote,
      body: d.body,
      revisions: 0,
      ...(bp ? { blueprintId: bp.id, shotMap: validMap ?? proportional(shots.length, bp.shots) } : {}),
      ...(d.variantOfIndex !== undefined && ids[d.variantOfIndex] && d.variantOfIndex !== i
        ? { variantOf: ids[d.variantOfIndex] }
        : {}),
    };
    return c;
  });
}

function demoDrafts(ctx: PhaseCtx): ConceptDrafts["concepts"] {
  const cs = ctx.demo?.concepts;
  if (cs?.length) {
    return cs.map((c) => ({
      channel: c.channel,
      format: c.format,
      aspect: c.aspect,
      title: c.title,
      hook: c.hook,
      angle: c.angle,
      language: c.language,
      blueprintId: c.blueprintId,
      shotMap: c.shotMap,
      variantOfIndex: c.variantOf ? cs.findIndex((x) => x.id === c.variantOf) : undefined,
      shots: c.shots.map((s) => ({
        durationSec: s.durationSec,
        visualPrompt: s.visualPrompt,
        onScreenText: s.onScreenText,
        voiceover: s.voiceover,
      })),
      caption: c.caption,
      hashtags: c.hashtags,
      cta: c.cta,
      remakesEvidenceIds: c.remakesEvidenceIds,
      remakeNote: c.remakeNote ?? "",
      body: c.body,
    }));
  }
  const b = ctx.brand;
  return [
    {
      channel: "instagram_reels",
      format: "faceless_broll",
      aspect: "9:16",
      title: `${b.name}: what it is in 15 seconds`,
      hook: b.dossier.oneLiner || b.name,
      angle: "Plain explainer (demo data: no evidence for this brand yet)",
      language: b.languages[0] ?? "en",
      shots: [
        { durationSec: 3, visualPrompt: `Product hero shot for ${b.name}`, onScreenText: b.dossier.oneLiner || b.name },
        {
          durationSec: 4,
          visualPrompt: "The problem the buyer has, shown calmly",
          onScreenText: b.dossier.personas[0]?.pains[0] ?? "The problem",
        },
        { durationSec: 4, visualPrompt: "How the product helps, in use", onScreenText: "How it works" },
        { durationSec: 3, visualPrompt: "Brand end frame", onScreenText: "Learn more" },
      ],
      caption: b.dossier.oneLiner || b.name,
      hashtags: [],
      cta: "Learn more",
      remakesEvidenceIds: [],
      remakeNote: "Demo concept: no winners were found for this brand in demo mode.",
    },
  ];
}

export async function production(ctx: PhaseCtx): Promise<void> {
  const { db, run, brand } = ctx;
  const [evidence, qs, bps, plan] = await Promise.all([
    listEvidence(db, run.id),
    listQuestions(db, run.id),
    listBlueprints(db, run.id),
    getLatestPlan(db, run.id),
  ]);
  const out = await structured(
    { db, runId: run.id, phase: "production" },
    {
      route: "production",
      system: loadPrompt("production", { rulePack: rulePackText(brand.rulePack), style: styleBlock(brand) }),
      user: [
        `DOSSIER\n${dossierDigest(brand)}`,
        `OPERATOR ANSWERS\n${answersDigest(qs) || "(none)"}`,
        `CHANNEL PLAN\n${JSON.stringify(plan ? { summary: plan.summary, channels: plan.channels.map((c) => ({ channel: c.channel, mode: c.mode, formats: c.formats, targets: c.targets })) } : null)}`,
        `BLUEPRINTS\n${blueprintDigest(bps) || "(none)"}`,
        `EVIDENCE\n${evidenceDigest(evidence, 30)}`,
      ].join("\n\n"),
      schema: ConceptDrafts,
      note: `production: concepts for ${brand.slug}`,
      maxTokens: 32000,
      demo: () => ({ concepts: demoDrafts(ctx) }),
    },
  );
  const concepts = await shortenVideoCaptions(
    ctx,
    draftsToConcepts(
      run.id,
      brand,
      out.value.concepts.slice(0, 7),
      evidence,
      bps.map((b) => ({ id: b.id, shots: b.shots.length })),
    ),
  );
  for (const c0 of concepts) {
    ctx.check();
    const { concept: c, checks } = await checkAndRevise(db, brand, c0, run.id);
    await upsertConcept(db, c);
    await ctx.emit("concept", c.title, {
      refId: c.id,
      detail: c.hook,
      data: { channel: c.channel, format: c.format, blueprintId: c.blueprintId, variantOf: c.variantOf },
    });
    for (const ch of checks) {
      await ctx.emit(
        "compliance",
        `${ch.status.toUpperCase()}: ${c.title}${ch.attempt ? ` (revision ${ch.attempt})` : ""}`,
        {
          refId: ch.id,
          detail: ch.findings.map((f) => `${f.ruleId}: ${f.message}`).join(" | ") || undefined,
          data: { targetId: c.id, status: ch.status, attempt: ch.attempt },
        },
      );
    }
  }
  // keyframes first, for the remake (cents, the approval gate comes before any expensive render)
  const saved = await listConcepts(db, run.id);
  const target =
    saved.find((c) => c.blueprintId && isVideo(c) && c.compliance !== "fail") ??
    saved.find((c) => isVideo(c) && c.compliance !== "fail");
  if (target) await generateKeyframes(db, target.id, { runId: run.id, emit: ctx.emit });
}
