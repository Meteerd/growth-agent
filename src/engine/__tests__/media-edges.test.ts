import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { makeCtx } from "@/engine/agent/context";
import { blueprintFromWatch, watchVideo } from "@/engine/agent/phases/reverse";
import type { Db } from "@/engine/db/client";
import { detectScenes, extractAudio, ffmpeg, probe } from "@/engine/media/ffmpeg";
import { createRun } from "@/engine/runs";
import { seed } from "@/engine/seed";
import { freshDb } from "@/engine/test-utils";

let db: Db;
const dir = path.join(os.tmpdir(), `nexus-media-edges-${Date.now()}`);
beforeAll(async () => {
  process.env.ASSETS_DIR = path.join(dir, "assets");
  fs.mkdirSync(dir, { recursive: true });
  db = await freshDb();
  await seed(db);
});

async function stillVideo(w: number, h: number, sec: number, audio: boolean): Promise<string> {
  const png = path.join(dir, `still_${w}x${h}.png`);
  await sharp({ create: { width: w, height: h, channels: 3, background: "#336699" } })
    .png()
    .toFile(png);
  const out = path.join(dir, `still_${w}x${h}_${audio ? "a" : "n"}.mp4`);
  await ffmpeg([
    "-y",
    "-loop",
    "1",
    "-t",
    String(sec),
    "-i",
    png,
    ...(audio ? ["-f", "lavfi", "-t", String(sec), "-i", "sine=frequency=220"] : []),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    ...(audio ? ["-c:a", "aac", "-shortest"] : ["-an"]),
    out,
  ]);
  return out;
}

describe("media edge cases", () => {
  it("horizontal video with no audio and identical frames: no cuts, no transcript, a valid one-shot 16:9 blueprint", async () => {
    const file = await stillVideo(1280, 720, 6, false);
    const info = await probe(file);
    expect(info.hasAudio).toBe(false);
    expect(await detectScenes(file)).toEqual([]);
    expect(await extractAudio(file, path.join(dir, "none.mp3"))).toBeNull();
    const run = await createRun(db, "brand_hound", "research_only");
    const base = await makeCtx(db, run.id, new AbortController().signal);
    const ctx = base.forPhase("reverse_engineer");
    const w = await watchVideo(ctx, file, "edge_h");
    expect(w.transcript.source).toBe("none");
    const ev = {
      id: "ev_edge",
      brandId: "brand_hound",
      runId: run.id,
      source: "tiktok" as const,
      kind: "video" as const,
      title: "edge",
      metrics: {},
      tags: [],
      capturedAt: "x",
      demo: false,
    };
    const bp = await blueprintFromWatch(ctx, ev, w, { key: "edge_h" });
    expect(bp.aspect).toBe("16:9");
    expect(bp.shots.length).toBeGreaterThanOrEqual(1);
    expect(bp.shots[0].t0).toBe(0);
  }, 60_000);

  it("a corrupted download is rejected cleanly by probe/scene detection", async () => {
    const bad = path.join(dir, "bad.mp4");
    fs.writeFileSync(bad, Buffer.alloc(20_000, 7));
    const info = await probe(bad);
    expect(info.durationSec).toBe(0);
    await expect(detectScenes(bad)).resolves.toBeDefined();
    const run = await createRun(db, "brand_hound", "research_only");
    const base = await makeCtx(db, run.id, new AbortController().signal);
    await expect(watchVideo(base.forPhase("reverse_engineer"), bad, "bad")).rejects.toThrow(/not a playable video/);
  });
});
