import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/engine/db/client";
import { prepareDemoMedia } from "@/engine/demo-media";
import { probe } from "@/engine/media/ffmpeg";
import { getAsset, getConcept } from "@/engine/repo";
import { seed } from "@/engine/seed";
import { freshDb } from "@/engine/test-utils";
import { urlToFile } from "@/engine/video/files";

let db: Db;
beforeAll(async () => {
  process.env.ASSETS_DIR = path.join(os.tmpdir(), `nexus-demo-media-${Date.now()}`);
  db = await freshDb();
  await seed(db);
});

describe("demo media on a fresh clone (Lane B request)", () => {
  it("builds the seeded runs' keyframes and review videos, idempotently", async () => {
    const made = await prepareDemoMedia(db);
    expect(made).toBeGreaterThanOrEqual(8);
    const c = await getConcept(db, "concept_hound_1");
    for (const s of c!.shots)
      expect(fs.existsSync(urlToFile((await getAsset(db, s.keyframeAssetId!))!.url)!)).toBe(true);
    const r2 = await getAsset(db, "asset_concept_hound_1_video_r2");
    const info = await probe(urlToFile(r2!.url)!);
    expect([info.width, info.height]).toEqual([1080, 1920]);
    expect(await prepareDemoMedia(db)).toBe(0);
    // renders 8 demo videos: under a full parallel `pnpm check` on a hot laptop this needs more than the default 120 s
  }, 300_000);
});
