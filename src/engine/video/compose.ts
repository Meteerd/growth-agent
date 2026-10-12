import fs from "node:fs";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { Ad916Props } from "../../../remotion/types";
import { ffmpeg, probe } from "../media/ffmpeg";
import { urlToFile } from "./files";

/**
 * The Ad916 composition rendered with sharp + ffmpeg (1080x1920, 30 fps): per shot a keyframe (or clip) with
 * Ken Burns motion, the caption burned inside the safe zone, an optional corner badge, then an end card with the
 * logo and CTA, and the voiceover track. Same props as remotion/Ad916.tsx.
 */
const W = 1080;
const H = 1920;
const SAFE_BOTTOM = 470; // reviews flagged captions sitting right on the 420 px limit
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

/** Largest font size (58 down to 36 px) at which the whole caption fits in 5 lines; never truncates. */
// the caption font has no emoji glyphs: strip them (they render as boxes)
const EMOJI_PATTERN = "(?:\\p{Extended_Pictographic}|\\u{FE0F}|\\u{200D})";
const EMOJI = new RegExp(EMOJI_PATTERN, "gu");
export const stripEmoji = (t: string) =>
  t
    .replace(EMOJI, "")
    .replace(/\s{2,}/g, " ")
    .trim();

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

function captionSvg(text: string, accent: string, badge?: string): string {
  const { lines, size, lh } = fitCaption(text);
  const boxH = lines.length * lh + 50;
  const y0 = H - SAFE_BOTTOM - boxH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${
    text
      ? `<rect x="80" y="${y0}" width="${W - 160}" height="${boxH}" rx="24" fill="rgba(0,0,0,0.72)"/>
  <rect x="80" y="${y0 + boxH - 8}" width="${W - 160}" height="8" fill="${accent}"/>
  ${lines.map((l, i) => `<text x="${W / 2}" y="${y0 + 25 + size + i * lh}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="800" fill="#fff">${esc(l)}</text>`).join("")}`
      : ""
  }
  ${badge ? `<rect x="${W - 300}" y="70" width="260" height="52" rx="12" fill="rgba(0,0,0,0.5)"/><text x="${W - 170}" y="105" text-anchor="middle" font-family="Helvetica, Arial" font-size="26" fill="#fff">${esc(badge)}</text>` : ""}
</svg>`;
}

/** The moving layer (keyframe cropped to 9:16) and the fixed layer (caption + badge, transparent). */
async function shotLayers(
  src: string,
  text: string | undefined,
  accent: string,
  badge: string | undefined,
  base: string,
  overlay: string,
) {
  const file = urlToFile(src) ?? src;
  await sharp(file).resize(W, H, { fit: "cover", position: "attention" }).png().toFile(base);
  await sharp(Buffer.from(captionSvg(text ?? "", accent, badge)))
    .png()
    .toFile(overlay);
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

export async function composeAd916(p: Ad916Props, out: string, workDir: string, onProgress?: (x: number) => void) {
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const accent = p.colors[0] ?? "#ffffff";
  const frames: { file: string; dur: number; clip?: string; overlay?: string }[] = [];
  for (const [i, s] of p.shots.entries()) {
    const f = path.join(workDir, `shot_${i}.png`);
    const o = path.join(workDir, `shot_${i}_caption.png`);
    await shotLayers(s.src, s.text, accent, p.badge, f, o);
    const clip = s.clipSrc ? (urlToFile(s.clipSrc) ?? undefined) : undefined;
    frames.push({ file: f, overlay: o, dur: s.durationSec, clip: clip && fs.existsSync(clip) ? clip : undefined });
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
      parts.push(
        `[${v}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=30,trim=duration=${f.dur},setpts=PTS-STARTPTS,format=yuv420p,setsar=1[b${i}]`,
      );
    } else {
      inputs.push("-i", f.file);
      const last = i === frames.length - 1;
      const z = last ? "1" : i % 2 === 0 ? "min(zoom+0.0009,1.12)" : "if(eq(on,0),1.12,max(zoom-0.0009,1.0))";
      parts.push(
        `[${v}:v]scale=${Math.round(W * 1.12)}:${Math.round(H * 1.12)},zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=30,format=yuv420p,setsar=1[b${i}]`,
      );
    }
    if (f.overlay) {
      const o = k++;
      inputs.push("-loop", "1", "-t", String(f.dur), "-i", f.overlay);
      parts.push(
        `[${o}:v]format=rgba,fps=30[o${i}]`,
        `[b${i}][o${i}]overlay=0:0:shortest=1,format=yuv420p,setsar=1[v${i}]`,
      );
    } else {
      parts.push(`[b${i}]null[v${i}]`);
    }
  });
  const audioIdx = k;
  const vo = p.voiceoverSrc ? urlToFile(p.voiceoverSrc) : null;
  const hasVo = !!vo && fs.existsSync(vo);
  const filter = `${parts.join(";")};${frames.map((_, i) => `[v${i}]`).join("")}concat=n=${frames.length}:v=1:a=0[v]`;
  const total = frames.reduce((a, f) => a + f.dur, 0);
  await ffmpeg(
    [
      "-y",
      ...inputs,
      ...(hasVo ? ["-i", vo] : ["-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=44100:cl=stereo"]),
      "-filter_complex",
      `${filter};[${audioIdx}:a]apad,atrim=0:${total}[a]`,
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
      "128k",
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
