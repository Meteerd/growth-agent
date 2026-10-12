import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { ffmpeg } from "@/engine/media/ffmpeg";
import { shakeScore } from "@/engine/media/motion-check";
import { stillMove } from "@/engine/video/compose";

// half-size frames keep the test light; the filters are the same ones compose uses at 1080x1920
const w = 540;
const h = 960;
const dir = path.join(os.tmpdir(), `nexus-shake-${Date.now()}`);
let still: string;

beforeAll(async () => {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const noise = Buffer.alloc(w * h * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1 > 0 ? 220 : 30;
  still = path.join(dir, "still.png");
  await sharp(noise, { raw: { width: w, height: h, channels: 3 } })
    .blur(1.2)
    .png()
    .toFile(still);
});

async function render(filter: string, out: string) {
  await ffmpeg(["-y", "-i", still, "-vf", `${filter},format=yuv420p`, "-frames:v", "60", out]);
  return out;
}

describe("A18 still camera moves do not shake", () => {
  it("the old 1.12x zoompan shakes; the final 8x oversampled, eased move does not", async () => {
    const old = await render(
      `scale=${Math.round(w * 1.12)}:${Math.round(h * 1.12)},zoompan=z='min(zoom+0.0009,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=60:s=${w}x${h}:fps=30`,
      path.join(dir, "old.mp4"),
    );
    const smooth = await render(stillMove(60, "in", w, h, 8), path.join(dir, "new.mp4"));
    const before = await shakeScore(old);
    const after = await shakeScore(smooth);
    console.log(`shake reversals/s: old ${before}, new ${after}`);
    expect(before).toBeGreaterThan(2);
    expect(after).toBe(0);
  });
});

describe("A18 shake is measured on the camera, not the subject", () => {
  const loop = async (filter: string, out: string) => {
    await ffmpeg(["-y", "-loop", "1", "-t", "2", "-r", "30", "-i", still, "-vf", `${filter},format=yuv420p`, out]);
    return out;
  };
  it("a subject moving back and forth in the centre is not shake; the whole frame jittering is", async () => {
    // a bright square wobbling left/right every frame over a static background
    const subject = await loop(
      `drawbox=x='${w / 2 - 80}+12*mod(floor(t*30),2)':y=${h / 2 - 80}:w=160:h=160:color=white:t=fill`,
      path.join(dir, "subject.mp4"),
    );
    const jitter = await loop(
      `scale=${w + 8}:${h + 8},crop=${w}:${h}:'4+2*mod(n,2)':'4+2*mod(n,2)'`,
      path.join(dir, "jitter.mp4"),
    );
    expect(await shakeScore(subject)).toBe(0);
    expect(await shakeScore(jitter)).toBeGreaterThan(2);
  });
});

describe("A18 final stills move without zoompan", () => {
  it("the per-frame affine move never reverses direction", async () => {
    const { stillMoveFrames } = await import("@/engine/video/compose");
    const pattern = await stillMoveFrames(still, 60, "in", path.join(dir, "affine"));
    const out = path.join(dir, "affine.mp4");
    await ffmpeg(["-y", "-framerate", "30", "-i", pattern, "-vf", "format=yuv420p", out]);
    expect(await shakeScore(out)).toBe(0);
  });
});
