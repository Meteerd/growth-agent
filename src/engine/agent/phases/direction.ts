import { z } from "zod";
import {
  CHANNELS,
  type Channel,
  ChannelMode,
  type ChannelPlan,
  type ChannelRec,
  DEFAULT_WEIGHTS,
  type Question,
  weightedScore,
} from "@/contracts";
import type { Db } from "../../db/client";
import { HttpError } from "../../http";
import { appendEvent, getLatestPlan, insertPlan, listBlueprints, listEvidence, listQuestions } from "../../repo";
import { rulePackText } from "../../rules";
import { loadPrompt, structured } from "../claude";
import type { PhaseCtx } from "../context";
import { answersDigest, blueprintDigest, dossierDigest, evidenceDigest, keepIds, resolveCitations } from "../digest";

const Axis = z.number();
export const ChannelAssessment = z.object({
  summary: z.string(),
  channels: z.array(
    z.object({
      channel: z.enum(CHANNELS),
      scores: z.object({
        audience: Axis,
        provenWins: Axis,
        productionFit: Axis,
        complianceRisk: Axis,
        speedToSignal: Axis,
        modelFit: Axis,
      }),
      recommend: z.boolean(),
      mode: ChannelMode,
      rationale: z.string(),
      evidenceIds: z.array(z.string()),
      answerIds: z.array(z.string()),
      formats: z.array(z.string()),
      cadence: z.string(),
      firstSteps: z.array(z.string()),
      kpis: z.array(z.string()),
      targets: z.array(z.string()),
      notNowReason: z.string(),
    }),
  ),
});
export type ChannelAssessment = z.infer<typeof ChannelAssessment>;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Weights shift a little by business model; they are always explicit in the plan. */
export function weightsFor(vertical: string) {
  if (vertical === "b2b_saas")
    return {
      audience: 0.25,
      provenWins: 0.1,
      productionFit: 0.15,
      complianceRisk: 0.15,
      speedToSignal: 0.1,
      modelFit: 0.25,
    };
  if (vertical === "telehealth_rx" || vertical === "health_wellness_dtc")
    return {
      audience: 0.22,
      provenWins: 0.18,
      productionFit: 0.15,
      complianceRisk: 0.25,
      speedToSignal: 0.08,
      modelFit: 0.12,
    };
  return DEFAULT_WEIGHTS;
}

function legitScriptYes(qs: Question[]): boolean {
  return qs.some((q) => /legitscript/i.test(q.prompt) && (q.answer === "yes" || q.answer === true));
}

/** Hard constraints from the rule pack, applied after the model scored: they always win. */
export function applyRuleGuards(a: ChannelAssessment, rulePack: string, qs: Question[]): ChannelAssessment {
  if (rulePack !== "eu_rx_telehealth" || legitScriptYes(qs)) return a;
  return {
    ...a,
    channels: a.channels.map((c) =>
      c.channel === "meta_ads" ||
      c.channel === "tiktok_ads" ||
      (c.channel === "instagram_reels" && c.mode !== "organic")
        ? c.channel === "instagram_reels"
          ? { ...c, mode: "organic" as const }
          : {
              ...c,
              recommend: false,
              scores: { ...c.scores, complianceRisk: Math.min(c.scores.complianceRisk, 10) },
              notNowReason: c.notNowReason.includes("RX4")
                ? c.notNowReason
                : `RX4: paid ads for prescription telehealth need LegitScript certification and platform authorization, which the brand does not have yet. ${c.notNowReason}`.trim(),
            }
        : c,
    ),
  };
}

export function buildPlan(
  runId: string,
  brandId: string,
  version: number,
  a: ChannelAssessment,
  weights: ChannelPlan["weights"],
  evidenceIds: Set<string>,
  answerIds: Set<string>,
): ChannelPlan {
  const scored = a.channels.map((c) => {
    const s = c.scores;
    const scores = {
      audience: clamp(s.audience),
      provenWins: clamp(s.provenWins),
      productionFit: clamp(s.productionFit),
      complianceRisk: clamp(s.complianceRisk),
      speedToSignal: clamp(s.speedToSignal),
      modelFit: clamp(s.modelFit),
    };
    const score = weightedScore(
      [
        scores.audience,
        scores.provenWins,
        scores.productionFit,
        scores.complianceRisk,
        scores.speedToSignal,
        scores.modelFit,
      ],
      weights,
    );
    return { c, scores, score };
  });
  const recs: ChannelRec[] = scored
    .filter((x) => x.c.recommend && x.score >= 40)
    .sort((x, y) => y.score - x.score)
    .slice(0, 6)
    .map((x, i) => ({
      channel: x.c.channel,
      priority: i + 1,
      score: x.score,
      scores: x.scores,
      mode: x.c.mode,
      rationale: x.c.rationale,
      evidenceIds: keepIds(x.c.evidenceIds, evidenceIds),
      answerIds: x.c.answerIds.filter((id) => answerIds.has(id)),
      formats: x.c.formats,
      cadence: x.c.cadence,
      firstSteps: x.c.firstSteps.slice(0, 5),
      kpis: x.c.kpis,
      targets: x.c.targets,
    }));
  const chosen = new Set(recs.map((r) => r.channel));
  const notNow = scored
    .filter((x) => !chosen.has(x.c.channel))
    .sort((x, y) => y.score - x.score)
    .map((x) => ({
      channel: x.c.channel,
      reason: x.c.notNowReason || (x.c.recommend ? `Scored ${x.score}/100, below the channels above.` : x.c.rationale),
      evidenceIds: keepIds(x.c.evidenceIds, evidenceIds),
    }));
  return {
    id: `plan_${runId.slice(-8)}_v${version}`,
    runId,
    brandId,
    version,
    summary: a.summary,
    weights,
    channels: recs,
    notNow,
    considered: scored
      .map((x) => ({ channel: x.c.channel, score: x.score, scores: x.scores }))
      .sort((p, q) => q.score - p.score),
    createdAt: new Date().toISOString(),
  };
}

function demoAssessment(ctx: PhaseCtx): ChannelAssessment {
  const p = ctx.demo?.plan;
  if (!p) {
    return {
      summary: "Demo plan: start organic on short video and the brand's own site while evidence builds.",
      channels: (["instagram_reels", "tiktok", "seo", "linkedin", "meta_ads"] as Channel[]).map((ch, i) => ({
        channel: ch,
        scores: {
          audience: 70 - i * 8,
          provenWins: 60 - i * 6,
          productionFit: 70,
          complianceRisk: 80,
          speedToSignal: 70 - i * 5,
          modelFit: 70 - i * 5,
        },
        recommend: i < 3,
        mode: "organic" as const,
        rationale: "Demo data: no live evidence for this brand yet.",
        evidenceIds: [],
        answerIds: [],
        formats: ["short video"],
        cadence: "3 per week",
        firstSteps: ["Post three test pieces", "Compare against the account median", "Keep what beats it"],
        kpis: ["Views vs median"],
        targets: [],
        notNowReason: i >= 3 ? "Demo data: start organic first." : "",
      })),
    };
  }
  const toAx = (c: { scores: ChannelRec["scores"] }) => c.scores;
  return {
    summary: p.summary,
    channels: [
      ...p.channels.map((c) => ({
        ...c,
        scores: toAx(c),
        recommend: true,
        answerIds: c.answerIds ?? [],
        notNowReason: "",
      })),
      ...p.notNow.map((n) => {
        const cons = p.considered?.find((c) => c.channel === n.channel);
        return {
          channel: n.channel,
          scores: cons?.scores ?? {
            audience: 20,
            provenWins: 20,
            productionFit: 50,
            complianceRisk: 50,
            speedToSignal: 40,
            modelFit: 20,
          },
          recommend: false,
          mode: "organic" as const,
          rationale: n.reason,
          evidenceIds: n.evidenceIds,
          answerIds: [],
          formats: [],
          cadence: "",
          firstSteps: [],
          kpis: [],
          targets: [],
          notNowReason: n.reason,
        };
      }),
    ],
  };
}

export async function direction(ctx: PhaseCtx): Promise<void> {
  const { db, run, brand } = ctx;
  const [evidence, qs, bps] = await Promise.all([
    listEvidence(db, run.id),
    listQuestions(db, run.id),
    listBlueprints(db, run.id),
  ]);
  const weights = ctx.demo?.plan.weights ?? weightsFor(brand.vertical);
  const out = await structured(
    { db, runId: run.id, phase: "direction" },
    {
      route: "strategy",
      system: loadPrompt("direction", { rulePack: rulePackText(brand.rulePack) }),
      user: [
        `CANDIDATE CHANNELS: ${CHANNELS.join(", ")}`,
        `WEIGHTS (applied by code): ${JSON.stringify(weights)}`,
        `DOSSIER\n${dossierDigest(brand)}`,
        `OPERATOR ANSWERS\n${answersDigest(qs) || "(none)"}`,
        `EVIDENCE\n${evidenceDigest(evidence, 50)}`,
        `BLUEPRINTS\n${blueprintDigest(bps) || "(none)"}`,
      ].join("\n\n"),
      schema: ChannelAssessment,
      note: `direction: channel plan for ${brand.slug}`,
      maxTokens: 24000,
      demo: () => demoAssessment(ctx),
    },
  );
  const guarded = applyRuleGuards(out.value, brand.rulePack, qs);
  const plan = buildPlan(
    run.id,
    brand.id,
    1,
    guarded,
    weights,
    new Set(evidence.map((e) => e.id)),
    new Set(qs.map((q) => q.id)),
  );
  const evIds = new Set(evidence.map((e) => e.id));
  plan.summary = resolveCitations(plan.summary, evIds);
  for (const c of plan.channels) c.rationale = resolveCitations(c.rationale, evIds);
  for (const n of plan.notNow) n.reason = resolveCitations(n.reason, evIds);
  for (const c of plan.channels)
    await ctx.emit("thinking", `${c.channel}: ${c.score}/100 (${c.mode})`, {
      detail: c.rationale,
      data: { scores: c.scores },
    });
  for (const n of plan.notNow.slice(0, 6)) await ctx.emit("thinking", `Not now: ${n.channel}`, { detail: n.reason });
  await insertPlan(db, plan);
  await ctx.emit("plan", plan.summary, {
    refId: plan.id,
    data: { version: plan.version, channels: plan.channels.map((c) => c.channel) },
  });
}

/** Operator edit: reorder and/or drop channels -> a new plan version. */
export async function patchPlan(
  db: Db,
  runId: string,
  body: { channels?: Channel[]; drop?: { channel: Channel; reason?: string }[] },
): Promise<ChannelPlan> {
  const cur = await getLatestPlan(db, runId);
  if (!cur) throw new HttpError(404, "not_found", "Plan not found");
  const drop = new Map((body.drop ?? []).map((d) => [d.channel, d.reason ?? "Dropped by the operator"]));
  let channels = cur.channels.filter((c) => !drop.has(c.channel));
  if (body.channels) {
    const keep = new Set(body.channels);
    for (const c of channels) if (!keep.has(c.channel)) drop.set(c.channel, "Dropped by the operator");
    const byCh = new Map(channels.map((c) => [c.channel, c]));
    const moved = cur.notNow.filter((n) => keep.has(n.channel) && !byCh.has(n.channel));
    channels = body.channels
      .map((ch) => byCh.get(ch) ?? (moved.find((m) => m.channel === ch) ? fromNotNow(cur, ch) : undefined))
      .filter((c): c is ChannelRec => !!c);
  }
  const notNow = [
    ...cur.channels
      .filter((c) => drop.has(c.channel))
      .map((c) => ({ channel: c.channel, reason: drop.get(c.channel)!, evidenceIds: c.evidenceIds })),
    ...cur.notNow.filter((n) => !channels.some((c) => c.channel === n.channel) && !drop.has(n.channel)),
  ];
  const next: ChannelPlan = {
    ...cur,
    id: cur.id.replace(/_v\d+$/, `_v${cur.version + 1}`),
    version: cur.version + 1,
    channels: channels.map((c, i) => ({ ...c, priority: i + 1 })),
    notNow,
    createdAt: new Date().toISOString(),
  };
  await insertPlan(db, next);
  await appendEvent(db, {
    runId,
    phase: "direction",
    type: "plan",
    title: `Plan v${next.version}: edited by the operator`,
    refId: next.id,
    data: { version: next.version },
  });
  return next;
}

function fromNotNow(plan: ChannelPlan, ch: Channel): ChannelRec {
  const cons = plan.considered?.find((c) => c.channel === ch);
  const n = plan.notNow.find((x) => x.channel === ch)!;
  return {
    channel: ch,
    priority: 0,
    score: cons?.score ?? 0,
    scores: cons?.scores ?? {
      audience: 0,
      provenWins: 0,
      productionFit: 0,
      complianceRisk: 0,
      speedToSignal: 0,
      modelFit: 0,
    },
    mode: "organic",
    rationale: `Added by the operator. Earlier reason it was not recommended: ${n.reason}`,
    evidenceIds: n.evidenceIds,
    formats: [],
    cadence: "",
    firstSteps: [],
    kpis: [],
    targets: [],
  };
}
