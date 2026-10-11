import { type ChannelScores, SCORE_AXES } from "@/contracts";

/** The orbit map is laid out in a fixed 760 x 760 space and scaled to its container. */
export const VIEW = 760;
export const CENTER = VIEW / 2;
export const R_CORE = 64; // brand core edge: a score of 100 would sit here
export const R_OUTER = 284; // outermost score ring
export const R_NOT_NOW = 330; // rejected channels orbit outside the score rings
export const TAU = Math.PI * 2;

export type Point = { x: number; y: number };

/** Score rings to draw, outermost last. Four 10-point rings when every pick scores 60+, else 20-point steps. */
export function ringTicks(minScore: number): number[] {
  return minScore >= 60 ? [90, 80, 70, 60] : [90, 70, 50, 30];
}

/** Closer is better: 100 sits at the core edge, the outer tick on the outer ring; scores are clamped to that band. */
export function orbitRadius(score: number, outerTick: number, rCore = R_CORE, rOuter = R_OUTER): number {
  const s = Math.min(100, Math.max(outerTick, score));
  return rCore + ((100 - s) / (100 - outerTick)) * (rOuter - rCore);
}

/** Body diameter by priority: priority 1 is the largest, the last pick the smallest. */
export function bodySize(priority: number, count: number, max = 112, min = 64): number {
  if (count <= 1) return max;
  const t = (Math.min(Math.max(priority, 1), count) - 1) / (count - 1);
  return Math.round(max - t * (max - min));
}

/** Stable start angle in [0, TAU) from a string (FNV-1a), so a brand's map never reshuffles between renders. */
export function seedAngle(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) / 0x100000000) * TAU;
}

/** n angles spread evenly around the circle, starting at `offset`. */
export function spreadAngles(n: number, offset = 0): number[] {
  return Array.from({ length: n }, (_, i) => (offset + (i * TAU) / Math.max(n, 1)) % TAU);
}

export function polar(r: number, theta: number, c: Point = { x: CENTER, y: CENTER }): Point {
  return { x: c.x + r * Math.cos(theta), y: c.y + r * Math.sin(theta) };
}

/** Radar vertices: axis i points at -90deg + i * 60deg, each pulled out by value/100 of R. */
export function radarPoints(scores: ChannelScores, R: number, c: Point): Point[] {
  return SCORE_AXES.map((axis, i) => polar((R * Math.min(100, Math.max(0, scores[axis]))) / 100, radarAngle(i), c));
}
export const radarAngle = (i: number) => -Math.PI / 2 + (i * TAU) / SCORE_AXES.length;

/** Closed SVG path through the points. */
export const toPath = (pts: Point[]) =>
  `${pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")} Z`;

/** Ease used for the entrance sweep, matching --ease-out. */
export const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** New order with the item at `from` moved to `to` (both clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  const t = Math.min(Math.max(to, 0), out.length - 1);
  const [item] = out.splice(from, 1);
  out.splice(t, 0, item);
  return out;
}

/** First sentence of a rationale, for compact cards. */
export function firstSentence(text: string): string {
  return text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
}
