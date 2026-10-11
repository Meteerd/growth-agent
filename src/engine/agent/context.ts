import type { Brand, DemoRunBundle, Phase, Run, RunEvent } from "@/contracts";
import type { Db } from "../db/client";
import { throwIfCancelled } from "../jobs/runner";
import { appendEvent, getBrand, getRun } from "../repo";
import { demoBundleFor } from "./demo";

export interface PhaseCtx {
  db: Db;
  run: Run;
  brand: Brand;
  signal: AbortSignal;
  /** seeded brands: demo data for this run (ids scoped to it); null for brands created at runtime */
  demo: DemoRunBundle | null;
  phase: Phase;
  emit: (
    type: RunEvent["type"],
    title: string,
    extra?: Partial<Pick<RunEvent, "detail" | "refId" | "costUsd" | "data">>,
  ) => Promise<RunEvent>;
  check: () => void;
  /** reload brand after dossier changes */
  refreshBrand: () => Promise<Brand>;
}

export async function makeCtx(
  db: Db,
  runId: string,
  signal: AbortSignal,
): Promise<Omit<PhaseCtx, "phase" | "emit"> & { forPhase: (p: Phase) => PhaseCtx }> {
  const run = await getRun(db, runId);
  if (!run) throw new Error(`Run ${runId} not found`);
  const brand = await getBrand(db, run.brandId);
  if (!brand) throw new Error(`Brand ${run.brandId} not found`);
  const base = {
    db,
    run,
    brand,
    signal,
    demo: demoBundleFor(brand.slug, run.id),
    check: () => throwIfCancelled(signal),
    refreshBrand: async () => {
      const b = await getBrand(db, run.brandId);
      if (b) base.brand = b;
      return base.brand;
    },
  };
  const forPhase = (phase: Phase): PhaseCtx => {
    const ctx: PhaseCtx = {
      ...base,
      get brand() {
        return base.brand;
      },
      phase,
      emit: (type, title, extra = {}) => appendEvent(db, { runId, phase, type, title, ...extra }),
    };
    return ctx;
  };
  return { ...base, forPhase };
}
