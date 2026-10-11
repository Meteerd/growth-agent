import type { Evidence, LongevityTier } from "@/contracts";

export function median(xs: number[]): number {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Ads running 30+ days are "proven", 7 to 29 "testing", under 7 "new" (longevity is the honest proxy for "works"). */
export function longevityTier(daysRunning: number | undefined): LongevityTier | undefined {
  if (daysRunning === undefined || !Number.isFinite(daysRunning)) return undefined;
  if (daysRunning >= 30) return "proven";
  if (daysRunning >= 7) return "testing";
  return "new";
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Outlier score = views / median views of the same author's posts in this batch (needs 3+ posts by that author).
 * Fallback: views / followers. Items without views get no score. Mutates and returns the list.
 */
export function scoreOutliers(items: Evidence[], opts: { accountMedians?: Record<string, number> } = {}): Evidence[] {
  const byAuthor = new Map<string, number[]>();
  for (const e of items) {
    if (e.author && e.metrics.views) byAuthor.set(e.author, [...(byAuthor.get(e.author) ?? []), e.metrics.views]);
  }
  for (const e of items) {
    const v = e.metrics.views;
    if (!v || e.metrics.outlierScore !== undefined) continue;
    const known = e.author ? opts.accountMedians?.[e.author] : undefined;
    const batch = e.author ? byAuthor.get(e.author) : undefined;
    if (known && known > 0) e.metrics.outlierScore = r1(v / known);
    else if (batch && batch.length >= 3 && median(batch) > 0) e.metrics.outlierScore = r1(v / median(batch));
    else if (e.metrics.followers && e.metrics.followers > 0) e.metrics.outlierScore = r1(v / e.metrics.followers);
  }
  return items;
}

/** Rank for "what to learn from": proven ads first, then outliers, then raw reach. */
export function winnerRank(e: Evidence): number {
  const days = e.metrics.daysRunning ?? 0;
  const tier = longevityTier(e.metrics.daysRunning);
  const longevity = tier === "proven" ? 50 + Math.min(days, 120) / 4 : tier === "testing" ? 15 + days / 2 : 0;
  const outlier = Math.min(e.metrics.outlierScore ?? 0, 30) * 3;
  const reach = Math.log10((e.metrics.views ?? 0) + 1) * 2;
  return longevity + outlier + reach;
}

export function tagLongevity(e: Evidence): Evidence {
  const tier = longevityTier(e.metrics.daysRunning);
  if (tier && !e.tags.includes(tier)) e.tags = [...e.tags, tier];
  if ((e.metrics.outlierScore ?? 0) >= 5 && !e.tags.includes("outlier")) e.tags = [...e.tags, "outlier"];
  return e;
}
