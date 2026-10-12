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
