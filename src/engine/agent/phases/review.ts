import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Blueprint, Concept, Review } from "@/contracts";
import { newId } from "../../ids";
import { extractFrame, probe } from "../../media/ffmpeg";
import { shakeScore } from "../../media/motion-check";
import { getAsset, getBlueprint, getConcept, listAssets, listConcepts, upsertReview } from "../../repo";
import { rulePackText } from "../../rules";
import { generateKeyframes, renderConcept } from "../../services/concepts";
import { urlToFile } from "../../video/files";
import { type BetaContentBlockParam, loadPrompt, structured } from "../claude";
import type { PhaseCtx } from "../context";
import { mergeRenderWatch, watchRender } from "../watcher";

export const ReviewDraft = z.object({
  overall: z.number(),
  blueprintMatch: z.number(),
  perShot: z.array(z.object({ idx: z.number(), score: z.number(), issues: z.array(z.string()) })),
  complianceOk: z.boolean(),
  decision: z.enum(["accept", "regenerate"]),
  notes: z.string(),
});

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Demo review: deterministic placeholder scores (labelled demo); the round-1 weakest shot gets regenerated. */
export function demoReview(c: Concept, round: number, regenerated: number[]): z.infer<typeof ReviewDraft> {
  const seed = [...c.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const scores = c.shots.map((s) => {
    const base = 72 + ((seed + s.idx * 37) % 17);
    return regenerated.includes(s.idx) ? Math.min(95, base + 14) : round > 1 ? Math.min(95, base + 3) : base;
  });
  if (round === 1 && scores.length) scores[(seed % scores.length) as number] = 58;
  const weakest = scores.indexOf(Math.min(...scores));
  const overall = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
  const regen = round === 1;
  return {
    overall,
    blueprintMatch: Math.min(100, overall + 5),
    perShot: scores.map((score, idx) => ({
      idx,
      score,
      issues:
        regen && idx === weakest ? ["Demo review: weakest frame by placeholder score; regenerate its keyframe"] : [],
    })),
    complianceOk: true,
    decision: regen ? "regenerate" : "accept",
    notes: regen
      ? `Demo review: shot ${weakest + 1} scored lowest (${scores[weakest]}); regenerating it.`
      : "Demo review: accepted after one regeneration.",
  };
}

async function watchOwn(c: Concept, videoUrl: string, key: string) {
  const file = urlToFile(videoUrl)!;
  const info = await probe(file);
  const times: { t: number; shot: number }[] = [];
  let t0 = 0;
  for (const s of c.shots) {
    // right after the cut (does the shot land?), then mid-shot and late: motion and morphing show between frames
    if (s.idx > 0) times.push({ t: Math.min(info.durationSec - 0.05, t0 + 0.15), shot: s.idx });
    times.push({ t: Math.min(info.durationSec - 0.05, t0 + Math.min(0.6, s.durationSec / 2)), shot: s.idx });
    if (s.durationSec > 2.5) times.push({ t: t0 + s.durationSec * 0.75, shot: s.idx });
    t0 += s.durationSec;
  }
  times.push({ t: Math.max(0, info.durationSec - 1), shot: -1 });
  const frames = [];
  for (const x of times) {
    const out = path.resolve(process.env.ASSETS_DIR || "data/assets", "review_frames", key, `${x.t.toFixed(2)}.jpg`);
    await extractFrame(file, x.t, out, 360);
    frames.push({ ...x, file: out });
  }
  return { info, frames };
}

export interface PriorScore {
  idx: number;
  score: number;
  /** frame, clip and caption are the same as when this score was given */
  unchanged: boolean;
}

/** The previous review's scores, marking which shots are unchanged since (calibrates the next review). */
export function priorScores(prev: Review | undefined, before: Concept["shots"], now: Concept["shots"]) {
  if (!prev) return undefined;
  return prev.perShot.map((p): PriorScore => {
    const a = before[p.idx];
    const b = now[p.idx];
    const unchanged =
      !!a &&
      !!b &&
      a.keyframeAssetId === b.keyframeAssetId &&
      a.clipAssetId === b.clipAssetId &&
      a.onScreenText === b.onScreenText;
    return { idx: p.idx, score: p.score, unchanged };
  });
}

export interface CutMeasurements {
  /** direction reversals per second of the frame (shakeScore) per shot; > 1 is visible shake */
  shake: { idx: number; reversalsPerSec: number }[];
  /** the cut has a music bed under the voice */
  musicBed: boolean;
}

/** Measured facts about our own cut, so the review cannot pass what a viewer would see or hear as broken (A18). */
export async function measureCut(c: Concept, videoFile: string): Promise<CutMeasurements> {
  const shake: CutMeasurements["shake"] = [];
  let t0 = 0;
  for (const s of c.shots) {
    const dur = Math.min(2, s.durationSec - 0.3);
    if (dur > 0.5)
      shake.push({
        idx: s.idx,
        reversalsPerSec: await shakeScore(videoFile, { start: t0 + 0.15, durationSec: dur }).catch(() => 0),
      });
    t0 += s.durationSec;
  }
  return { shake, musicBed: false };
}

/**
 * Hard limits from the measurements, applied after the model's judgment on final renders: a shaking shot scores
 * at most 65 and a cut without a music bed at most 75 overall, whatever the model said.
 */
export function applyMeasurements(r: Review, m: CutMeasurements): Review {
  const perShot = r.perShot.map((p) => {
    const sh = m.shake.find((x) => x.idx === p.idx);
    if (!sh || sh.reversalsPerSec <= 1) return p;
    return {
      ...p,
      score: Math.min(p.score, 65),
      issues: [
        `The whole frame shakes (${sh.reversalsPerSec.toFixed(1)} direction flips per second): use a real clip or a smooth, oversampled camera move.`,
        ...p.issues,
      ],
    };
  });
  let overall = r.overall;
  let notes = r.notes;
  if (!m.musicBed) {
    overall = Math.min(overall, 75);
    notes = `No music bed: an ad without music reads as unfinished. ${notes}`;
  }
  const shotsLow = perShot.some((p) => p.score < 80);
  overall = Math.min(overall, Math.round(perShot.reduce((a, p) => a + p.score, 0) / Math.max(1, perShot.length)) + 5);
  return { ...r, perShot, overall, notes, decision: shotsLow || overall < 80 ? "regenerate" : r.decision };
}

export async function reviewRender(
  ctx: PhaseCtx,
  c: Concept,
  bp: Blueprint | null,
  assetId: string,
  round: number,
  regenerated: number[],
  prior?: PriorScore[],
): Promise<Review> {
  const asset = await getAsset(ctx.db, assetId);
  if (!asset) throw new Error("render asset missing");
  const { frames } = await watchOwn(c, asset.url, `${c.id}_r${round}`);
  const final = (asset.model ?? "").includes("final") && !asset.demo;
  const measured = final
    ? {
        ...(await measureCut(c, urlToFile(asset.url)!)),
        musicBed: (await listAssets(ctx.db, c.id)).some((a) => a.kind === "music"),
      }
    : null;
  const content: BetaContentBlockParam[] = [
    {
      type: "text",
      text: JSON.stringify({
        concept: {
          title: c.title,
          hook: c.hook,
          language: c.language,
          shots: c.shots.map((s) => ({
            idx: s.idx,
            durationSec: s.durationSec,
            onScreenText: s.onScreenText,
            voiceover: s.voiceover,
          })),
        },
        blueprint: bp
          ? {
              structure: bp.structure,
              hook: bp.hook,
              shots: bp.shots.map((s) => ({
                idx: s.idx,
                t0: s.t0,
                t1: s.t1,
                purpose: s.purpose,
                shotType: s.shotType,
              })),
            }
          : null,
        round,
        captions:
          final && bp?.captionStyle
            ? "Live spoken-word captions (1-3 words, synced to the voice, in the winner's text style) replace the scripted on-screen lines on purpose; judge their placement and legibility, not whether the scripted lines appear."
            : undefined,
        previousRound: prior?.length ? prior : undefined,
        measured: measured ?? undefined,
      }),
    },
  ];
  for (const f of frames) {
    content.push({ type: "text", text: `t=${f.t.toFixed(2)}s ${f.shot >= 0 ? `(shot ${f.shot})` : "(end card)"}` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f.file).toString("base64") },
    });
  }
  const r = await structured(
    { db: ctx.db, runId: ctx.run.id, phase: "review" },
    {
      route: "vision",
      system: loadPrompt("review", { rulePack: rulePackText(ctx.brand.rulePack) }),
      user: content,
      schema: ReviewDraft,
      note: `review: ${c.id} round ${round}`,
      maxTokens: 8000,
      demo: () => demoReview(c, round, regenerated),
    },
  );
  const v = r.value;
  const perShot = c.shots.map((s) => {
    const p = v.perShot.find((x) => x.idx === s.idx);
    return { idx: s.idx, score: clamp(p?.score ?? v.overall), issues: p?.issues ?? [] };
  });
  const review: Review = {
    id: newId("review"),
    conceptId: c.id,
    assetId,
    round,
    overall: clamp(v.overall),
    blueprintMatch: clamp(v.blueprintMatch),
    perShot,
    complianceOk: v.complianceOk,
    decision: v.decision,
    notes: v.notes,
    createdAt: new Date().toISOString(),
    demo: r.mode === "demo",
  };
  const measuredReview = measured ? applyMeasurements(review, measured) : review;
  // A18: on finals Gemini watches the whole cut with sound; the stricter of the two reviewers wins
  if (!final) return measuredReview;
  const w = await watchRender(ctx.db, { file: urlToFile(asset.url)!, concept: c, bp, runId: ctx.run.id }).catch(
    async (e) => {
      await ctx.emit("warning", "Gemini could not watch the render; Claude's frame review only", {
        detail: e instanceof Error ? e.message : String(e),
      });
      return null;
    },
  );
  return w ? mergeRenderWatch(measuredReview, w) : measuredReview;
}

/** Render the remake, watch it, regenerate the weakest shot, re-render: at most 2 rounds. */
export async function review(ctx: PhaseCtx): Promise<void> {
  const { db, run } = ctx;
  const concepts = await listConcepts(db, run.id);
  const c0 = concepts.find(
    (c) =>
      c.blueprintId &&
      c.shots.length > 1 &&
      c.compliance !== "fail" &&
      c.format !== "static" &&
      c.format !== "carousel",
  );
  if (!c0) {
    await ctx.emit("warning", "No remake concept to render and review in this run");
    return;
  }
  const bp = c0.blueprintId ? await getBlueprint(db, c0.blueprintId) : null;
  const regenerated: number[] = [];
  let last: { review: Review; shots: Concept["shots"] } | undefined;
  for (let round = 1; round <= 2; round++) {
    ctx.check();
    const { asset } = await renderConcept(db, c0.id, "draft", {
      emit: ctx.emit,
      label: `review_r${round}`,
      phase: "review",
    });
    const c = (await getConcept(db, c0.id))!;
    const rv = await reviewRender(
      ctx,
      c,
      bp,
      asset.id,
      round,
      regenerated,
      priorScores(last?.review, last?.shots ?? [], c.shots),
    );
    last = { review: rv, shots: c.shots };
    if (round === 2 && rv.decision === "regenerate") rv.decision = "accept";
    const weakest = rv.perShot.reduce((a, b) => (b.score < a.score ? b : a), rv.perShot[0]);
    if (rv.decision === "regenerate" && weakest) rv.regeneratedShots = [weakest.idx];
    await upsertReview(db, rv);
    await ctx.emit("review", `Round ${round}: ${rv.overall}/100, ${rv.decision}`, {
      refId: rv.id,
      detail: rv.notes,
      data: { conceptId: c.id, round, decision: rv.decision, perShot: rv.perShot },
    });
    if (rv.decision === "accept" || !weakest) break;
    regenerated.push(weakest.idx);
    await generateKeyframes(db, c.id, {
      shotIdx: weakest.idx,
      emit: ctx.emit,
      reason: `review round ${round}: ${weakest.issues[0] ?? "lowest score"}`,
    });
  }
}
