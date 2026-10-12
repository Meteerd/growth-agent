import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { falLocked } from "@/engine/providers/fal";
import { animateShot } from "@/engine/providers/motion";
import { freshDb } from "@/engine/test-utils";

afterEach(() => {
  (globalThis as { __falLocked?: string }).__falLocked = undefined;
});

describe("motion fallback", () => {
  it("in demo mode no provider is called and the still is kept (null)", async () => {
    const db = await freshDb();
    const img = path.join(os.tmpdir(), `nexus-motion-${Date.now()}.png`);
    await sharp({ create: { width: 64, height: 64, channels: 3, background: "#888" } })
      .png()
      .toFile(img);
    const why: string[] = [];
    const r = await animateShot(db, {
      imageFile: img,
      prompt: "x",
      durationSec: 4,
      out: `${img}.mp4`,
      onFallback: (w) => void why.push(w),
    });
    expect(r).toBeNull();
    expect(why).toEqual([]);
  });

  it("a locked fal account is skipped entirely", async () => {
    (globalThis as { __falLocked?: string }).__falLocked = "account balance exhausted";
    expect(falLocked()).toContain("exhausted");
    const db = await freshDb();
    const img = path.join(os.tmpdir(), `nexus-motion2-${Date.now()}.png`);
    await sharp({ create: { width: 64, height: 64, channels: 3, background: "#888" } })
      .png()
      .toFile(img);
    const r = await animateShot(db, { imageFile: img, prompt: "x", durationSec: 4, out: `${img}.mp4` });
    expect(r).toBeNull();
  });
});
