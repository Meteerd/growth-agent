import fs from "node:fs";
import path from "node:path";
import type opentype from "opentype.js";
import sharp, { type OverlayOptions } from "sharp";
import { fontFor } from "./captions";
import { urlToFile } from "./files";

/**
 * Carousels (Instagram carousel / TikTok photo mode), 1080x1350 (4:5). Every slide is a full-bleed photo with a soft
 * dark gradient where the type sits, a large centred headline (one key word in the brand accent), one or two short
 * body lines and a small counter. A "phone" slide shows a real screenshot of the brand's site inside a drawn phone;
 * the last slide is the CTA with the brand logo and the real site URL. Type is drawn as vector paths from the bundled
 * OFL fonts (assets/fonts), centred on x = 540 from the glyph bounding boxes, so it is identical on every machine.
 */
export const CW = 1080;
export const CH = 1350;
const MAX_W = 920;

export interface CarouselSlide {
  headline: string;
  /** one word (or short phrase) of the headline drawn in the brand accent colour */
  accentWord?: string;
  /** 0 to 2 short lines under the headline */
  body?: string[];
  /** background image file (any size; cover-cropped to 4:5) */
  bg: string;
  /** where the type sits; default bottom (phone and CTA slides lay out on their own) */
  textPosition?: "top" | "bottom";
  /** a real screenshot (9:16) shown inside a phone mockup */
  phone?: string;
  /** CTA slide: the site URL shown in a pill and the brand logo above the headline */
  cta?: { url: string };
}

export interface CarouselBrand {
  name: string;
  dossier: { visual: { colors: string[]; logoUrl?: string } };
}

export interface SlideLayout {
  file: string;
  /** headline glyph bounds in slide pixels (the union of all lines) */
  headline: { x1: number; x2: number; y1: number; y2: number; size: number; lines: string[] };
}

export interface CarouselResult {
  slides: SlideLayout[];
  strip: string;
  accent: string;
}

// ---------------------------------------------------------------- colour

const hex = (c: string) => {
  const m = c.replace("#", "");
  const v = m.length === 3 ? [...m].map((x) => x + x).join("") : m.padEnd(6, "0");
  return [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16));
};
const toHex = (rgb: number[]) =>
  `#${rgb.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
const lum = (rgb: number[]) => {
  const [r, g, b] = rgb.map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const sat = (rgb: number[]) => {
  const mx = Math.max(...rgb);
  const mn = Math.min(...rgb);
  return mx === 0 ? 0 : (mx - mn) / mx;
};

/**
 * The brand accent for type on a dark gradient: colours[0] when it reads there; otherwise the first saturated palette
 * colour, lightened (mixed with white) until it has at least 4.5:1 contrast against black.
 */
export function accentFor(colors: string[]): string {
  const pal = colors.length ? colors.map(hex) : [[255, 225, 77]];
  let c = pal[0]!;
  if (lum(c) < 0.02 || sat(c) < 0.25) c = pal.find((x) => sat(x) >= 0.25 && lum(x) >= 0.02) ?? c;
  for (let i = 0; i < 20 && (lum(c) + 0.05) / 0.05 < 4.5; i++) c = c.map((x) => x + (255 - x) * 0.12);
  return toHex(c);
}

// ---------------------------------------------------------------- type

const has = (f: opentype.Font, t: string) => [...t].every((ch) => /\s/.test(ch) || f.charToGlyphIndex(ch) > 0);
/** Plus Jakarta Sans for headlines; Inter (same family feel, wide coverage) when a glyph is missing. */
function headFont(t: string): opentype.Font {
  const f = fontFor("jakarta");
  return has(f, t) ? f : fontFor("inter");
}
function bodyFont(t: string): opentype.Font {
  const f = fontFor("tiktok_sans", "bold");
  return has(f, t) ? f : fontFor("inter");
}

const norm = (w: string) => w.toLocaleLowerCase().replace(/[^\p{L}\p{N}%+]/gu, "");

function wrap(font: opentype.Font, text: string, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && font.getAdvanceWidth(next, size) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

interface TypeBlock {
  svg: string;
  height: number;
  bounds: { x1: number; x2: number; y1: number; y2: number };
}

/**
 * Lines of text centred on x = 540: each word is a path; the line is shifted so the midpoint of its glyph bounding
 * box (not its advance width) sits on the centre. Accent words are filled with the accent colour.
 */
function layoutLines(
  font: opentype.Font,
  lines: string[],
  size: number,
  top: number,
  lineH: number,
  fill: string,
  accent?: { words: Set<string>; color: string },
): TypeBlock {
  const out: string[] = [];
  const b = { x1: CW, x2: 0, y1: CH, y2: 0 };
  const space = font.getAdvanceWidth(" ", size);
  const asc = (font.ascender / font.unitsPerEm) * size;
  for (const [i, line] of lines.entries()) {
    const base = top + asc * 0.92 + i * lineH;
    let x = 0;
    const placed = line.split(" ").map((w) => {
      const p = font.getPath(w, x, base, size, { kerning: true });
      const q = { w, x, bb: p.getBoundingBox() };
      x += font.getAdvanceWidth(w, size, { kerning: true }) + space;
      return q;
    });
    const lx1 = Math.min(...placed.map((q) => q.bb.x1));
    const lx2 = Math.max(...placed.map((q) => q.bb.x2));
    const dx = CW / 2 - (lx1 + lx2) / 2;
    for (const q of placed) {
      const color = accent?.words.has(norm(q.w)) ? accent.color : fill;
      out.push(
        `<path d="${font.getPath(q.w, q.x + dx, base, size, { kerning: true }).toPathData(2)}" fill="${color}"/>`,
      );
      b.y1 = Math.min(b.y1, q.bb.y1);
      b.y2 = Math.max(b.y2, q.bb.y2);
    }
    b.x1 = Math.min(b.x1, lx1 + dx);
    b.x2 = Math.max(b.x2, lx2 + dx);
  }
  return { svg: out.join(""), height: lines.length * lineH, bounds: b };
}
/** Headline: biggest size (within the slide's range) that fits in maxLines lines. */
function fitHeadline(text: string, max: number, min: number, maxLines: number) {
  const font = headFont(text);
  let size = max;
  let lines = wrap(font, text, size, MAX_W);
  while (size > min && (lines.length > maxLines || lines.some((l) => font.getAdvanceWidth(l, size) > MAX_W))) {
    size -= 4;
    lines = wrap(font, text, size, MAX_W);
  }
  // balance the lines (no one-word widow): the narrowest width that still gives the same number of lines
  let w = MAX_W;
  while (lines.length > 1 && w > 480) {
    const next = wrap(font, text, size, w - 20);
    if (next.length !== lines.length) break;
    lines = next;
    w -= 20;
  }
  return { font, size, lines, lineH: Math.round(size * 1.08) };
}

// ---------------------------------------------------------------- images

async function cover(file: string, bgColor: string, blur = 0): Promise<Buffer> {
  let img = sharp(file).flatten({ background: bgColor }).resize(CW, CH, { fit: "cover", position: "attention" });
  if (blur) img = img.blur(blur);
  return img.png().toBuffer();
}

function logoFile(brand: CarouselBrand): string | null {
  const u = brand.dossier.visual.logoUrl;
  if (!u) return null;
  const f = urlToFile(u);
  if (!f || !fs.existsSync(f)) return null;
  // a dark mark disappears on a dark slide: prefer the brand's white variant when it has one
  if (f.endsWith(".svg")) {
    const white = f.replace(/\.svg$/, "-white.svg");
    if (fs.existsSync(white)) return white;
  }
  return f;
}

async function roundedLogo(file: string, size: number): Promise<Buffer> {
  const isSvg = file.endsWith(".svg");
  const img = sharp(file, isSvg ? { density: 300 } : {}).resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (isSvg) return img.png().toBuffer();
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#fff"/></svg>`,
  );
  return img
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function phoneScreen(file: string, w: number, h: number, r: number): Promise<Buffer> {
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`,
  );
  return sharp(file)
    .resize(w, h, { fit: "cover", position: "top" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------- slide

const SHADOW = `<filter id="sh" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#000" flood-opacity="0.55"/></filter>`;

async function renderSlide(
  s: CarouselSlide,
  idx: number,
  n: number,
  brand: CarouselBrand,
  accent: string,
  file: string,
): Promise<SlideLayout> {
  const light = brand.dossier.visual.colors.at(-1) ?? "#FFFFFF";
  const isCta = !!s.cta;
  const isPhone = !!s.phone && !isCta;
  const bg = await cover(s.bg, light, isPhone ? 18 : 0);
  const layers: OverlayOptions[] = [];
  const svg: string[] = [];
  const accentSet = s.accentWord
    ? { words: new Set(s.accentWord.split(/\s+/).map(norm).filter(Boolean)), color: accent }
    : undefined;

  const head = isPhone
    ? fitHeadline(s.headline, 76, 52, 3)
    : isCta
      ? fitHeadline(s.headline, 92, 60, 3)
      : idx === 0
        ? fitHeadline(s.headline, 112, 72, 4)
        : fitHeadline(s.headline, 96, 64, 4);
  const bodyLines = (s.body ?? [])
    .slice(0, 2)
    .flatMap((t) => wrap(bodyFont(t), t, 40, MAX_W))
    .slice(0, 3);
  const bodyText = bodyLines.join(" ");
  const bf = bodyFont(bodyText || "a");
  const bodySize = isPhone ? 36 : 40;
  const bodyLH = Math.round(bodySize * 1.32);
  const gapHB = bodyLines.length ? 30 : 0;
  const blockH = head.lines.length * head.lineH + gapHB + bodyLines.length * bodyLH;

  let top: number;
  if (isCta) {
    // logo, headline, body, URL pill: centred as one group, slightly above the middle
    const logoSize = 168;
    const pillH = 96;
    const groupH = logoSize + 56 + blockH + 56 + pillH;
    const g0 = Math.round((CH - groupH) / 2) - 30;
    svg.push(`<rect width="${CW}" height="${CH}" fill="#000" opacity="0.36"/>`);
    svg.push(
      `<defs><radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="40%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.55"/></radialGradient></defs><rect width="${CW}" height="${CH}" fill="url(#v)"/>`,
    );
    const lf = logoFile(brand);
    if (lf) {
      layers.push({ input: await roundedLogo(lf, logoSize), left: Math.round(CW / 2 - logoSize / 2), top: g0 });
    }
    top = g0 + logoSize + 56;
    // URL pill
    const url = s.cta!.url;
    const uf = headFont(url);
    const us = 46;
    const up = uf.getPath(url, 0, 0, us);
    const ub = up.getBoundingBox();
    const pillW = Math.round(ub.x2 - ub.x1 + 110);
    const pillTop = top + blockH + 56;
    const ux = CW / 2 - (ub.x1 + ub.x2) / 2;
    const uy = pillTop + pillH / 2 - (ub.y1 + ub.y2) / 2;
    svg.push(
      `<rect x="${CW / 2 - pillW / 2}" y="${pillTop}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${accent}"/>`,
    );
    svg.push(
      `<path d="${uf.getPath(url, ux, uy, us).toPathData(2)}" fill="${lum(hex(accent)) > 0.45 ? "#111" : "#FFF"}"/>`,
    );
  } else if (isPhone) {
    top = 110;
    svg.push(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.72"/><stop offset="0.45" stop-color="#000" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0.15"/></linearGradient></defs><rect width="${CW}" height="${CH}" fill="url(#g)"/>`,
    );
    // phone below the text block
    const phoneTop = top + blockH + 48;
    const ph = Math.min(900, CH - 40 - phoneTop);
    const bezel = 14;
    const sh = ph - bezel * 2;
    const sw = Math.round((sh * 9) / 16);
    const pw = sw + bezel * 2;
    const px = Math.round(CW / 2 - pw / 2);
    svg.push(
      `<filter id="ps" x="-30%" y="-10%" width="160%" height="130%"><feDropShadow dx="0" dy="18" stdDeviation="26" flood-color="#000" flood-opacity="0.6"/></filter>`,
      `<rect x="${px}" y="${phoneTop}" width="${pw}" height="${ph}" rx="58" fill="#0B0B0D" stroke="#3A3A40" stroke-width="3" filter="url(#ps)"/>`,
    );
    layers.push({ input: await phoneScreen(s.phone!, sw, sh, 46), left: px + bezel, top: phoneTop + bezel });
  } else if ((s.textPosition ?? "bottom") === "top") {
    top = 120;
    svg.push(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.85"/><stop offset="${Math.min(0.9, (top + blockH + 40) / CH).toFixed(3)}" stop-color="#000" stop-opacity="0.62"/><stop offset="${Math.min(1, (top + blockH + 300) / CH).toFixed(3)}" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="${CW}" height="${CH}" fill="url(#g)"/>`,
    );
  } else {
    // the block ends above the bottom ~13% (TikTok photo-mode caption), the gradient starts well above it
    const bottom = CH - 170;
    top = bottom - blockH;
    const g0 = Math.max(0, (top - 260) / CH);
    svg.push(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="${g0.toFixed(3)}" stop-color="#000" stop-opacity="0"/><stop offset="${Math.min(0.95, g0 + 0.2).toFixed(3)}" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></linearGradient></defs><rect width="${CW}" height="${CH}" fill="url(#g)"/>`,
    );
  }

  const h = layoutLines(head.font, head.lines, head.size, top, head.lineH, "#FFFFFF", accentSet);
  svg.push(`<g filter="url(#sh)">${h.svg}</g>`);
  if (bodyLines.length) {
    const b = layoutLines(bf, bodyLines, bodySize, top + h.height + gapHB, bodyLH, "#FFFFFF");
    svg.push(`<g filter="url(#sh)" opacity="0.9">${b.svg}</g>`);
  }

  // counter: small, top right, on a soft pill (not on the CTA logo)
  const ct = `${idx + 1}/${n}`;
  const cf = bodyFont(ct);
  const cs = 28;
  const cp = cf.getPath(ct, 0, 0, cs);
  const cb = cp.getBoundingBox();
  const cw = Math.round(cb.x2 - cb.x1 + 36);
  const cx = CW - 48 - cw;
  svg.push(`<rect x="${cx}" y="48" width="${cw}" height="50" rx="25" fill="#000" opacity="0.38"/>`);
  svg.push(
    `<path d="${cf.getPath(ct, cx + cw / 2 - (cb.x1 + cb.x2) / 2, 73 - (cb.y1 + cb.y2) / 2, cs).toPathData(2)}" fill="#FFF" opacity="0.92"/>`,
  );

  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}"><defs>${SHADOW}</defs>${svg.join("")}</svg>`,
  );
  // the phone screen and the logo go over the overlay; the type never overlaps them (laid out above them)
  await sharp(bg)
    .composite([{ input: overlay }, ...layers])
    .png()
    .toFile(file);
  return {
    file,
    headline: { ...h.bounds, size: head.size, lines: head.lines },
  };
}

// ---------------------------------------------------------------- carousel

export async function renderCarousel(
  slides: CarouselSlide[],
  brand: CarouselBrand,
  outDir: string,
): Promise<CarouselResult> {
  fs.mkdirSync(outDir, { recursive: true });
  const accent = accentFor(brand.dossier.visual.colors);
  const out: SlideLayout[] = [];
  for (const [i, s] of slides.entries())
    out.push(await renderSlide(s, i, slides.length, brand, accent, path.join(outDir, `slide_${i + 1}.png`)));
  const strip = path.join(outDir, "strip.jpg");
  await writeStrip(
    out.map((o) => o.file),
    strip,
  );
  return { slides: out, strip, accent };
}

/** All slides side by side, small (a contact sheet for review and the cockpit). */
export async function writeStrip(files: string[], out: string, w = 270): Promise<string> {
  const h = Math.round((w * CH) / CW);
  const gap = 10;
  const thumbs = await Promise.all(files.map((f) => sharp(f).resize(w, h).png().toBuffer()));
  await sharp({
    create: {
      width: files.length * w + (files.length + 1) * gap,
      height: h + gap * 2,
      channels: 3,
      background: "#141414",
    },
  })
    .composite(thumbs.map((input, i) => ({ input, left: gap + i * (w + gap), top: gap })))
    .jpeg({ quality: 82 })
    .toFile(out);
  return out;
}
