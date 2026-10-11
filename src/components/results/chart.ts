import type { MetricSnapshot } from "@/contracts";

// Pure helpers for the Results screen: counters, the views series, scales and SVG paths.

export const METRICS = ["views", "likes", "comments", "shares", "saves", "follows"] as const;
export type Metric = (typeof METRICS)[number];
export type Counters = Partial<Record<Metric, number>>;

export const byTime = (snaps: MetricSnapshot[]) =>
  [...snaps].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));

/** Per metric, the newest snapshot that recorded it. A metric nobody entered stays undefined, never 0. */
export function latestCounters(snaps: MetricSnapshot[]): Counters {
  const out: Counters = {};
  for (const s of byTime(snaps)) for (const m of METRICS) if (s[m] != null) out[m] = s[m];
  return out;
}

/** Sums each metric over the packs that recorded it; a metric no pack recorded stays undefined. */
export function sumCounters(list: Counters[]): Counters {
  const out: Counters = {};
  for (const c of list) for (const m of METRICS) if (c[m] != null) out[m] = (out[m] ?? 0) + (c[m] as number);
  return out;
}

/** t = ms since posting (clamped at 0), v = views. Snapshots without a view count are not points. */
export type Point = { id: string; t: number; v: number; at: string };

export function viewSeries(snaps: MetricSnapshot[], postedAt?: string): Point[] {
  const sorted = byTime(snaps).filter((s) => s.views != null);
  const t0 = Date.parse(postedAt ?? sorted[0]?.capturedAt ?? "");
  return sorted.map((s) => ({
    id: s.id,
    t: Number.isFinite(t0) ? Math.max(0, Date.parse(s.capturedAt) - t0) : 0,
    v: s.views as number,
    at: s.capturedAt,
  }));
}

/** Smallest clean axis top >= n whose half is also a whole number (10, 20, 40, 50, 60, 80, 100, ...). */
export function niceMax(n: number) {
  if (!(n > 10)) return 10;
  const mag = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 4, 5, 6, 8, 10].find((s) => s * mag >= n) ?? 10;
  return step * mag;
}

export const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

type XY = { x: number; y: number };
const r = (n: number) => Math.round(n * 10) / 10;

export const linePath = (pts: XY[]) => pts.map((p, i) => `${i ? "L" : "M"}${r(p.x)} ${r(p.y)}`).join(" ");

export const areaPath = (pts: XY[], baseY: number) =>
  pts.length < 2 ? "" : `${linePath(pts)} L${r(pts.at(-1)!.x)} ${r(baseY)} L${r(pts[0].x)} ${r(baseY)} Z`;

export function nearestIndex(xs: number[], x: number) {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
  return best;
}

const one = (n: number) => String(n < 10 ? Math.round(n * 10) / 10 : Math.round(n));

/** Elapsed time for axis labels: "40 s", "12 min", "1.5 h", "3 d". */
export function formatElapsed(ms: number) {
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 172_800) return `${one(s / 3600)} h`;
  return `${one(s / 86_400)} d`;
}

/** postedUrl is typed by the operator: only http(s) becomes a link (no javascript: or data: hrefs). */
export function safeHttpUrl(raw?: string) {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u : undefined;
  } catch {
    return undefined;
  }
}
