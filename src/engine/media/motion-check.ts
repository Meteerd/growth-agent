import { spawn } from "node:child_process";
import { ffmpegPath } from "./ffmpeg";

/**
 * Shake metric for a video segment, measured on the CAMERA, not the subject: four 160x160 patches near the edges
 * of the frame (where the background usually is); per pair of consecutive frames each patch's best integer shift
 * (sum of absolute differences, search +-3 px), and the median over the patches is the camera's shift. A smooth
 * camera move shifts one way or not at all; jitter (pixel-rounding zoompan, a shaky clip) flips direction, while a
 * dog chewing in the middle of the frame does not count. Returns the direction reversals per second.
 */
export async function shakeScore(file: string, o: { start?: number; durationSec?: number } = {}): Promise<number> {
  const S = 160;
  const R = 3;
  const W = 540;
  const H = 960;
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
      `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},format=gray`,
      "-f",
      "rawvideo",
      "-",
    ]);
    const chunks: Buffer[] = [];
    p.stdout.on("data", (c: Buffer) => chunks.push(c));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg exit ${code}`))));
  });
  const n = Math.floor(raw.length / (W * H));
  // patch origins: upper-left, upper-right, lower-left, lower-right (inside a 20 px margin)
  const patches: [number, number][] = [
    [20, 140],
    [W - S - 20, 140],
    [20, H - S - 140],
    [W - S - 20, H - S - 140],
  ];
  const med = (xs: number[]) => {
    const v = [...xs].sort((a, b) => a - b);
    return v.length % 2 ? v[(v.length - 1) / 2]! : (v[v.length / 2 - 1]! + v[v.length / 2]!) / 2;
  };
  const shifts: [number, number][] = [];
  for (let f = 1; f < n; f++) {
    const a = raw.subarray((f - 1) * W * H, f * W * H);
    const b = raw.subarray(f * W * H, (f + 1) * W * H);
    const per = patches.map(([px, py]) => {
      let best = [0, 0];
      let bestErr = Number.POSITIVE_INFINITY;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          let err = 0;
          for (let y = R; y < S - R; y += 2)
            for (let x = R; x < S - R; x += 2)
              err += Math.abs(a[(py + y) * W + px + x]! - b[(py + y + dy) * W + px + x + dx]!);
          if (err < bestErr) {
            bestErr = err;
            best = [dx, dy];
          }
        }
      return best as [number, number];
    });
    shifts.push([Math.round(med(per.map((p) => p[0]))), Math.round(med(per.map((p) => p[1])))]);
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
