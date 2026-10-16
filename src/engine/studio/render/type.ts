import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

/**
 * Type for studio ads: bundled OFL fonts (assets/fonts) drawn as vector paths, so slides look the same on every
 * machine and Slovak/Czech/Spanish diacritics are always right (diffusion models garble them).
 */

export const FONT_FILES = {
  jakarta: "PlusJakartaSans-ExtraBold.ttf",
  inter_regular: "Inter-Regular.ttf",
  inter_medium: "Inter-Medium.ttf",
  inter_semibold: "Inter-SemiBold.ttf",
  inter_bold: "Inter-Bold.ttf",
  inter: "Inter-ExtraBold.ttf",
  montserrat: "Montserrat-Black.ttf",
  poppins: "Poppins-ExtraBold.ttf",
  anton: "Anton-Regular.ttf",
  bebas: "BebasNeue-Regular.ttf",
  serif_dm: "DMSerifDisplay-Regular.ttf",
  serif_playfair: "PlayfairDisplay-ExtraBold.ttf",
  handwritten: "Caveat-Bold.ttf",
  tiktok: "TikTokSans-Black.ttf",
  tiktok_bold: "TikTokSans-Bold.ttf",
} as const;
export type FontKey = keyof typeof FONT_FILES;
export const HEAD_FONTS: FontKey[] = [
  "jakarta",
  "inter",
  "montserrat",
  "poppins",
  "anton",
  "bebas",
  "serif_dm",
  "serif_playfair",
  "tiktok",
];

const cache = new Map<string, opentype.Font>();
export function font(key: string): opentype.Font {
  const k = (key in FONT_FILES ? key : "inter") as FontKey;
  let f = cache.get(k);
  if (!f) {
    const buf = fs.readFileSync(path.join(process.cwd(), "assets/fonts", FONT_FILES[k]));
    f = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    cache.set(k, f);
  }
  return f;
}

const covers = (f: opentype.Font, t: string) => [...t].every((ch) => /\s/.test(ch) || f.charToGlyphIndex(ch) > 0);

/** The requested font if it has every glyph, else Inter at a similar weight. */
export function fontFor(key: string, text: string): opentype.Font {
  const f = font(key);
  if (covers(f, text)) return f;
  return font(/regular|medium/.test(key) ? "inter_medium" : "inter_bold");
}

/** Strip what the fonts cannot draw (emoji, symbols) and normalise quotes and dashes (house style: no em dashes). */
export function clean(t: string | undefined): string {
  return (t ?? "")
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/gu, "")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

export const norm = (w: string) => w.toLocaleLowerCase().replace(/[^\p{L}\p{N}%+€$£]/gu, "");

export function wrap(f: opentype.Font, text: string, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && f.getAdvanceWidth(next, size) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export interface Fit {
  font: opentype.Font;
  size: number;
  lines: string[];
  lineH: number;
}

/** Largest size between max and min that fits in maxLines lines of maxW; balances the lines (no widows). */
export function fit(
  key: string,
  text: string,
  o: { max: number; min: number; maxW: number; maxLines: number; lineH?: number; balance?: boolean; upper?: boolean },
): Fit {
  const t = o.upper ? text.toLocaleUpperCase() : text;
  const f = fontFor(key, t);
  let size = o.max;
  let lines = wrap(f, t, size, o.maxW);
  while (size > o.min && (lines.length > o.maxLines || lines.some((l) => f.getAdvanceWidth(l, size) > o.maxW))) {
    size -= 2;
    lines = wrap(f, t, size, o.maxW);
  }
  if (o.balance !== false) {
    let w = o.maxW;
    while (lines.length > 1 && w > o.maxW * 0.55) {
      const next = wrap(f, t, size, w - 16);
      if (next.length !== lines.length) break;
      lines = next;
      w -= 16;
    }
  }
  return { font: f, size, lines, lineH: Math.round(size * (o.lineH ?? 1.12)) };
}

export interface Drawn {
  svg: string;
  height: number;
  width: number;
}

/**
 * Lines at (x, top): align left/center/right inside [x, x + boxW]. Words in `accent` get the accent colour.
 * Returns SVG paths plus the block height.
 */
export function drawLines(
  ft: Fit,
  o: {
    x: number;
    top: number;
    boxW: number;
    color: string;
    align?: "left" | "center" | "right";
    accent?: { words: string[]; color: string };
    opacity?: number;
  },
): Drawn {
  const out: string[] = [];
  const asc = (ft.font.ascender / ft.font.unitsPerEm) * ft.size;
  const space = ft.font.getAdvanceWidth(" ", ft.size);
  const accentSet = new Set(
    (o.accent?.words ?? [])
      .flatMap((w) => w.split(/\s+/))
      .map(norm)
      .filter(Boolean),
  );
  let maxW = 0;
  for (const [i, line] of ft.lines.entries()) {
    const base = o.top + asc * 0.9 + i * ft.lineH;
    const lw = ft.font.getAdvanceWidth(line, ft.size, { kerning: true });
    maxW = Math.max(maxW, lw);
    const x0 = o.align === "center" ? o.x + (o.boxW - lw) / 2 : o.align === "right" ? o.x + o.boxW - lw : o.x;
    let x = x0;
    for (const w of line.split(" ")) {
      const color = accentSet.has(norm(w)) && o.accent ? o.accent.color : o.color;
      out.push(`<path d="${ft.font.getPath(w, x, base, ft.size, { kerning: true }).toPathData(2)}" fill="${color}"/>`);
      x += ft.font.getAdvanceWidth(w, ft.size, { kerning: true }) + space;
    }
  }
  const g = `<g${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}>${out.join("")}</g>`;
  return { svg: g, height: ft.lines.length * ft.lineH, width: maxW };
}

/** A single line of text, measured (pills, labels, counters). */
export function label(
  key: string,
  text: string,
  size: number,
  o: { x: number; y: number; color: string; anchor?: "start" | "middle" | "end"; upper?: boolean; track?: number },
): { svg: string; width: number } {
  const t = o.upper ? text.toLocaleUpperCase() : text;
  const f = fontFor(key, t);
  const track = o.track ?? 0;
  const w = f.getAdvanceWidth(t, size) + track * Math.max(0, t.length - 1);
  const x = o.anchor === "middle" ? o.x - w / 2 : o.anchor === "end" ? o.x - w : o.x;
  if (!track) return { svg: `<path d="${f.getPath(t, x, o.y, size).toPathData(2)}" fill="${o.color}"/>`, width: w };
  let cx = x;
  const parts: string[] = [];
  for (const ch of t) {
    parts.push(f.getPath(ch, cx, o.y, size).toPathData(2));
    cx += f.getAdvanceWidth(ch, size) + track;
  }
  return { svg: `<path d="${parts.join("")}" fill="${o.color}"/>`, width: w };
}

/** Cap height of a font at a size (to centre a line vertically in a pill). */
export function capHeight(key: string, size: number): number {
  const f = font(key);
  const g = f.charToGlyph("H").getBoundingBox();
  return ((g.y2 - g.y1) / f.unitsPerEm) * size;
}
