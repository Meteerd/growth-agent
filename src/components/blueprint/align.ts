import type { Asset, Blueprint, BlueprintShot, Concept, Review, Shot } from "@/contracts";

/** Index of the blueprint shot playing at time t (t1 exclusive; the last shot holds the final instant). */
export function shotAt(shots: readonly Pick<BlueprintShot, "t0" | "t1">[], t: number): number {
  if (!shots.length) return -1;
  const i = shots.findIndex((s) => t >= s.t0 && t < s.t1);
  if (i !== -1) return i;
  return t < shots[0].t0 ? 0 : shots.length - 1;
}

/** The analysed frame closest to the middle of [t0, t1], if any frame falls inside it. */
export function nearestFrame(frames: Blueprint["frames"], t0: number, t1: number) {
  const mid = (t0 + t1) / 2;
  let best: Blueprint["frames"][number] | undefined;
  for (const f of frames)
    if (f.t >= t0 && f.t <= t1 && (!best || Math.abs(f.t - mid) < Math.abs(best.t - mid))) best = f;
  return best;
}

/** Our shot for each blueprint shot, from the concept's shotMap (falls back to the same index). */
export function alignRemake(bp: Pick<Blueprint, "shots">, concept?: Pick<Concept, "shots" | "shotMap">) {
  return bp.shots.map((_, bpIdx): Shot | undefined => {
    if (!concept) return undefined;
    const m = concept.shotMap?.find((x) => x.blueprintShotIdx === bpIdx);
    const idx = m ? m.shotIdx : bpIdx;
    return concept.shots.find((s) => s.idx === idx);
  });
}

export const latestReview = (reviews: readonly Review[] = []) => [...reviews].sort((a, b) => b.round - a.round)[0];

export function shotScore(review: Review | undefined, shotIdx: number | undefined) {
  if (!review || shotIdx == null) return undefined;
  return review.perShot.find((p) => p.idx === shotIdx);
}

/** Keyframe url per shot index: the shot's keyframeAssetId first, then any keyframe asset tagged with that shotIdx. */
export function keyframeUrls(assets: readonly Asset[] = [], shots: readonly Shot[] = []) {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const out = new Map<number, string>();
  for (const s of shots) {
    const a =
      (s.keyframeAssetId && byId.get(s.keyframeAssetId)) ||
      assets.find((x) => x.kind === "keyframe" && x.shotIdx === s.idx);
    if (a) out.set(s.idx, a.url);
  }
  return out;
}

export const scoreTone = (score: number) => (score >= 80 ? "pass" : score >= 65 ? "warn" : "fail");
