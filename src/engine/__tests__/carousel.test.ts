import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { accentFor, CH, CW, renderCarousel } from "@/engine/video/carousel";

describe("carousel renderer", () => {
  it("renders 1080x1350 slides with the headline centred on x = 540", async () => {
    const dir = path.join(os.tmpdir(), `nexus-carousel-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    const bg = path.join(dir, "bg.png");
    await sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#3A6EA5" } })
      .png()
      .toFile(bg);
    const brand = { name: "Test", dossier: { visual: { colors: ["#C07848", "#FFF0E0"] } } };
    const r = await renderCarousel(
      [
        { headline: "Your dog is not being dramatic", body: ["One short line"], bg },
        { headline: "Start here", accentWord: "here", bg, cta: { url: "example.com" } },
      ],
      brand,
      dir,
    );
    expect(r.slides).toHaveLength(2);
    for (const s of r.slides) {
      const m = await sharp(s.file).metadata();
      expect([m.width, m.height]).toEqual([CW, CH]);
      // layout bounds from the glyph boxes
      expect(Math.abs((s.headline.x1 + s.headline.x2) / 2 - CW / 2)).toBeLessThan(3);
    }
    expect(fs.existsSync(r.strip)).toBe(true);

    // pixels: the white headline ink in its rows is symmetric about the centre (the gradient is vertical only)
    const h = r.slides[0]!.headline;
    const { data, info } = await sharp(r.slides[0]!.file).raw().toBuffer({ resolveWithObject: true });
    let minX = CW;
    let maxX = 0;
    for (let y = Math.max(0, Math.floor(h.y1)); y < Math.min(CH, Math.ceil(h.y2)); y++)
      for (let x = 0; x < CW; x++) {
        const i = (y * info.width + x) * info.channels;
        if (data[i]! > 235 && data[i + 1]! > 235 && data[i + 2]! > 235) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
    expect(maxX).toBeGreaterThan(minX);
    expect(Math.abs((minX + maxX) / 2 - CW / 2)).toBeLessThan(4);
  });

  it("lightens a dark palette accent so it reads on the dark gradient", () => {
    expect(accentFor(["#C07848"])).toBe("#C07848");
    expect(accentFor(["#000030", "#6048A8"])).not.toBe("#000030");
  });
});
