import fs from "node:fs";
import path from "node:path";
import { ffmpeg } from "../media/ffmpeg";

/**
 * A18: real product footage for CTA and screen shots. Playwright opens the brand's own site on a phone-sized
 * viewport (432x768 CSS px at 2.5x = 1080x1920) and films a smooth thumb scroll frame by frame: each frame sets the
 * scroll position on an eased curve and takes a full-resolution screenshot, so the motion is exact and the text is
 * crisp. The "app on screen" shot is the real product, not a generated phone. Output: 30 fps MP4, no audio.
 */
export async function recordSite(
  url: string,
  out: string,
  o: { seconds: number; scrollPx?: number; startY?: number; waitMs?: number } = { seconds: 5 },
): Promise<string> {
  const { chromium } = await import("@playwright/test");
  const frames = `${out}.frames`;
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: 432, height: 768 },
      deviceScaleFactor: 2.5,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => undefined);
    // cookie banners hide the product: accept or close them
    for (const t of [
      "Accept all",
      "Accept",
      "Allow all",
      "I agree",
      "Got it",
      "Súhlasím",
      "Prijať",
      "Kabul et",
      "Tamam",
    ]) {
      const b = page.getByRole("button", { name: t, exact: false }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click({ timeout: 2000 }).catch(() => undefined);
        break;
      }
    }
    // smooth-scroll CSS would fight the per-frame positions
    await page.addStyleTag({ content: "html,body{scroll-behavior:auto!important}" }).catch(() => undefined);
    await page.waitForTimeout(o.waitMs ?? 1500);
    const n = Math.round(o.seconds * 30);
    const y0 = o.startY ?? 0;
    const px = o.scrollPx ?? 700;
    for (let i = 0; i < n; i++) {
      // ease in-out with a short hold at both ends (a thumb flick, then it settles)
      const x = Math.min(1, Math.max(0, (i / (n - 1) - 0.12) / 0.76));
      const e = x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
      await page.evaluate(`window.scrollTo(0, ${(y0 + px * e).toFixed(2)})`);
      await page.screenshot({
        path: path.join(frames, `${String(i).padStart(5, "0")}.jpg`),
        type: "jpeg",
        quality: 90,
      });
    }
    await ctx.close();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await ffmpeg([
      "-y",
      "-framerate",
      "30",
      "-i",
      path.join(frames, "%05d.jpg"),
      "-vf",
      "scale=1080:1920:flags=lanczos,format=yuv420p",
      "-an",
      "-c:v",
      "libx264",
      "-crf",
      "17",
      out,
    ]);
    return out;
  } finally {
    await browser.close();
    fs.rmSync(frames, { recursive: true, force: true });
  }
}
