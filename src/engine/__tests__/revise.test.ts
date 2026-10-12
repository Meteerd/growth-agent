import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeSyntheticVideo } from "@/engine/media/synthetic";
import { freshDb, runToEnd } from "@/engine/test-utils";
import { fileToUrl } from "@/engine/video/files";

describe("A19 revise by chat", () => {
  it("a captions-only revision makes a new version that reuses every clip byte for byte; choose switches the video", async () => {
    process.env.ASSETS_DIR = path.join(os.tmpdir(), `nexus-revise-${Date.now()}`);
    const db = await freshDb();
    const { seed } = await import("@/engine/seed");
    await seed(db);
    const repo = await import("@/engine/repo");
    const { revise, ensureVersions, chooseVersion } = await import("@/engine/revise");
    const { renderConcept } = await import("@/engine/services/concepts");
    const brand = (await repo.listBrands(db)).find((b) => b.slug === "hound")!;
    const runId = await runToEnd(db, brand.id);
    const c0 = (await repo.listConcepts(db, runId)).find((c) => c.shots.length > 1)!;
    // give shot 0 a real clip, then render the original cut (v1)
    const clipFile = await makeSyntheticVideo(path.join(process.env.ASSETS_DIR, "clips"), [
      { durationSec: 6, color: "#C07848", text: "" },
    ]);
    const clipId = "asset_test_clip0";
    await repo.upsertAsset(db, {
      id: clipId,
      brandId: c0.brandId,
      conceptId: c0.id,
      kind: "clip",
      url: fileToUrl(clipFile.file),
      provider: "fal",
      model: "test",
      costUsd: 0,
      demo: false,
      createdAt: new Date().toISOString(),
      shotIdx: 0,
    });
    await repo.upsertConcept(db, {
      ...c0,
      shots: c0.shots.map((s) => (s.idx === 0 ? { ...s, clipAssetId: clipId } : s)),
    });
    const { asset: v1asset } = await renderConcept(db, c0.id, "draft", { label: "v1" });
    const versions = await ensureVersions(db, (await repo.getConcept(db, c0.id))!);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.chosen).toBe(true);

    // demo planner: captions layer only
    const r = await revise(db, c0.id, "make the captions bigger");
    expect(r.status).toBe("queued");
    if (r.status !== "queued") return;
    expect(r.plan.layers).toEqual(["captions"]);
    let v2 = (await repo.listRenderVersions(db, c0.id)).find((v) => v.id === r.renderId)!;
    for (let i = 0; i < 240 && v2.status === "rendering"; i++) {
      await new Promise((res) => setTimeout(res, 500));
      v2 = (await repo.listRenderVersions(db, c0.id)).find((v) => v.id === r.renderId)!;
    }
    expect(v2.status).toBe("ready");
    expect(v2.version).toBe(2);
    expect(v2.parentId).toBe(versions[0]!.id);
    // the clip is reused (same asset), and the concept still shows the chosen v1 until v2 is picked
    const after = (await repo.getConcept(db, c0.id))!;
    expect(after.shots[0]!.clipAssetId).toBe(clipId);
    expect(v2.shots[0]!.clipUrl).toBe(fileToUrl(clipFile.file));
    expect(after.videoAssetId).toBe(v1asset.id);
    const chosen = await chooseVersion(db, c0.id, v2.id);
    expect(chosen.chosen).toBe(true);
    expect((await repo.getConcept(db, c0.id))!.videoAssetId).toBe(v2.assetId);
    expect((await repo.listRenderVersions(db, c0.id)).filter((v) => v.chosen)).toHaveLength(1);
  }, 300_000);
});
