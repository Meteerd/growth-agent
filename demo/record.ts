// Backup pitch video: records the 2-minute auto-play of the demo path (presentation mode) at 1440x900 to an MP4.
// Needs the app running (pnpm dev). Usage: pnpm exec tsx demo/record.ts [baseUrl]   (default http://localhost:3000)
// Output: demo/recordings/pitch-<HHMM>.mp4 and demo/recordings/pitch-latest.mp4 (git-ignored). Silent: Mete talks over it.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import ffmpegPath from "ffmpeg-static";
import { DEMO_PATH } from "../src/lib/client/demoPath";

const BASE = process.argv[2] ?? "http://localhost:3000";
const FPS = 30;
const OUT_DIR = path.resolve("demo/recordings");
const stamp = new Date().toTimeString().slice(0, 5).replace(":", "");
const out = path.join(OUT_DIR, `pitch-${stamp}.mp4`);
const total = DEMO_PATH.reduce((s, x) => s + x.secs, 0);

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  // warm every route so the recording never shows a first compile
  for (const s of DEMO_PATH) await page.request.get(`${BASE}${s.href}`);
  await page.goto(`${BASE}${DEMO_PATH[0].href}?present=1`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  // CDP screencast -> ffmpeg (sharp H.264); the newest frame is written on a fixed 30 fps clock
  const ff = spawn(
    ffmpegPath as unknown as string,
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-"]
      .concat(["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"])
      .concat([out]),
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const cdp = await page.context().newCDPSession(page);
  let latest: Buffer | undefined;
  cdp.on("Page.screencastFrame", (f) => {
    latest = Buffer.from(f.data, "base64");
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1440, maxHeight: 900 });
  const t0 = Date.now();
  let frames = 0;
  const clock = setInterval(() => {
    // catch up if the event loop was busy, so the video keeps real time
    const due = Math.floor(((Date.now() - t0) / 1000) * FPS);
    while (latest && frames < due) {
      ff.stdin.write(latest);
      frames++;
    }
  }, 1000 / FPS);

  await page.keyboard.press("0"); // presentation mode: start the 2-minute auto-play
  await page.waitForTimeout((total + 3) * 1000);

  clearInterval(clock);
  await cdp.send("Page.stopScreencast").catch(() => {});
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  fs.copyFileSync(out, path.join(OUT_DIR, "pitch-latest.mp4"));
  const mb = (fs.statSync(out).size / 1e6).toFixed(1);
  console.log(`recorded ${(frames / FPS).toFixed(1)} s, ${mb} MB -> ${path.relative(process.cwd(), out)}`);
  if (frames / FPS < total) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
