import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * ffmpeg from the ffmpeg-static package, resolved by path (not imported) so Next.js never tries to bundle it.
 * FFMPEG_PATH overrides.
 */
export function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const p = path.join(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );
  if (!fs.existsSync(p)) throw new Error("ffmpeg not found: run pnpm install (ffmpeg-static) or set FFMPEG_PATH");
  return p;
}

export function ffmpeg(args: string[], o: { timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath(),
      ["-hide_banner", "-nostdin", ...args],
      { maxBuffer: 64 * 1024 * 1024, timeout: o.timeoutMs ?? 180_000 },
      (err, stdout, stderr) => {
        if (err && !(args.includes("-f") && args.includes("null")))
          reject(new Error(`ffmpeg failed: ${stderr.split("\n").slice(-4).join(" ")}`));
        else resolve({ stdout, stderr });
      },
    );
  });
}

export interface MediaInfo {
  durationSec: number;
  width?: number;
  height?: number;
  hasAudio: boolean;
}

export async function probe(file: string): Promise<MediaInfo> {
  const { stderr } = await new Promise<{ stderr: string }>((resolve) => {
    execFile(ffmpegPath(), ["-hide_banner", "-i", file], (_e, _o, stderr) => resolve({ stderr }));
  });
  const d = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const v = stderr.match(/Video: [^\n]*?, (\d{2,5})x(\d{2,5})/);
  return {
    durationSec: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0,
    width: v ? Number(v[1]) : undefined,
    height: v ? Number(v[2]) : undefined,
    hasAudio: /Stream #[^\n]*Audio:/.test(stderr),
  };
}

/** Scene cut times (seconds) where the frame-difference score exceeds `threshold`. */
export async function detectScenes(file: string, threshold = 0.3): Promise<number[]> {
  const { stderr } = await ffmpeg([
    "-i",
    file,
    "-an",
    "-filter:v",
    `select='gt(scene,${threshold})',showinfo`,
    "-f",
    "null",
    "-",
  ]);
  const cuts = [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  return [...new Set(cuts.map((c) => Math.round(c * 100) / 100))].sort((a, b) => a - b);
}

/** Sample times: every 0.25 s in the first 3 s (the hook), then the middle of each scene, capped at `max`. */
export function sampleTimes(durationSec: number, cuts: number[], max = 20, everySec?: number): number[] {
  const hook = [];
  for (let t = 0; t < Math.min(3, durationSec); t += 0.25) hook.push(Math.round(t * 100) / 100);
  let rest: number[];
  if (everySec) {
    // no reliable cuts (continuous take): sample evenly after the hook
    rest = [];
    for (let t = 3 + everySec / 2; t < durationSec; t += everySec) rest.push(Math.round(t * 100) / 100);
  } else {
    const bounds = [0, ...cuts, durationSec];
    rest = bounds
      .slice(0, -1)
      .map((x, i) => Math.round(((x + bounds[i + 1]) / 2) * 100) / 100)
      .filter((t) => t > 3);
  }
  const all = [...hook.filter((_, i) => i % (rest.length > 8 ? 2 : 1) === 0), ...rest];
  if (all.length <= max) return all;
  const step = all.length / max;
  return Array.from({ length: max }, (_, i) => all[Math.floor(i * step)]);
}

export async function extractFrame(file: string, t: number, out: string, width = 360): Promise<string> {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await ffmpeg(["-y", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "4", out]);
  return out;
}

export async function extractAudio(file: string, out: string): Promise<string | null> {
  const info = await probe(file);
  if (!info.hasAudio) return null;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await ffmpeg(["-y", "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", out]);
  return out;
}
