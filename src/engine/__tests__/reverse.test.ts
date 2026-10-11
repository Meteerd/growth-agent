import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getBlueprints } from "@/app/api/runs/[id]/blueprints/route";
import { Blueprint as BlueprintSchema } from "@/contracts";
import { makeCtx } from "@/engine/agent/context";
import { reverseEngineer, syntheticBlueprint } from "@/engine/agent/phases/reverse";
import type { Db } from "@/engine/db/client";
import { detectScenes, sampleTimes } from "@/engine/media/ffmpeg";
import { makeSyntheticVideo } from "@/engine/media/synthetic";
import { listBlueprints, upsertBlueprint, upsertEvidence } from "@/engine/repo";
import { createRun } from "@/engine/runs";
import { seed } from "@/engine/seed";
import { ctx, freshDb, req } from "@/engine/test-utils";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  await seed(db);
  process.env.ASSETS_DIR = path.join(os.tmpdir(), `nexus-assets-${Date.now()}`);
});

describe("reverse-engineering engine", () => {
  it("detects the scene cuts of the synthetic video within +/- 0.2 s", async () => {
    const v = await makeSyntheticVideo(path.join(os.tmpdir(), `nexus-synth-${Date.now()}`));
    const cuts = await detectScenes(v.file);
    expect(cuts).toHaveLength(v.cuts.length);
    cuts.forEach((c, i) => {
      expect(Math.abs(c - v.cuts[i])).toBeLessThanOrEqual(0.2);
    });
  }, 60_000);

  it("samples densely in the hook", () => {
    const t = sampleTimes(14, [2.5, 5.5, 9, 12]);
    expect(t.filter((x) => x < 3).length).toBeGreaterThanOrEqual(6);
    expect(t.length).toBeLessThanOrEqual(20);
  });

  it("builds a valid blueprint of the synthetic video (shot count, hook text) and serves it", async () => {
    const run = await createRun(db, "brand_hound", "research_only");
    const base = await makeCtx(db, run.id, new AbortController().signal);
    const ev = {
      id: "ev_synth_1",
      brandId: "brand_hound",
      runId: run.id,
      source: "tiktok" as const,
      kind: "video" as const,
      title: "Synthetic test video (generated locally)",
      metrics: { views: 1000, outlierScore: 5 },
      tags: ["synthetic"],
      capturedAt: new Date().toISOString(),
      demo: true,
    };
    await upsertEvidence(db, [ev]);
    const bp = await syntheticBlueprint(base.forPhase("reverse_engineer"), ev);
    BlueprintSchema.parse(bp);
    expect(bp.shots).toHaveLength(5);
    expect(bp.hook.onScreenText).toBe("I filmed my dog when I left");
    expect(bp.shots[0].t0).toBe(0);
    expect(bp.shots.at(-1)?.t1).toBeCloseTo(14, 0);
    expect(bp.shots.at(-1)?.purpose).toBe("cta");
    expect(bp.frames.length).toBeGreaterThan(5);
    await upsertBlueprint(db, bp);
    const res = await getBlueprints(req(`/api/runs/${run.id}/blueprints`), ctx({ id: run.id }));
    const list = (await res.json()) as unknown[];
    expect(list).toHaveLength(1);
    expect(BlueprintSchema.parse(list[0]).id).toBe(bp.id);
  }, 60_000);

  it("demo phase writes the brand's recorded blueprint for seeded brands", async () => {
    const run = await createRun(db, "brand_aclinic", "research_only");
    const base = await makeCtx(db, run.id, new AbortController().signal);
    await reverseEngineer(base.forPhase("reverse_engineer"));
    const bps = await listBlueprints(db, run.id);
    expect(bps.length).toBeGreaterThanOrEqual(1);
    expect(bps[0].runId).toBe(run.id);
  });
});
