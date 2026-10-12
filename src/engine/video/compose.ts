import fs from "node:fs";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { Ad916Props } from "../../../remotion/types";
import { ffmpeg, probe } from "../media/ffmpeg";
import { shakeScore } from "../media/motion-check";
import { renderCaptionFrames } from "./captions";
import { urlToFile } from "./files";

/**
 * The Ad916 composition rendered with sharp + ffmpeg (1080x1920, 30 fps): per shot a keyframe (or clip) with
 * Ken Burns motion, the caption burned inside the safe zone, an optional corner badge, then an end card with the
 * logo and CTA, and the voiceover track. Same props as remotion/Ad916.tsx.
 */
const W = 1080;
const H = 1920;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Camera move on a still. zoompan rounds its crop to whole source pixels: with a source only 1.12x the frame that
 * rounding shows as a shaking frame (A18). The still is oversampled (lanczos) so a rounding step is a fraction of
 * an output pixel, and the zoom is driven by the output frame index with an ease-in-out curve (6% over the shot).
 * Measured with shakeScore: 1.12x 15 reversals/s, 4x 3/s, 8x 0 (same as a static shot). Finals use 8x; drafts,
 * demo media and tests 2x (fast; a draft may shimmer).
 */
export function stillMove(n: number, dir: "in" | "out" | "none", w = W, h = H, oversample = 8): string {
  if (dir === "none") return `scale=${w}:${h},zoompan=z=1:x=0:y=0:d=${n}:s=${w}x${h}:fps=30`;
  const ease = `(3*pow(on/${n},2)-2*pow(on/${n},3))`;
  const z = dir === "in" ? `1+0.06*${ease}` : `1.06-0.06*${ease}`;
  return `scale=${w * oversample}:${h * oversample}:flags=lanczos,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${w}x${h}:fps=30`;
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if (`${cur} ${w}`.trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = `${cur} ${w}`.trim();
  }
  if (cur) out.push(cur);
  return out;
}

// the caption font has no emoji glyphs: strip them (they render as boxes)
const EMOJI_PATTERN = "(?:\\p{Extended_Pictographic}|\\u{FE0F}|\\u{200D})";
const EMOJI = new RegExp(EMOJI_PATTERN, "gu");
export const stripEmoji = (t: string) =>
  t
    .replace(EMOJI, "")
    .replace(/\s{2,}/g, " ")
    .trim();

/** Legacy boxed-caption fit (kept for the Remotion composition). Never truncates. */
export function fitCaption(raw: string): { lines: string[]; size: number; lh: number } {
  const text = stripEmoji(raw);
  for (const size of [58, 52, 46, 41, 36]) {
    const perLine = Math.floor((W - 160 - 60) / (size * 0.56));
    const lines = wrap(text, perLine);
    if (lines.length <= (size >= 52 ? 4 : 5)) return { lines, size, lh: Math.round(size * 1.2) };
  }
  const size = 36;
  return { lines: wrap(text, Math.floor((W - 220) / (size * 0.56))), size, lh: 43 };
}

/** Where captions may sit: outside the platform UI (status bar on top, caption and buttons in the bottom ~20%, the
 * action rail on the right ~15%). */
export const UI_SAFE = { top: 200, bottom: Math.round(H * 0.8), left: 60, right: Math.round(W * 0.85) };
export type CaptionRegion = "upper" | "middle" | "lower";

export interface CaptionPhrase {
  lines: string[];
  size: number;
  lh: number;
  /** shot-local seconds */
  t0: number;
  t1: number;
}

/**
 * Platform-native captions (A18): bold white with a black outline, at most 2 lines on screen. A caption that does not
 * fit 2 lines becomes consecutive phrases across the shot, each shown for a share of the time by its word count.
 * Never truncates.
 */
export function captionPhrases(raw: string, durationSec: number): CaptionPhrase[] {
  const text = stripEmoji(raw);
  if (!text) return [];
  const width = UI_SAFE.right - UI_SAFE.left - 40;
  const per = (size: number) => Math.max(8, Math.floor(width / (size * 0.56)));
  for (const size of [76, 68, 60]) {
    const lines = wrap(text, per(size));
    if (lines.length <= 2) return [{ lines, size, lh: Math.round(size * 1.18), t0: 0, t1: durationSec }];
  }
  const size = 60;
  const all = wrap(text, per(size));
  const chunks: string[][] = [];
  for (let i = 0; i < all.length; i += 2) chunks.push(all.slice(i, i + 2));
  const words = chunks.map((c) => c.join(" ").split(/\s+/).length);
  const total = words.reduce((x, y) => x + y, 0);
  let t = 0;
  return chunks.map((lines, i) => {
    const t0 = t;
    t = i === chunks.length - 1 ? durationSec : t + (durationSec * words[i]!) / total;
    return { lines, size, lh: Math.round(size * 1.18), t0, t1: t };
  });
}

/** Top of the caption block: upper third by default, always inside UI_SAFE. */
export function captionTop(region: CaptionRegion, p: Pick<CaptionPhrase, "lines" | "lh">): number {
  const h = p.lines.length * p.lh;
  const centre = region === "upper" ? H * 0.3 : region === "middle" ? H * 0.5 : UI_SAFE.bottom - 60 - h / 2;
  return Math.round(Math.min(Math.max(centre - h / 2, UI_SAFE.top), UI_SAFE.bottom - h));
}

function captionSvg(phrase: CaptionPhrase | null, region: CaptionRegion, badge?: string): string {
  let text = "";
  if (phrase) {
    const y0 = captionTop(region, phrase);
    const cx = Math.round((UI_SAFE.left + UI_SAFE.right) / 2);
    const attrs = `x="${cx}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${phrase.size}" font-weight="900"`;
    text = phrase.lines
      .map((l, i) => {
        const y = y0 + phrase.size + i * phrase.lh - Math.round(phrase.size * 0.18);
        // outline first, then the white fill on top (no paint-order dependency)
        return `<text ${attrs} y="${y}" fill="#000" stroke="#000" stroke-width="${Math.round(phrase.size * 0.16)}" stroke-linejoin="round" opacity="0.92">${esc(l)}</text><text ${attrs} y="${y}" fill="#fff">${esc(l)}</text>`;
      })
      .join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${text}
  ${badge ? `<rect x="${W - 300}" y="70" width="260" height="52" rx="12" fill="rgba(0,0,0,0.5)"/><text x="${W - 170}" y="105" text-anchor="middle" font-family="Helvetica, Arial" font-size="26" fill="#fff">${esc(badge)}</text>` : ""}
</svg>`;
}

/** The moving layer (keyframe cropped to 9:16) and the fixed caption layers (one transparent PNG per phrase). */
async function shotLayers(
  src: string,
  text: string | undefined,
  durationSec: number,
  region: CaptionRegion,
  badge: string | undefined,
  base: string,
): Promise<{ file: string; t0: number; t1: number }[]> {
  const file = urlToFile(src) ?? src;
  await sharp(file).resize(W, H, { fit: "cover", position: "attention" }).png().toFile(base);
  const phrases = captionPhrases(text ?? "", durationSec);
  const layers: (CaptionPhrase | null)[] = phrases.length ? phrases : badge ? [null] : [];
  const out: { file: string; t0: number; t1: number }[] = [];
  for (const [k, ph] of layers.entries()) {
    const f = base.replace(/\.png$/, `_caption${k}.png`);
    await sharp(Buffer.from(captionSvg(ph, region, badge)))
      .png()
      .toFile(f);
    out.push({ file: f, t0: ph?.t0 ?? 0, t1: ph?.t1 ?? durationSec });
  }
  return out;
}

async function endCard(p: Ad916Props, out: string) {
  const bg = p.colors[3] ?? "#FFFFFF";
  const fg = p.colors[0] ?? "#111111";
  const cta = wrap(p.cta, 26);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="${W / 2}" y="1120" text-anchor="middle" font-family="Helvetica, Arial" font-size="84" font-weight="800" fill="#1b1b1b">${esc(p.brandName)}</text>
  <rect x="120" y="1220" width="${W - 240}" height="${cta.length * 66 + 70}" rx="60" fill="${fg}"/>
  ${cta.map((l, i) => `<text x="${W / 2}" y="${1290 + i * 66}" text-anchor="middle" font-family="Helvetica, Arial" font-size="52" font-weight="700" fill="#fff">${esc(l)}</text>`).join("")}
</svg>`;
  const layers: OverlayOptions[] = [];
  const logo = p.logoSrc ? urlToFile(p.logoSrc) : null;
  if (logo && fs.existsSync(logo)) {
    const png = await sharp(logo)
      .resize(300, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    layers.push({ input: png, top: 640, left: (W - 300) / 2 });
  }
  await sharp(Buffer.from(svg)).composite(layers).png().toFile(out);
}

/**
 * The audio of an ad (A18): voice at 48 kHz stereo; a music bed (looped, faded out) ducked under the voice with a
 * sidechain compressor; the mix loudness-normalised to about -14 LUFS (TikTok/Reels level). Without music the voice
 * alone is normalised; the caller warns that the ad has no music bed.
 */
export function audioGraph(
  voIdx: number,
  hasVo: boolean,
  hasMusic: boolean,
  total: number,
  sfx: { at: number; gainDb: number }[] = [],
): string {
  const t = total.toFixed(3);
  // sound effects: inputs after the voice (and music), each delayed to its time, summed under the mix
  const sfx0 = voIdx + 1 + (hasMusic ? 1 : 0);
  const fx = sfx.map((x, i) => {
    const ms = Math.max(0, Math.round(x.at * 1000));
    return `[${sfx0 + i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${x.gainDb}dB,adelay=${ms}|${ms},apad,atrim=0:${t}[fx${i}]`;
  });
  const withFx = (pre: string, label: string) =>
    `${pre};${fx.join(";")};[${label}]${sfx.map((_, i) => `[fx${i}]`).join("")}amix=inputs=${sfx.length + 1}:duration=first:normalize=0[pre]`;
  const voice = `[${voIdx}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=0:${t}`;
  const norm = "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
  if (sfx.length) {
    const bed = hasMusic
      ? [
          `${voice},asplit=2[vo1][vo2]`,
          `[${voIdx + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${t},afade=t=in:d=0.4,afade=t=out:st=${Math.max(0, total - 1.5).toFixed(3)}:d=1.5,volume=0.7[mus]`,
          "[mus][vo2]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350:makeup=1[duck]",
          "[vo1][duck]amix=inputs=2:duration=first:normalize=0[bed]",
        ].join(";")
      : `${voice}[bed]`;
    return `${withFx(bed, "bed")};[pre]${hasVo || hasMusic ? norm : "anull"}[a]`;
  }
  if (!hasMusic) return `${voice},${hasVo ? norm : "anull"}[a]`;
  const fadeAt = Math.max(0, total - 1.5).toFixed(3);
  return [
    `${voice},asplit=2[vo1][vo2]`,
    `[${voIdx + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${t},afade=t=in:d=0.4,afade=t=out:st=${fadeAt}:d=1.5,volume=0.7[mus]`,
    `[mus][vo2]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350:makeup=1[duck]`,
    `[vo1][duck]amix=inputs=2:duration=first:normalize=0,${norm}[a]`,
  ].join(";");
}

/**
 * A still's camera move rendered frame by frame with sharp's affine transform (float scale and offset, bicubic):
 * an eased 7% push in (or pull out) with a slight drift, so a still that has no clip still moves smoothly. Writes
 * `<dir>/%05d.jpg` and returns the pattern.
 */
export async function stillMoveFrames(png: string, n: number, dir: "in" | "out", out: string): Promise<string> {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const base = await sharp(png)
    .resize(W, H, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ease = (x: number) => x * x * (3 - 2 * x);
  const jobs = Array.from({ length: n }, (_, i) => i);
  const worker = async () => {
    for (let i = jobs.shift(); i !== undefined; i = jobs.shift()) {
      const e = ease(n > 1 ? i / (n - 1) : 0);
      const z = dir === "in" ? 1.02 + 0.07 * e : 1.09 - 0.07 * e;
      const drift = (e - 0.5) * 0.012 * W;
      await sharp(base.data, { raw: base.info })
        .affine([z, 0, 0, z], { odx: -(z - 1) * (W / 2) + drift, ody: -(z - 1) * (H / 2), interpolator: "bicubic" })
        .extract({ left: 0, top: 0, width: W, height: H })
        .jpeg({ quality: 92 })
        .toFile(path.join(out, `${String(i).padStart(5, "0")}.jpg`));
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return path.join(out, "%05d.jpg");
}

/**
 * A clip whose camera shakes (shakeScore > 1 reversal/s) is stabilised once with vidstab (two passes, kept next to
 * the clip as <clip>.stab.mp4); the steadier of the two versions is used.
 */
export async function steadyClip(clip: string): Promise<string> {
  const stab = `${clip}.stab.mp4`;
  const len = (await probe(clip)).durationSec;
  // the worst of the first 2 s (what the review measures) and the whole clip
  const spans = [
    { start: 0.15, durationSec: Math.max(0.6, Math.min(2, len - 0.3)) },
    { start: 0.15, durationSec: Math.max(0.6, Math.min(4.5, len - 0.3)) },
  ];
  const worst = async (f: string) =>
    Math.max(...(await Promise.all(spans.map((x) => shakeScore(f, x).catch(() => 0)))));
  const raw = await worst(clip);
  if (raw <= 0.75) return clip;
  if (!fs.existsSync(stab)) {
    const trf = `${clip}.trf`;
    await ffmpeg([
      "-y",
      "-i",
      clip,
      "-vf",
      `vidstabdetect=shakiness=10:accuracy=15:stepsize=4:result=${trf}`,
      "-f",
      "null",
      "-",
    ]);
    await ffmpeg([
      "-y",
      "-i",
      clip,
      "-vf",
      `vidstabtransform=input=${trf}:smoothing=60:optzoom=1:interpol=bicubic,unsharp=5:5:0.5`,
      "-an",
      "-c:v",
      "libx264",
      "-crf",
      "16",
      stab,
    ]);
    fs.rmSync(trf, { force: true });
  }
  return (await worst(stab)) < raw ? stab : clip;
}

export async function composeAd916(p: Ad916Props, out: string, workDir: string, onProgress?: (x: number) => void) {
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const frames: {
    file: string;
    dur: number;
    clip?: string;
    clipLen?: number;
    seq?: string;
    screen?: boolean;
    overlays?: { file: string; t0: number; t1: number }[];
  }[] = [];
  for (const [i, s] of p.shots.entries()) {
    const f = path.join(workDir, `shot_${i}.png`);
    // live captions replace the per-shot text layers (only the badge stays per shot)
    const overlays = await shotLayers(
      s.src,
      p.captions ? undefined : s.text,
      s.durationSec,
      s.captionRegion ?? "upper",
      p.badge,
      f,
    );
    const clip = s.clipSrc ? (urlToFile(s.clipSrc) ?? undefined) : undefined;
    const hasClip = !!clip && fs.existsSync(clip);
    const steady = hasClip && p.motionQuality === "final" ? await steadyClip(clip!) : clip;
    const seq =
      !hasClip && p.motionQuality === "final"
        ? await stillMoveFrames(
            f,
            Math.max(1, Math.round(s.durationSec * 30)),
            i % 2 === 0 ? "in" : "out",
            path.join(workDir, `move_${i}`),
          )
        : undefined;
    frames.push({
      file: f,
      overlays,
      dur: s.durationSec,
      clip: hasClip ? steady : undefined,
      clipLen: hasClip ? (await probe(steady!)).durationSec : undefined,
      seq,
      screen: hasClip && !!s.screen,
    });
    onProgress?.((i + 1) / (p.shots.length + 2));
  }
  const end = path.join(workDir, "end.png");
  await endCard(p, end);
  frames.push({ file: end, dur: p.endCardSec });

  const inputs: string[] = [];
  const parts: string[] = [];
  let k = 0; // next input index
  frames.forEach((f, i) => {
    const n = Math.max(1, Math.round(f.dur * 30));
    const v = k++;
    if (f.clip) {
      inputs.push("-i", f.clip);
      // a clip a little shorter than its shot plays slightly slower (max 1.4x) instead of freezing at the end
      const stretch = f.clipLen && f.clipLen < f.dur - 0.04 ? Math.min(1.4, f.dur / f.clipLen) : 1;
      if (f.screen) {
        // screen in frame: the recording at 70% over a blurred, darker copy of itself; the top stays clear for captions
        const sw = Math.round(W * 0.7);
        parts.push(
          `[${v}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=30,tpad=stop_mode=clone:stop_duration=${f.dur.toFixed(3)},trim=duration=${f.dur},setpts=PTS-STARTPTS,split=2[sa${i}][sb${i}]`,
          `[sa${i}]scale=270:480,boxblur=12:2,eq=brightness=-0.18:saturation=0.8,scale=${W}:${H}[sbg${i}]`,
          `[sb${i}]scale=${sw}:-2[sfg${i}]`,
          `[sbg${i}][sfg${i}]overlay=(W-w)/2:${Math.round(H * 0.4)},format=yuv420p,setsar=1[b${i}]`,
        );
      } else
        parts.push(
          `[${v}:v]${stretch > 1 ? `setpts=${stretch.toFixed(4)}*PTS,` : ""}scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=30,tpad=stop_mode=clone:stop_duration=${f.dur.toFixed(3)},trim=duration=${f.dur},setpts=PTS-STARTPTS,format=yuv420p,setsar=1[b${i}]`,
        );
    } else if (f.seq) {
      // final still: the camera move rendered per frame with float transforms (no zoompan, no rounding jitter)
      inputs.push("-framerate", "30", "-i", f.seq);
      parts.push(`[${v}:v]fps=30,trim=end_frame=${n},setpts=PTS-STARTPTS,format=yuv420p,setsar=1[b${i}]`);
    } else {
      inputs.push("-i", f.file);
      const last = i === frames.length - 1;
      const dir = last ? "none" : i % 2 === 0 ? "in" : "out";
      const over = p.motionQuality === "final" ? 8 : 2;
      parts.push(`[${v}:v]${stillMove(n, dir, W, H, over)},format=yuv420p,setsar=1[b${i}]`);
    }
    // caption phrases one after another (shot-local time), each a still transparent layer
    let cur = `b${i}`;
    for (const [j, ov] of (f.overlays ?? []).entries()) {
      const o = k++;
      inputs.push("-loop", "1", "-t", String(f.dur), "-i", ov.file);
      const next = `c${i}_${j}`;
      parts.push(
        `[${o}:v]format=rgba,fps=30[o${i}_${j}]`,
        `[${cur}][o${i}_${j}]overlay=0:0:shortest=1:enable='between(t,${ov.t0.toFixed(3)},${ov.t1.toFixed(3)})'[${next}]`,
      );
      cur = next;
    }
    parts.push(`[${cur}]format=yuv420p,setsar=1[v${i}]`);
  });
  const vo = p.voiceoverSrc ? urlToFile(p.voiceoverSrc) : null;
  const hasVo = !!vo && fs.existsSync(vo);
  const music = p.musicSrc ? urlToFile(p.musicSrc) : null;
  const hasMusic = !!music && fs.existsSync(music);
  const total = frames.reduce((a, f) => a + f.dur, 0);
  // live caption layer: a transparent PNG sequence over the whole cut
  let capArgs: string[] = [];
  let capFilter = "";
  if (p.captions) {
    const pattern = await renderCaptionFrames(p.captions, total, path.join(workDir, "captions"));
    capArgs = ["-framerate", "30", "-i", pattern];
    capFilter = `;[${k}:v]format=rgba[cap];[vcat][cap]overlay=0:0:eof_action=pass:format=auto,format=yuv420p[v]`;
    k++;
  }
  const filter = `${parts.join(";")};${frames.map((_, i) => `[v${i}]`).join("")}concat=n=${frames.length}:v=1:a=0[${p.captions ? "vcat" : "v"}]${capFilter}`;
  const sfx = (p.sfx ?? [])
    .map((x) => ({ ...x, file: urlToFile(x.src) ?? x.src }))
    .filter((x) => fs.existsSync(x.file) && x.at < total);
  const audio = audioGraph(k, hasVo, hasMusic, total, sfx);
  await ffmpeg(
    [
      "-y",
      ...inputs,
      ...capArgs,
      ...(hasVo ? ["-i", vo] : ["-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=48000:cl=stereo"]),
      ...(hasMusic ? ["-stream_loop", "-1", "-i", music] : []),
      ...sfx.flatMap((x) => ["-i", x.file]),
      "-filter_complex",
      `${filter};${audio}`,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "21",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      "-t",
      String(total),
      out,
    ],
    { timeoutMs: 600_000 },
  );
  onProgress?.(1);
  const info = await probe(out);
  return {
    file: out,
    durationSec: info.durationSec,
    width: info.width ?? W,
    height: info.height ?? H,
    renderer: "ffmpeg" as const,
  };
}
