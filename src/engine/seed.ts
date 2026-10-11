import { DEMO_RUNS, SEED_BRANDS } from "@/contracts";
import type { Db } from "./db/client";
import { importRecorded, loadRecorded } from "./live/recorded";
import { getRun, importBundle, insertBrandIfMissing } from "./repo";

/** Idempotent: creates the four brands (never overwrites operator edits) and imports one demo run per brand (skipped if already present). */
export async function seed(db: Db): Promise<{ brandsCreated: number; runsImported: number }> {
  let brandsCreated = 0;
  for (const b of SEED_BRANDS) if (await insertBrandIfMissing(db, b)) brandsCreated++;
  let runsImported = 0;
  for (const bundle of Object.values(DEMO_RUNS)) {
    if (await getRun(db, bundle.run.id)) continue; // keep any state the operator changed during a demo
    await importBundle(db, bundle);
    runsImported++;
  }
  // recorded live research passes (real data) become each brand's latest run
  for (const b of SEED_BRANDS) {
    const rec = loadRecorded(b.slug);
    if (rec && (await importRecorded(db, rec))) runsImported++;
  }
  return { brandsCreated, runsImported };
}

const g = globalThis as unknown as { __nexusSeeded?: Promise<unknown> };

/** Seed once per process on first API use, so `pnpm dev` works on a fresh clone even before `pnpm seed`. */
export function ensureSeeded(db: Db): Promise<unknown> {
  if (!g.__nexusSeeded) g.__nexusSeeded = seed(db);
  return g.__nexusSeeded;
}
