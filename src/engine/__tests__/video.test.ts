import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { extractFrame, probe } from "@/engine/media/ffmpeg";
import { makeSyntheticVideo } from "@/engine/media/synthetic";
import { composeAd916 } from "@/engine/video/compose";
import { fileToUrl } from "@/engine/video/files";

describe("Ad916 compositor", () => {
  it("burns the caption over clip shots too (regression) and appends the end card", async () => {
    const dir = path.join(os.tmpdir(), `nexus-video-${Date.now()}`);
    process.env.ASSETS_DIR = dir;
    const v = await makeSyntheticVideo(path.join(dir, "clips"), [{ durationSec: 3, color: "#C07848", text: "" }]);
    const still = path.join(dir, "still.png");
    await sharp({ create: { width: 1080, height: 1920, channels: 3, background: "#A8C048" } })
      .png()
      .toFile(still);
    const out = path.join(dir, "out.mp4");
    const r = await composeAd916(
      {
        shots: [
          { src: fileToUrl(still), clipSrc: fileToUrl(v.file), durationSec: 3, text: "Caption on a clip" },
          { src: fileToUrl(still), durationSec: 2, text: "Caption on a still" },
        ],
        brandName: "Test",
        colors: ["#C07848", "#A8C048", "#D89048", "#FFF0E0"],
        cta: "Learn more",
        endCardSec: 1,
      },
      out,
      path.join(dir, "parts"),
    );
    expect(r.width).toBe(1080);
    expect(Math.abs(r.durationSec - 6)).toBeLessThan(0.2);
    // sample inside the caption box during the clip: it must be the dark caption background, not the clip color
    const f = await extractFrame(out, 1.5, path.join(dir, "f.png"), 1080);
    const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
    const y = 1920 - 470 - 40;
    const x = 200;
    const i = (y * info.width + x) * info.channels;
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    expect(lum).toBeLessThan(90);
    expect((await probe(out)).hasAudio).toBe(true);
    expect(fs.existsSync(out)).toBe(true);
  }, 60_000);
});
