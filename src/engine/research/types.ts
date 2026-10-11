import type { Brand, Evidence, EvidenceSource } from "@/contracts";
import type { Db } from "../db/client";

export interface SourceCtx {
  db: Db;
  runId: string;
  brand: Brand;
  signal?: AbortSignal;
  /** demo evidence for this brand (from its demo bundle); empty for runtime brands */
  demoEvidence: Evidence[];
  /** items per source (small caps tonight) */
  limit: number;
}

export interface SourceResult {
  source: EvidenceSource;
  items: Evidence[];
  mode: "live" | "demo";
  usd: number;
  note?: string;
  /** e.g. Manus task url */
  link?: string;
}

let counter = 0;
export function liveEvidenceId(ctx: SourceCtx, source: string): string {
  counter = (counter + 1) % 100000;
  return `ev_${ctx.brand.slug}_${ctx.runId.slice(-6)}_${source}_${Date.now().toString(36)}${counter}`;
}

export function baseEvidence(ctx: SourceCtx, source: EvidenceSource, kind: Evidence["kind"], title: string): Evidence {
  return {
    id: liveEvidenceId(ctx, source),
    brandId: ctx.brand.id,
    runId: ctx.runId,
    source,
    kind,
    title: title.slice(0, 300) || "(untitled)",
    metrics: {},
    tags: [],
    capturedAt: new Date().toISOString(),
    demo: false,
  };
}

export const demoFor = (ctx: SourceCtx, ...sources: EvidenceSource[]) =>
  ctx.demoEvidence.filter((e) => sources.includes(e.source));

export const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};
export const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
