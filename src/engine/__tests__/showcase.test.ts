import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/engine/db/client";
import { buildFlagship } from "@/engine/flagship";
import { exportShowcase, importShowcase } from "@/engine/live/showcase";
import { getConcept, getRun, listConcepts, listEvidence, listPacksByRun } from "@/engine/repo";
import { seed } from "@/engine/seed";
import { packZip } from "@/engine/services/packs";
import { freshDb, runToEnd } from "@/engine/test-utils";

let db: Db;
let runId: string;
beforeAll(async () => {
  process.env.ASSETS_DIR = path.join(os.tmpdir(), `nexus-show-${Date.now()}`);
  process.env.SHOWCASE_DIR = path.join(process.env.ASSETS_DIR, "showcase-json");
  process.env.RENDER_DIR = path.join(process.env.ASSETS_DIR, "renders");
  process.env.MANUS_WAIT_SEC = "1";
  db = await freshDb();
  await seed(db);
  runId = await runToEnd(db, "brand_dynova");
  const remake = (await listConcepts(db, runId)).find((c) => c.blueprintId)!;
  await buildFlagship(db, remake.id);
});

// exports go to temp dirs only: never overwrite the real fixtures or docs/renders
afterAll(() => {
  delete process.env.SHOWCASE_DIR;
  delete process.env.RENDER_DIR;
});

describe("showcase export/import", () => {
  it("round-trips a finished run with its flagship video into a fresh database", async () => {
    const file = await exportShowcase(db, runId);
    const bundle = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(bundle.assets).toHaveLength(1);
    expect(bundle.assets[0].url).toBe("/api/assets/showcase/dynova-flagship.mp4");
    const db2 = await freshDb();
    await seed(db2);
    // seed imported it already (the file is in place); importing again is a no-op
    expect(await importShowcase(db2, bundle)).toBe(false);
    expect((await getRun(db2, runId))?.dataset).toBe("live_recorded");
    expect((await listConcepts(db2, runId)).length).toBe(bundle.concepts.length);
    // demo evidence never travels as "real"
    expect((await listEvidence(db2, runId)).every((e) => !e.demo)).toBe(true);
    expect(fs.existsSync(path.join(process.env.ASSETS_DIR!, "showcase/dynova-flagship.mp4"))).toBe(true);
    // the flagship's pack zips with the video on the new machine too
    const remake = (await listConcepts(db2, runId)).find((c) => c.blueprintId)!;
    const pack = (await listPacksByRun(db2, runId)).find((p) => p.conceptId === remake.id && p.videoAssetId);
    expect(pack).toBeTruthy();
    expect((await packZip(db2, pack!.id)).files).toContain("video.mp4");
  });

  it("a database that imported an older export of the run picks up the newer flagship", async () => {
    const file = await exportShowcase(db, runId);
    const bundle = JSON.parse(fs.readFileSync(file, "utf8"));
    const remakeId = bundle.assets[0].conceptId as string;
    // the older export: same run, no flagship asset yet, the remake pointing at nothing
    const older = {
      ...bundle,
      assets: [],
      concepts: bundle.concepts.map((c: { id: string }) => (c.id === remakeId ? { ...c, videoAssetId: undefined } : c)),
    };
    const db2 = await freshDb();
    expect(await importShowcase(db2, older)).toBe(true);
    expect((await getConcept(db2, remakeId))?.videoAssetId).toBeUndefined();
    expect(await importShowcase(db2, bundle)).toBe(true);
    expect((await getConcept(db2, remakeId))?.videoAssetId).toBe(bundle.assets[0].id);
    expect(await importShowcase(db2, bundle)).toBe(false);
  });
});
