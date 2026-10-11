import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Brand, Shot } from "@/contracts";
import { urlToFile } from "./files";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function wrap(text: string, max = 34): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = `${cur} ${w}`.trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

/**
 * Demo keyframe (zero cost): one of the brand's own reference images, cropped to 9:16 with a brand-color wash,
 * the shot's visual brief in small type and a visible "Demo keyframe" label. 1080x1920 PNG.
 */
export async function demoKeyframe(brand: Brand, shot: Shot): Promise<Buffer> {
  const W = 1080;
  const H = 1920;
  const colors = brand.dossier.visual.colors.length ? brand.dossier.visual.colors : ["#333333", "#777777"];
  const refs = (brand.dossier.visual.referenceImages ?? [])
    .map((u) => urlToFile(u))
    .filter((f): f is string => !!f && fs.existsSync(f));
  const ref = refs.length ? refs[shot.idx % refs.length] : null;
  const base = ref
    ? await sharp(ref)
        .flatten({ background: colors.at(-1) ?? "#FFFFFF" })
        .resize(W, H, { fit: "cover", position: "attention" })
        .modulate({ brightness: 0.92 })
        .png()
        .toBuffer()
    : await sharp({ create: { width: W, height: H, channels: 3, background: colors[0] } })
        .png()
        .toBuffer();
  const lines = wrap(shot.visualPrompt, 40);
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors[0]}" stop-opacity="0.05"/><stop offset="1" stop-color="${colors[1] ?? colors[0]}" stop-opacity="0.35"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="40" y="60" rx="14" width="330" height="60" fill="rgba(0,0,0,0.55)"/>
    <text x="64" y="101" font-family="Helvetica, Arial" font-size="30" font-weight="700" fill="#fff">Demo keyframe · shot ${shot.idx + 1}</text>
    ${lines.map((l, i) => `<text x="60" y="${170 + i * 40}" font-family="Helvetica, Arial" font-size="28" fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.45)" stroke-width="1">${esc(l)}</text>`).join("")}
  </svg>`;
  return sharp(base)
    .composite([{ input: Buffer.from(overlay) }])
    .png()
    .toBuffer();
}

export function writeAsset(rel: string, data: Buffer): string {
  const file = path.resolve(process.env.ASSETS_DIR || "data/assets", rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  return file;
}
