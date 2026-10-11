import { makeCtx } from "../agent/context";
import { syntheticBlueprint } from "../agent/phases/reverse";
import type { Db } from "../db/client";
import { listSpend, upsertBlueprint, upsertEvidence } from "../repo";
import { createRun } from "../runs";
import { ensureSeeded } from "../seed";
import { saveFixture } from "./record";

/** Live Claude vision over the locally generated synthetic video (no third-party media). */
export async function smokeBlueprint(db: Db) {
  await ensureSeeded(db);
  const run = await createRun(db, "brand_hound", "research_only");
  const base = await makeCtx(db, run.id, new AbortController().signal);
  const ev = {
    id: `ev_synth_${run.id.slice(-6)}`,
    brandId: "brand_hound",
    runId: run.id,
    source: "tiktok" as const,
    kind: "video" as const,
    title: "Synthetic test video (generated locally, not a real ad)",
    metrics: {},
    tags: ["synthetic"],
    capturedAt: new Date().toISOString(),
    demo: true,
  };
  await upsertEvidence(db, [ev]);
  const bp = await syntheticBlueprint(base.forPhase("reverse_engineer"), ev);
  await upsertBlueprint(db, bp);
  const spend = await listSpend(db, run.id);
  const usd = spend.reduce((a, s) => a + s.usd, 0);
  const file = saveFixture("anthropic", "blueprint_synthetic", { blueprint: bp, spend });
  return {
    mode: bp.demo ? ("demo" as const) : ("live" as const),
    usd,
    file,
    shots: bp.shots.map((s) => `${s.t0}-${s.t1} ${s.purpose}: ${s.onScreenText ?? ""}`),
    hook: bp.hook,
  };
}
