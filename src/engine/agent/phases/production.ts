import { z } from "zod";
import { type Brand, CHANNELS, CONCEPT_FORMATS, type Concept, type Evidence } from "@/contracts";
import { checkAndRevise } from "../../compliance/check-and-revise";
import { renderEstimate } from "../../providers/prices";
import { getLatestPlan, listBlueprints, listConcepts, listEvidence, listQuestions, upsertConcept } from "../../repo";
import { rulePackText } from "../../rules";
import { generateKeyframes } from "../../services/concepts";
import { loadPrompt, structured } from "../claude";
import type { PhaseCtx } from "../context";
import { answersDigest, blueprintDigest, dossierDigest, evidenceDigest } from "../digest";

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

export function draftsToConcepts(
  runId: string,
  brand: Brand,
  drafts: ConceptDrafts["concepts"],
  evidence: Evidence[],
  blueprintIds: Set<string>,
): Concept[] {
  const ev = new Set(evidence.map((e) => e.id));
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
    const bp = d.blueprintId && blueprintIds.has(d.blueprintId) ? d.blueprintId : undefined;
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
      remakesEvidenceIds: d.remakesEvidenceIds.filter((x) => ev.has(x)),
      compliance: "pending",
      estimatedCostUsd: isVideo({ format: d.format, shots }) ? renderEstimate(shots, "draft").totalUsd : 0,
      status: "draft",
      createdAt: new Date(Date.now() + i).toISOString(),
      remakeNote: d.remakeNote,
      body: d.body,
      revisions: 0,
      ...(bp
        ? {
            blueprintId: bp,
            shotMap: d.shotMap?.length ? d.shotMap : shots.map((s) => ({ shotIdx: s.idx, blueprintShotIdx: s.idx })),
          }
        : {}),
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
  const concepts = draftsToConcepts(
    run.id,
    brand,
    out.value.concepts.slice(0, 7),
    evidence,
    new Set(bps.map((b) => b.id)),
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
