import { spawn } from "node:child_process";
import { ffmpegPath } from "./ffmpeg";

/**
 * Shake metric for a video segment: per pair of consecutive frames, the integer shift (x, y) of a 256x256 centre
 * crop that best aligns them (sum of absolute differences, search +-3 px). A smooth camera move shifts in one
 * direction or not at all; pixel-rounding jitter flips direction. Returns the direction reversals per second.
 */
export async function shakeScore(file: string, o: { start?: number; durationSec?: number } = {}): Promise<number> {
  const S = 256;
  const R = 3;
  const dur = o.durationSec ?? 2;
  const raw = await new Promise<Buffer>((resolve, reject) => {
    const p = spawn(ffmpegPath(), [
      "-v",
      "error",
      ...(o.start ? ["-ss", String(o.start)] : []),
      "-t",
      String(dur),
      "-i",
      file,
      "-vf",
      `crop=${S}:${S}:(iw-${S})/2:(ih-${S})/2,format=gray`,
      "-f",
      "rawvideo",
      "-",
    ]);
    const chunks: Buffer[] = [];
    p.stdout.on("data", (c: Buffer) => chunks.push(c));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg exit ${code}`))));
  });
  const n = Math.floor(raw.length / (S * S));
  const shifts: [number, number][] = [];
  for (let f = 1; f < n; f++) {
    const a = raw.subarray((f - 1) * S * S, f * S * S);
    const b = raw.subarray(f * S * S, (f + 1) * S * S);
    let best = [0, 0];
    let bestErr = Number.POSITIVE_INFINITY;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        let err = 0;
        for (let y = R; y < S - R; y += 2)
          for (let x = R; x < S - R; x += 2) err += Math.abs(a[y * S + x]! - b[(y + dy) * S + x + dx]!);
        if (err < bestErr) {
          bestErr = err;
          best = [dx, dy];
        }
      }
    shifts.push(best as [number, number]);
  }
  let reversals = 0;
  for (const axis of [0, 1]) {
    let last = 0;
    for (const s of shifts) {
      const v = Math.sign(s[axis]!);
      if (v && last && v !== last) reversals++;
      if (v) last = v;
    }
  }
  return reversals / dur;
}
