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
    // during the clip, the caption band (upper third) must show the native caption: white fill and black outline
    const { captionPhrases, captionTop } = await import("@/engine/video/compose");
    const ph = captionPhrases("Caption on a clip", 3)[0]!;
    const top = captionTop("upper", ph);
    const f = await extractFrame(out, 1.5, path.join(dir, "f.png"), 1080);
    const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
    let min = 255;
    let max = 0;
    for (let y = top; y < top + ph.lines.length * ph.lh; y += 2)
      for (let x = 100; x < 900; x += 2) {
        const i = (y * info.width + x) * info.channels;
        const lum = (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
        min = Math.min(min, lum);
        max = Math.max(max, lum);
      }
    expect(max).toBeGreaterThan(230);
    expect(min).toBeLessThan(40);
    expect((await probe(out)).hasAudio).toBe(true);
    expect(fs.existsSync(out)).toBe(true);
  }, 60_000);
});

describe("native captions (A18)", () => {
  it("never truncates: a long line becomes consecutive 2-line phrases that cover the shot", async () => {
    const { captionPhrases } = await import("@/engine/video/compose");
    const t =
      "4 kroky: dotazník · konzultácia s lekárom · ePredpis, ak je vhodný · pravidelné kontroly so starostlivým tímom a odpovede na otázky";
    const ph = captionPhrases(t, 6);
    expect(ph.length).toBeGreaterThan(1);
    expect(ph.every((p) => p.lines.length <= 2)).toBe(true);
    expect(ph.map((p) => p.lines.join(" ")).join(" ")).toBe(t);
    expect(ph[0]!.t0).toBe(0);
    expect(ph.at(-1)!.t1).toBe(6);
    for (let i = 1; i < ph.length; i++) expect(ph[i]!.t0).toBeCloseTo(ph[i - 1]!.t1);
    const short = captionPhrases("Short hook", 3);
    expect(short).toHaveLength(1);
    expect(short[0]!.size).toBe(76);
    expect(captionPhrases("Starostlivosť o váhu bez čakárne 🩺", 3)[0]!.lines.join(" ")).toBe(
      "Starostlivosť o váhu bez čakárne",
    );
    expect(captionPhrases("", 3)).toEqual([]);
  });

  it("every region stays outside the TikTok/Reels UI zones", async () => {
    const { captionPhrases, captionTop, UI_SAFE } = await import("@/engine/video/compose");
    for (const text of ["Short", "A caption that needs two full lines on the screen to be read"])
      for (const region of ["upper", "middle", "lower"] as const) {
        const ph = captionPhrases(text, 3)[0]!;
        const top = captionTop(region, ph);
        expect(top).toBeGreaterThanOrEqual(UI_SAFE.top);
        expect(top + ph.lines.length * ph.lh).toBeLessThanOrEqual(UI_SAFE.bottom);
      }
    expect(UI_SAFE.bottom).toBeLessThanOrEqual(1920 * 0.8);
    expect(UI_SAFE.right).toBeLessThanOrEqual(1080 * 0.85);
    const up = captionPhrases("Hook", 2)[0]!;
    expect(captionTop("upper", up)).toBeLessThan(captionTop("middle", up));
    expect(captionTop("middle", up)).toBeLessThan(captionTop("lower", up));
  });
});
