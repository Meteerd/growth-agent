import fs from "node:fs";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import { urlToFile } from "../../video/files";
import type { Aspect, Slide, Slots, StudioBrandConfig, TemplateId } from "../types";
import { SIZE } from "../types";
import { capHeight, clean, drawLines, fit, fitBox, label, measure } from "./type";

/**
 * Layout templates for statics and carousel slides. The image (generated or real) never carries text; every word
 * is drawn here from the copy slots, so it is exact in any language. Each template is a function of the slots,
 * the brand kit and the canvas size; all coordinates scale from a 1080 px wide canvas.
 */

export interface RenderInput {
  slide: Slide;
  aspect: Aspect;
  brand: { name: string; config: StudioBrandConfig };
  /** local file of the slide image (background, inset or product shot), if any */
  imageFile?: string;
  /** steps_grid: all step photos in order (the first is imageFile) */
  imageFiles?: string[];
  /** carousel position (counter + swipe cue), if part of a carousel */
  index?: { i: number; n: number };
  out: string;
}

// ---------------------------------------------------------------- colour

const rgb = (c: string) => {
  const m = c.replace("#", "");
  const v = m.length === 3 ? [...m].map((x) => x + x).join("") : m.padEnd(6, "0");
  return [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16));
};
export const luminance = (c: string | number[]) => {
  const [r, g, b] = (typeof c === "string" ? rgb(c) : c).map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
export const contrast = (a: string | number[], b: string | number[]) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
const mix = (c: string, to: string, t: number) => {
  const a = rgb(c);
  const b = rgb(to);
  return `#${a
    .map((x, i) =>
      Math.round(x + (b[i]! - x) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};
/** Readable text colour on a background: the brand ink or white. */
const onColor = (bg: string, ink: string) => (contrast(bg, "#FFFFFF") >= contrast(bg, ink) ? "#FFFFFF" : ink);
/** The accent nudged until it reads on the background (4.5:1 for small text, 3:1 for big type). */
function readable(accent: string, bg: string, min = 3): string {
  let c = accent;
  const toward = luminance(bg) > 0.5 ? "#000000" : "#FFFFFF";
  for (let i = 0; i < 12 && contrast(c, bg) < min; i++) c = mix(c, toward, 0.15);
  return c;
}

// ---------------------------------------------------------------- shapes

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const rect = (x: number, y: number, w: number, h: number, r: number, fill: string, extra = "") =>
  `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r}" fill="${fill}" ${extra}/>`;
const check = (cx: number, cy: number, r: number, bg: string, fg: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}"/><path d="M${cx - r * 0.45} ${cy + r * 0.02} L${cx - r * 0.12} ${cy + r * 0.34} L${cx + r * 0.48} ${cy - r * 0.32}" stroke="${fg}" stroke-width="${r * 0.22}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const cross = (cx: number, cy: number, r: number, bg: string, fg: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}"/><path d="M${cx - r * 0.33} ${cy - r * 0.33} L${cx + r * 0.33} ${cy + r * 0.33} M${cx + r * 0.33} ${cy - r * 0.33} L${cx - r * 0.33} ${cy + r * 0.33}" stroke="${fg}" stroke-width="${r * 0.2}" stroke-linecap="round"/>`;
const SHADOW = (id: string, blur: number, op: number, dy = 4) =>
  `<filter id="${id}" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${blur}" flood-color="#000" flood-opacity="${op}"/></filter>`;

const YES = /^(yes|áno|ano|sí|si|evet|ja|oui|✓|✔|included|incl\.?|true)$/i;
const NO = /^(no|nie|ne|hayır|nein|non|✗|✕|x|-|—|none|false)$/i;

// ---------------------------------------------------------------- images

/** Mean luminance of an image (0..1), cached per file. */
const lumCache = new Map<string, number>();
async function meanLum(file: string): Promise<number> {
  let v = lumCache.get(file);
  if (v === undefined) {
    const st = await sharp(file).resize(64, 64, { fit: "inside" }).stats();
    v = luminance(st.channels.slice(0, 3).map((ch) => ch.mean));
    lumCache.set(file, v);
  }
  return v;
}

async function cover(file: string, w: number, h: number, o: { blur?: number; dim?: number } = {}): Promise<Buffer> {
  let img = sharp(file, file.endsWith(".svg") ? { density: 300 } : {})
    .flatten({ background: "#ffffff" })
    .resize(w, h, { fit: "cover", position: "attention" });
  // muddy, underexposed photos lose the feed: lift them a little (never when the template dims on purpose)
  if (!o.dim && !file.endsWith(".svg")) {
    const l = await meanLum(file);
    if (l < 0.12) img = img.modulate({ brightness: 1.22 }).gamma(1.15);
    else if (l < 0.2) img = img.modulate({ brightness: 1.12 });
  }
  if (o.blur) img = img.blur(o.blur);
  if (o.dim) img = img.modulate({ brightness: 1 - o.dim });
  return img.png().toBuffer();
}

async function rounded(file: string, w: number, h: number, r: number, fitMode: "cover" | "contain" = "cover") {
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`,
  );
  const l = file.endsWith(".svg") ? 1 : await meanLum(file);
  return sharp(file, file.endsWith(".svg") ? { density: 300 } : {})
    .modulate({ brightness: l < 0.12 ? 1.22 : l < 0.2 ? 1.12 : 1 })
    .resize(w, h, { fit: fitMode, position: "attention", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

function logoPath(cfg: StudioBrandConfig, onDark: boolean): string | null {
  if (cfg.logoStyle === "wordmark") return null;
  const u = (onDark && cfg.logoOnDark) || cfg.logo;
  if (!u) return null;
  const f = urlToFile(u);
  if (!f || !fs.existsSync(f)) return null;
  if (onDark && f.endsWith(".svg")) {
    const white = f.replace(/\.svg$/, "-white.svg");
    if (fs.existsSync(white)) return white;
  }
  return f;
}

async function logoLayer(cfg: StudioBrandConfig, onDark: boolean, size: number, left: number, top: number) {
  const f = logoPath(cfg, onDark);
  if (!f) return null;
  const isSvg = f.endsWith(".svg");
  const buf = await sharp(f, isSvg ? { density: 300 } : {})
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const finalBuf = isSvg
    ? buf
    : await sharp(buf)
        .composite([
          {
            input: Buffer.from(
              `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#fff"/></svg>`,
            ),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();
  return { input: finalBuf, left: Math.round(left), top: Math.round(top) } satisfies OverlayOptions;
}

/** Phone mockup with a screenshot, as an overlay layer plus its SVG frame. */
async function phone(file: string, cx: number, top: number, height: number) {
  const bezel = Math.round(height * 0.016);
  const sh = height - bezel * 2;
  const sw = Math.round((sh * 9) / 19.5);
  const pw = sw + bezel * 2;
  const px = Math.round(cx - pw / 2);
  const svg = `<filter id="ps" x="-30%" y="-10%" width="160%" height="130%"><feDropShadow dx="0" dy="${height * 0.02}" stdDeviation="${height * 0.03}" flood-color="#000" flood-opacity="0.45"/></filter>${rect(px, top, pw, height, height * 0.065, "#0B0B0D", 'stroke="#2E2E33" stroke-width="3" filter="url(#ps)"')}`;
  const screen = await (async () => {
    const r = Math.round(height * 0.052);
    const mask = Buffer.from(
      `<svg width="${sw}" height="${sh}"><rect width="${sw}" height="${sh}" rx="${r}" fill="#fff"/></svg>`,
    );
    return sharp(file)
      .resize(sw, sh, { fit: "cover", position: "top" })
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
  })();
  return { svg, layer: { input: screen, left: px + bezel, top: top + bezel } satisfies OverlayOptions, width: pw };
}

// ---------------------------------------------------------------- context

interface Ctx {
  W: number;
  H: number;
  s: number;
  pad: number;
  cfg: StudioBrandConfig;
  slots: Partial<Slots>;
  head: string;
  body: string;
  svg: string[];
  defs: string[];
  layers: OverlayOptions[];
  /** layers drawn above the vector type layer (phone screens, logos) */
  over: OverlayOptions[];
  bg: Buffer | { color: string };
  input: RenderInput;
  /** a template that draws the footnote itself sets this; otherwise it is drawn at the bottom edge */
  footDone?: boolean;
  /** text boxes drawn, for the contrast audit: [x, y, w, h, color] */
  boxes: { x: number; y: number; w: number; h: number; color: string }[];
}

const sl = (c: Ctx, k: keyof Slots) => {
  if (k === "footnote") c.footDone = true;
  return clean(c.slots[k] as string | undefined);
};
/** read a slot without marking the footnote as drawn */
const peek = (c: Ctx, k: keyof Slots) => clean(c.slots[k] as string | undefined);

function headline(
  c: Ctx,
  o: {
    x: number;
    top: number;
    w: number;
    color: string;
    align?: "left" | "center";
    max: number;
    min: number;
    lines: number;
    accentOn?: string;
  },
) {
  const text = sl(c, "headline");
  if (!text) return 0;
  const ft = fit(c.head, text, { max: o.max * c.s, min: o.min * c.s, maxW: o.w, maxLines: o.lines, lineH: 1.08 });
  const accent = sl(c, "accentWord");
  const d = drawLines(ft, {
    x: o.x,
    top: o.top,
    boxW: o.w,
    color: o.color,
    align: o.align ?? "left",
    accent: accent ? { words: [accent], color: readable(c.cfg.colors.accent, o.accentOn ?? "#000000", 3) } : undefined,
  });
  c.svg.push(d.svg);
  c.boxes.push({ x: o.x, y: o.top, w: o.w, h: d.height, color: o.color });
  return d.height;
}

function para(
  c: Ctx,
  text: string,
  o: {
    x: number;
    top: number;
    w: number;
    color: string;
    size: number;
    lines: number;
    align?: "left" | "center";
    font?: string;
    opacity?: number;
    lineH?: number;
  },
) {
  if (!text) return 0;
  // explicit line breaks become separate paragraphs (numbered steps stay on their own lines)
  const parts = text.split("\n").filter(Boolean);
  let h = 0;
  let budget = o.lines;
  for (const [i, part] of parts.entries()) {
    if (budget <= 0) break;
    const ft = fit(o.font ?? c.body, part, {
      max: o.size * c.s,
      min: o.size * 0.72 * c.s,
      maxW: o.w,
      maxLines: Math.max(1, budget),
      lineH: o.lineH ?? 1.3,
      balance: o.align === "center",
    });
    const top = o.top + h + (i ? 10 * c.s : 0);
    const d = drawLines(ft, { x: o.x, top, boxW: o.w, color: o.color, align: o.align ?? "left", opacity: o.opacity });
    c.svg.push(d.svg);
    c.boxes.push({ x: o.x, y: top, w: o.w, h: d.height, color: o.color });
    h += d.height + (i ? 10 * c.s : 0);
    budget -= ft.lines.length;
  }
  return h;
}

/** The footnote / disclaimer line at the bottom edge, for templates that do not place it themselves. */
function bottomFootnote(c: Ctx, onImage: boolean) {
  const t = peek(c, "footnote");
  if (!t || c.footDone) return;
  const size = 19 * c.s;
  const ft = fit("inter_medium", t, { max: size, min: 15 * c.s, maxW: c.W - c.pad * 2, maxLines: 2, lineH: 1.25 });
  const blockH = ft.lines.length * ft.lineH;
  const top = c.H - 16 * c.s - blockH;
  if (onImage) c.svg.push(rect(0, top - 12 * c.s, c.W, blockH + 28 * c.s, 0, "rgba(0,0,0,0.5)"));
  const bgc = "color" in c.bg ? c.bg.color : "#000000";
  const color = onImage ? "#FFFFFF" : mix(onColor(bgc, c.cfg.colors.ink), bgc, 0.35);
  c.svg.push(drawLines(ft, { x: c.pad, top, boxW: c.W - c.pad * 2, color, align: "center" }).svg);
}

/** A filled pill with a label (CTA, eyebrow, price). Returns its width. */
function pill(
  c: Ctx,
  text: string,
  o: {
    x: number;
    y: number;
    h: number;
    bg: string;
    color: string;
    size: number;
    anchor?: "start" | "middle";
    font?: string;
    upper?: boolean;
    track?: number;
  },
) {
  if (!text) return 0;
  const f = o.font ?? "inter_bold";
  const size = o.size * c.s;
  const probe = label(f, text, size, { x: 0, y: 0, color: o.color, upper: o.upper, track: o.track });
  const w = probe.width + o.h * 0.9;
  const x = o.anchor === "middle" ? o.x - w / 2 : o.x;
  const base = o.y + o.h / 2 + capHeight(f, size) / 2;
  c.svg.push(rect(x, o.y, w, o.h, o.h / 2, o.bg));
  c.svg.push(
    label(f, text, size, { x: x + w / 2, y: base, color: o.color, anchor: "middle", upper: o.upper, track: o.track })
      .svg,
  );
  return w;
}

function counter(c: Ctx, dark: boolean) {
  const ix = c.input.index;
  if (!ix || ix.n < 2) return;
  const t = `${ix.i + 1}/${ix.n}`;
  const h = 46 * c.s;
  const size = 24 * c.s;
  const w = label("inter_semibold", t, size, { x: 0, y: 0, color: "#fff" }).width + 32 * c.s;
  const x = c.W - c.pad - w;
  const y = c.pad * 0.7;
  c.svg.push(rect(x, y, w, h, h / 2, dark ? "rgba(0,0,0,0.58)" : "rgba(0,0,0,0.08)"));
  c.svg.push(
    label("inter_semibold", t, size, {
      x: x + w / 2,
      y: y + h / 2 + capHeight("inter_semibold", size) / 2,
      color: dark ? "#FFFFFF" : c.cfg.colors.ink,
      anchor: "middle",
    }).svg,
  );
  // swipe cue on every slide but the last
  if (ix.i < ix.n - 1) {
    const ax = c.W - c.pad * 0.55;
    const ay = c.H / 2;
    const r = 30 * c.s;
    c.svg.push(
      `<circle cx="${ax}" cy="${ay}" r="${r}" fill="${dark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.7)"}"/><path d="M${ax - r * 0.2} ${ay - r * 0.38} L${ax + r * 0.22} ${ay} L${ax - r * 0.2} ${ay + r * 0.38}" stroke="${dark ? "#111" : "#fff"}" stroke-width="${r * 0.16}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
}

async function logo(c: Ctx, onDark: boolean, size: number, x: number, y: number) {
  const l = await logoLayer(c.cfg, onDark, Math.round(size), x, y);
  if (l) c.over.push(l);
  return !!l;
}

/** Brand name as a wordmark when there is no logo file. */
function wordmark(c: Ctx, x: number, y: number, color: string, anchor: "start" | "middle" | "end" = "start") {
  c.svg.push(label(c.head, c.input.brand.name, 40 * c.s, { x, y, color, anchor }).svg);
}

/** Native formats: a small, quiet brand mark bottom right so the ad is attributable without reading as an ad. */
async function smallMark(c: Ctx) {
  const size = 64 * c.s;
  const x = c.W - c.pad * 0.7 - size;
  const y = c.H - c.pad * 0.7 - size;
  if (await logo(c, true, size, x, y)) return;
  const name = c.input.brand.name;
  const fs2 = 30 * c.s;
  const w = label(c.head, name, fs2, { x: 0, y: 0, color: "#fff" }).width + 36 * c.s;
  const h = 56 * c.s;
  const px = c.W - c.pad * 0.7 - w;
  const py = c.H - c.pad * 0.7 - h;
  c.svg.push(rect(px, py, w, h, h / 2, "rgba(255,255,255,0.92)"));
  c.svg.push(
    label(c.head, name, fs2, {
      x: px + w / 2,
      y: py + h / 2 + capHeight(c.head, fs2) / 2,
      color: "#111111",
      anchor: "middle",
    }).svg,
  );
}

function gradient(c: Ctx, id: string, from: "top" | "bottom", start: number, end: number, op: number) {
  const [a, b] = from === "top" ? [op, 0] : [0, op];
  const [s0, s1] = from === "top" ? [start, end] : [start, end];
  c.defs.push(
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="${s0}" stop-color="#000" stop-opacity="${a}"/><stop offset="${s1}" stop-color="#000" stop-opacity="${b}"/></linearGradient>`,
  );
  c.svg.push(`<rect width="${c.W}" height="${c.H}" fill="url(#${id})"/>`);
}

// ---------------------------------------------------------------- templates

type Tpl = (c: Ctx) => Promise<void>;

/** Full-bleed photo, big headline on a soft gradient, optional eyebrow and CTA pill, logo. */
const photoHeadline: Tpl = async (c) => {
  const file = c.input.imageFile;
  const product = c.input.slide.image.source === "product";
  const tall = c.H / c.W > 1.6;
  if (file && product) {
    c.bg = { color: c.cfg.colors.ink };
  } else if (file) c.bg = await cover(file, c.W, c.H);
  else c.bg = { color: c.cfg.colors.ink };
  const w = c.W - c.pad * 2;
  const by0 = c.H - (tall ? c.H * 0.2 : c.pad) - 76 * c.s;
  // put the type where the photo is calm, so it never sits on the subject's face
  let atBottom = false;
  let textTop = tall ? c.H * 0.14 : c.pad * 1.25;
  if (file && !product && !("color" in c.bg)) {
    const busy = async (top: number, height: number) =>
      (
        await sharp(c.bg as Buffer)
          .extract({ left: 0, top: Math.round(top), width: c.W, height: Math.round(height) })
          .greyscale()
          .resize(120, 60, { fit: "fill" })
          .stats()
      ).channels[0]!.stdev;
    const topBusy = await busy(0, c.H * 0.42);
    const bottomBusy = await busy(c.H * 0.5, by0 - c.H * 0.5);
    if (topBusy > bottomBusy * 1.25) {
      const hf = fit(c.head, peek(c, "headline"), { max: 104 * c.s, min: 58 * c.s, maxW: w, maxLines: 4, lineH: 1.08 });
      const bodyText = peek(c, "body");
      const bf = bodyText
        ? fit(c.body, bodyText, { max: 40 * c.s, min: 29 * c.s, maxW: w * 0.92, maxLines: 3, lineH: 1.3 })
        : null;
      const blockH =
        (peek(c, "eyebrow") ? 80 * c.s : 0) +
        hf.lines.length * hf.lineH +
        (bf ? 24 * c.s + bf.lines.length * bf.lineH : 0);
      textTop = by0 - 44 * c.s - blockH;
      atBottom = true;
    }
  }
  const gradAt = c.svg.length;
  let y = textTop;
  const eyebrow = sl(c, "eyebrow");
  if (eyebrow) {
    pill(c, eyebrow, {
      x: c.pad,
      y,
      h: 54 * c.s,
      bg: c.cfg.colors.accent,
      color: onColor(c.cfg.colors.accent, c.cfg.colors.ink),
      size: 24,
      upper: true,
      track: 1.5 * c.s,
    });
    y += 80 * c.s;
  }
  y += headline(c, { x: c.pad, top: y, w, color: "#FFFFFF", max: 104, min: 58, lines: 4 });
  const body = sl(c, "body");
  if (body) {
    y += 24 * c.s;
    y += para(c, body, { x: c.pad, top: y, w: w * 0.92, color: "#FFFFFF", size: 40, lines: 3, opacity: 0.94 });
  }
  if (file && !product && atBottom) {
    // type at the bottom: one scrim rising from the bottom edge to well above the first line
    const start = Math.max(0, (textTop - 240 * c.s) / c.H);
    const mid = Math.min(0.98, (textTop + 30 * c.s) / c.H);
    c.defs.push(
      `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="${start.toFixed(3)}" stop-color="#000" stop-opacity="0"/><stop offset="${mid.toFixed(3)}" stop-color="#000" stop-opacity="0.6"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></linearGradient>`,
    );
    c.svg.splice(gradAt, 0, `<rect width="${c.W}" height="${c.H}" fill="url(#g)"/>`);
  } else if (file && !product) {
    // the gradient runs well past the end of the type, whatever its length
    const end = Math.min(0.95, (y + 220 * c.s) / c.H);
    const mid = Math.min(0.9, (y + 40 * c.s) / c.H);
    c.defs.push(
      `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.8"/><stop offset="${mid.toFixed(3)}" stop-color="#000" stop-opacity="0.62"/><stop offset="${end.toFixed(3)}" stop-color="#000" stop-opacity="0"/></linearGradient>`,
    );
    c.svg.splice(gradAt, 0, `<rect width="${c.W}" height="${c.H}" fill="url(#g)"/>`);
    // bottom scrim for the CTA row
    c.defs.push(
      `<linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0.72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></linearGradient>`,
    );
    c.svg.splice(gradAt + 1, 0, `<rect width="${c.W}" height="${c.H}" fill="url(#gb)"/>`);
  }
  if (file && product) {
    const top = y + 50 * c.s;
    const ph = Math.min(c.H - top - c.pad * 1.6, c.H * 0.62);
    if (ph > 300 * c.s) {
      const p = await phone(file, c.W / 2, Math.round(top), Math.round(ph));
      c.svg.push(p.svg);
      c.over.push(p.layer);
    }
  }
  const cta = sl(c, "cta");
  const by = by0;
  if (cta)
    pill(c, cta, {
      x: c.pad,
      y: by,
      h: 76 * c.s,
      bg: c.cfg.colors.accent,
      color: onColor(c.cfg.colors.accent, c.cfg.colors.ink),
      size: 30,
    });
  if (!(await logo(c, true, 76 * c.s, c.W - c.pad - 76 * c.s, by)))
    wordmark(c, c.W - c.pad, by + 52 * c.s, "#FFFFFF", "end");
};

/** Photo (or product phone) on top, solid panel below with headline, body and CTA. */
const splitPanel: Tpl = async (c) => {
  const file = c.input.imageFile;
  const panelColor = c.cfg.colors.paper;
  const ink = onColor(panelColor, c.cfg.colors.ink);
  const ph = Math.round(c.H * (c.H / c.W > 1.6 ? 0.5 : 0.56));
  c.bg = { color: panelColor };
  if (file && c.input.slide.image.source === "product") {
    c.svg.push(rect(0, 0, c.W, ph, 0, mix(c.cfg.colors.primary, "#FFFFFF", 0.82)));
    const p = await phone(file, c.W / 2, Math.round(c.pad * 0.6), Math.round(ph - c.pad * 1.1));
    c.svg.push(p.svg);
    c.over.push(p.layer);
    c.svg.push(rect(0, ph, c.W, c.H - ph, 0, panelColor));
  } else if (file) c.layers.push({ input: await cover(file, c.W, ph), left: 0, top: 0 });
  else c.svg.push(rect(0, 0, c.W, ph, 0, c.cfg.colors.primary));
  const w = c.W - c.pad * 2;
  let y = ph + c.pad * 0.8;
  const eyebrow = sl(c, "eyebrow");
  if (eyebrow) {
    c.svg.push(
      label("inter_bold", eyebrow, 24 * c.s, {
        x: c.pad,
        y: y + 24 * c.s,
        color: readable(c.cfg.colors.accent, panelColor, 4.5),
        upper: true,
        track: 2 * c.s,
      }).svg,
    );
    y += 50 * c.s;
  }
  y += headline(c, { x: c.pad, top: y, w, color: ink, max: 78, min: 46, lines: 3, accentOn: panelColor });
  const body = sl(c, "body");
  if (body)
    y += 18 * c.s + para(c, body, { x: c.pad, top: y + 18 * c.s, w, color: ink, size: 34, lines: 3, opacity: 0.82 });
  const cta = sl(c, "cta");
  const by = c.H - c.pad - 72 * c.s;
  if (cta)
    pill(c, cta, {
      x: c.pad,
      y: by,
      h: 72 * c.s,
      bg: c.cfg.colors.ink,
      color: onColor(c.cfg.colors.ink, "#111111"),
      size: 28,
    });
  if (!(await logo(c, false, 72 * c.s, c.W - c.pad - 72 * c.s, by)))
    wordmark(c, c.W - c.pad, by + 50 * c.s, ink, "end");
};

/** "Reasons why" / benefit stack: headline, 3 to 5 checked bullets, optional photo card, CTA. */
const checklist: Tpl = async (c) => {
  const file = c.input.imageFile;
  const bg = c.cfg.colors.paper;
  const ink = onColor(bg, c.cfg.colors.ink);
  c.bg = { color: bg };
  const w = c.W - c.pad * 2;
  let y = c.pad * 1.1;
  const eyebrow = sl(c, "eyebrow");
  if (eyebrow) {
    c.svg.push(
      label("inter_bold", eyebrow, 24 * c.s, {
        x: c.pad,
        y: y + 24 * c.s,
        color: readable(c.cfg.colors.accent, bg, 4.5),
        upper: true,
        track: 2 * c.s,
      }).svg,
    );
    y += 52 * c.s;
  }
  y += headline(c, { x: c.pad, top: y, w, color: ink, max: 82, min: 50, lines: 3, accentOn: bg });
  y += 40 * c.s;
  const bullets = (c.slots.bullets ?? []).map(clean).filter(Boolean).slice(0, 5);
  const ctaH = 72 * c.s;
  const bottom = c.H - c.pad - ctaH - 40 * c.s;
  // photo card on the right when there is room (square-ish canvases) or on top of the bullets (tall ones)
  const tall = c.H / c.W > 1.2;
  let bx = c.pad;
  let bw = w;
  if (file) {
    if (tall) {
      // the bullets get what they need at a comfortable size; the photo takes everything that is left
      const est = bullets.reduce((a, b) => {
        const f = fit("inter_semibold", b, {
          max: 42 * c.s,
          min: 42 * c.s,
          maxW: w - 90 * c.s,
          maxLines: 2,
          lineH: 1.3,
        });
        return a + Math.max(f.lines.length * f.lineH, 52 * c.s) + 26 * c.s;
      }, 0);
      const ih = Math.round(Math.max(c.H * 0.2, Math.min(bottom - y - est - 36 * c.s, c.H * 0.46)));
      c.layers.push({
        input: await rounded(file, Math.round(w), ih, 28 * c.s),
        left: Math.round(c.pad),
        top: Math.round(y),
      });
      y += ih + 36 * c.s;
    } else {
      const iw = Math.round(w * 0.38);
      const ih = Math.round(bottom - y);
      c.layers.push({
        input: await rounded(file, iw, ih, 28 * c.s),
        left: Math.round(c.W - c.pad - iw),
        top: Math.round(y),
      });
      bw = w - iw - 40 * c.s;
    }
  }
  const room = bottom - y;
  const rowGap = 26 * c.s;
  const size = Math.min(50, Math.max(30, (room / Math.max(1, bullets.length) - rowGap) / (2 * 1.28 * c.s)));
  const r = Math.round(size * 0.62) * c.s;
  const accentBg = c.cfg.colors.accent;
  // a question headline means a self-check: empty boxes the reader ticks in their head, not pre-ticked answers
  const selfCheck = /\?\s*$/.test(peek(c, "headline"));
  for (const b of bullets) {
    if (selfCheck)
      c.svg.push(
        rect(
          bx + 2 * c.s,
          y + 4 * c.s,
          r * 2 - 4 * c.s,
          r * 2 - 4 * c.s,
          8 * c.s,
          "none",
          `stroke="${accentBg}" stroke-width="${4 * c.s}"`,
        ),
      );
    else c.svg.push(check(bx + r, y + r + 2 * c.s, r, accentBg, onColor(accentBg, c.cfg.colors.ink)));
    const h = para(c, b, {
      x: bx + r * 2 + 22 * c.s,
      top: y,
      w: bw - r * 2 - 22 * c.s,
      color: ink,
      size,
      lines: 2,
      font: "inter_semibold",
    });
    y += Math.max(h, r * 2) + rowGap;
  }
  bx = c.pad;
  const cta = sl(c, "cta");
  const by = c.H - c.pad - ctaH;
  if (cta)
    pill(c, cta, {
      x: bx,
      y: by,
      h: ctaH,
      bg: c.cfg.colors.ink,
      color: onColor(c.cfg.colors.ink, "#111111"),
      size: 28,
    });
  if (!(await logo(c, false, ctaH, c.W - c.pad - ctaH, by))) wordmark(c, c.W - c.pad, by + 50 * c.s, ink, "end");
};

/** Us vs them: headline, a two-column table with check/cross marks or short values. */
const comparison: Tpl = async (c) => {
  const bg = c.cfg.colors.paper;
  const ink = onColor(bg, c.cfg.colors.ink);
  c.bg = { color: bg };
  const w = c.W - c.pad * 2;
  let y = c.pad * 1.1;
  y += headline(c, { x: c.pad, top: y, w, color: ink, max: 76, min: 46, lines: 3, accentOn: bg });
  y += 46 * c.s;
  const rows = (c.slots.rows ?? []).slice(0, 6);
  const labelW = w * 0.44;
  const colW = (w - labelW) / 2;
  const headH = 84 * c.s;
  const ctaH = 70 * c.s;
  const room = c.H - c.pad - ctaH - 40 * c.s - y - headH;
  const rowH = Math.min(150 * c.s, room / Math.max(1, rows.length));
  const usX = c.pad + labelW;
  const themX = usX + colW;
  // highlighted "us" column
  c.svg.push(
    rect(
      usX + 6 * c.s,
      y - 10 * c.s,
      colW - 12 * c.s,
      headH + rowH * rows.length + 20 * c.s,
      26 * c.s,
      c.cfg.colors.accent,
      'opacity="0.14"',
    ),
  );
  const lt = clean(c.slots.leftLabel) || c.input.brand.name;
  const rt = clean(c.slots.rightLabel) || "Others";
  const fsz = 34 * c.s;
  c.svg.push(
    label("inter_bold", lt, fsz, {
      x: usX + colW / 2,
      y: y + headH / 2 + capHeight("inter_bold", fsz) / 2,
      color: ink,
      anchor: "middle",
    }).svg,
  );
  c.svg.push(
    label("inter_semibold", rt, fsz, {
      x: themX + colW / 2,
      y: y + headH / 2 + capHeight("inter_semibold", fsz) / 2,
      color: mix(ink, bg, 0.45),
      anchor: "middle",
    }).svg,
  );
  y += headH;
  const muted = mix(ink, bg, 0.5);
  for (const [i, row] of rows.entries()) {
    const ry = y + i * rowH;
    c.svg.push(rect(c.pad, ry, w, 2 * c.s, 0, mix(ink, bg, 0.88)));
    const cy = ry + rowH / 2;
    const ft = fit("inter_semibold", clean(row.label), {
      max: 40 * c.s,
      min: 24 * c.s,
      maxW: labelW - 20 * c.s,
      maxLines: 2,
      lineH: 1.2,
      balance: false,
    });
    const d = drawLines(ft, { x: c.pad, top: cy - (ft.lines.length * ft.lineH) / 2, boxW: labelW, color: ink });
    c.svg.push(d.svg);
    const cell = (v: string, x: number, isUs: boolean) => {
      const t = clean(v);
      const r = 32 * c.s;
      if (YES.test(t))
        c.svg.push(
          check(
            x + colW / 2,
            cy,
            r,
            isUs ? c.cfg.colors.accent : muted,
            isUs ? onColor(c.cfg.colors.accent, c.cfg.colors.ink) : "#FFFFFF",
          ),
        );
      else if (NO.test(t))
        c.svg.push(
          cross(
            x + colW / 2,
            cy,
            r,
            isUs ? c.cfg.colors.ink : mix(ink, bg, 0.75),
            isUs ? "#FFFFFF" : mix(ink, bg, 0.35),
          ),
        );
      else {
        const f2 = fit(isUs ? "inter_bold" : "inter_medium", t, {
          max: 34 * c.s,
          min: 20 * c.s,
          maxW: colW - 24 * c.s,
          maxLines: 2,
          lineH: 1.15,
        });
        c.svg.push(
          drawLines(f2, {
            x,
            top: cy - (f2.lines.length * f2.lineH) / 2,
            boxW: colW,
            color: isUs ? ink : muted,
            align: "center",
          }).svg,
        );
      }
    };
    cell(row.us, usX, true);
    cell(row.them, themX, false);
  }
  const by = c.H - c.pad - ctaH;
  const cta = sl(c, "cta");
  if (cta)
    pill(c, cta, {
      x: c.pad,
      y: by,
      h: ctaH,
      bg: c.cfg.colors.ink,
      color: onColor(c.cfg.colors.ink, "#111111"),
      size: 28,
    });
  const foot = sl(c, "footnote");
  if (foot) para(c, foot, { x: c.pad, top: by - 44 * c.s, w, color: muted, size: 20, lines: 1 });
  if (!(await logo(c, false, ctaH, c.W - c.pad - ctaH, by))) wordmark(c, c.W - c.pad, by + 48 * c.s, ink, "end");
};

/** Quote card: a real customer or doctor quote, big quote mark, attribution, optional photo backdrop. */
const quoteCard: Tpl = async (c) => {
  const file = c.input.imageFile;
  const dark = !!file;
  if (file) c.bg = await cover(file, c.W, c.H, { blur: 2, dim: 0.42 });
  else c.bg = { color: c.cfg.colors.paper };
  const ink = dark ? "#FFFFFF" : onColor(c.cfg.colors.paper, c.cfg.colors.ink);
  const w = c.W - c.pad * 2.2;
  const quote = sl(c, "quote") || sl(c, "headline");
  const ft = fit("serif_dm", `“${quote.replace(/^["“]|["”]$/g, "")}”`, {
    max: 74 * c.s,
    min: 40 * c.s,
    maxW: w,
    maxLines: 7,
    lineH: 1.16,
  });
  const blockH = ft.lines.length * ft.lineH;
  const attr = sl(c, "attribution");
  const total = 120 * c.s + blockH + (attr ? 90 * c.s : 0);
  let y = (c.H - total) / 2 - 30 * c.s;
  const qc = readable(c.cfg.colors.accent, dark ? "#000000" : c.cfg.colors.paper, 3);
  c.svg.push(label("serif_dm", "“", 220 * c.s, { x: c.W / 2, y: y + 150 * c.s, color: qc, anchor: "middle" }).svg);
  y += 120 * c.s;
  c.svg.push(drawLines(ft, { x: (c.W - w) / 2, top: y, boxW: w, color: ink, align: "center" }).svg);
  c.boxes.push({ x: (c.W - w) / 2, y, w, h: blockH, color: ink });
  y += blockH + 50 * c.s;
  if (attr)
    c.svg.push(
      label("inter_semibold", attr, 30 * c.s, { x: c.W / 2, y: y + 30 * c.s, color: ink, anchor: "middle" }).svg,
    );
  const by = c.H - c.pad - 70 * c.s;
  if (!(await logo(c, dark, 70 * c.s, c.W / 2 - 35 * c.s, by))) wordmark(c, c.W / 2, by + 48 * c.s, ink, "middle");
};

/** iPhone Notes look: native, low-polish, high trust. Title + list. */
const notesApp: Tpl = async (c) => {
  const paper = "#FFFFFF";
  const ink = "#1C1C1E";
  const yellow = "#E0A100";
  c.bg = { color: paper };
  const s = c.s;
  const top = c.H / c.W > 1.6 ? c.H * 0.08 : 40 * s;
  // status-ish bar and the Notes nav
  c.svg.push(label("inter_semibold", "9:41", 30 * s, { x: c.pad * 0.8, y: top + 34 * s, color: ink }).svg);
  c.svg.push(
    `<path d="M${c.pad * 0.6 + 18 * s} ${top + 96 * s} l-16 ${18 * s} l16 ${18 * s}" stroke="${yellow}" stroke-width="${5 * s}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
  c.svg.push(label("inter_regular", "Notes", 36 * s, { x: c.pad * 0.6 + 32 * s, y: top + 126 * s, color: yellow }).svg);
  c.svg.push(
    `<circle cx="${c.W - c.pad * 0.8}" cy="${top + 112 * s}" r="${20 * s}" fill="none" stroke="${yellow}" stroke-width="${4 * s}"/><circle cx="${c.W - c.pad * 0.8 - 8 * s}" cy="${top + 112 * s}" r="${2.6 * s}" fill="${yellow}"/><circle cx="${c.W - c.pad * 0.8}" cy="${top + 112 * s}" r="${2.6 * s}" fill="${yellow}"/><circle cx="${c.W - c.pad * 0.8 + 8 * s}" cy="${top + 112 * s}" r="${2.6 * s}" fill="${yellow}"/>`,
  );
  let y = top + 190 * s;
  const date = sl(c, "eyebrow") || "Today";
  c.svg.push(label("inter_regular", date, 26 * s, { x: c.W / 2, y, color: "#8E8E93", anchor: "middle" }).svg);
  y += 46 * s;
  const x = c.pad * 0.8;
  const w = c.W - x * 2;
  const title = sl(c, "headline");
  if (title) {
    const ft = fit("inter_bold", title, {
      max: 76 * s,
      min: 44 * s,
      maxW: w,
      maxLines: 3,
      lineH: 1.15,
      balance: false,
    });
    c.svg.push(drawLines(ft, { x, top: y, boxW: w, color: ink }).svg);
    c.boxes.push({ x, y, w, h: ft.lines.length * ft.lineH, color: ink });
    y += ft.lines.length * ft.lineH + 34 * s;
  }
  const body = sl(c, "body");
  if (body)
    y += para(c, body, { x, top: y, w, color: ink, size: 46, lines: 5, font: "inter_regular", lineH: 1.35 }) + 26 * s;
  const bullets = (c.slots.bullets ?? []).map(clean).filter(Boolean).slice(0, 7);
  const room = c.H - y - 120 * s;
  const size = Math.min(48, Math.max(28, room / Math.max(1, bullets.length) / (1.36 * 2 * s)));
  for (const b of bullets) {
    c.svg.push(
      `<circle cx="${x + 20 * s}" cy="${y + size * s * 0.62}" r="${19 * s}" fill="none" stroke="#C7C7CC" stroke-width="${3 * s}"/>`,
    );
    y +=
      para(c, b, {
        x: x + 64 * s,
        top: y,
        w: w - 64 * s,
        color: ink,
        size,
        lines: 2,
        font: "inter_regular",
        lineH: 1.32,
      }) +
      28 * s;
  }
  const foot = sl(c, "footnote") || c.cfg.ctaUrl;
  c.svg.push(
    label("inter_medium", foot, 26 * s, {
      x: c.W / 2,
      y: c.H - (c.H / c.W > 1.6 ? c.H * 0.1 : 46 * s),
      color: "#8E8E93",
      anchor: "middle",
    }).svg,
  );
};

/** A post card in the style of an X/Threads post from the brand's own account (never a fake third party). */
const postCard: Tpl = async (c) => {
  const file = c.input.imageFile;
  if (file) c.bg = await cover(file, c.W, c.H, { blur: 24, dim: 0.25 });
  else c.bg = { color: mix(c.cfg.colors.primary, "#FFFFFF", 0.85) };
  const s = c.s;
  const cw = c.W - c.pad * 1.6;
  const cx = (c.W - cw) / 2;
  const inner = cw - 80 * s;
  const text = sl(c, "body") || sl(c, "headline");
  const ft = fit("inter_regular", text, {
    max: 58 * s,
    min: 34 * s,
    maxW: inner,
    maxLines: 9,
    lineH: 1.3,
    balance: false,
  });
  const textH = ft.lines.length * ft.lineH;
  const cardH = 40 * s + 96 * s + 36 * s + textH + 70 * s;
  const cy = (c.H - cardH) / 2;
  c.defs.push(SHADOW("card", 22 * s, 0.22, 10 * s));
  c.svg.push(rect(cx, cy, cw, cardH, 36 * s, "#FFFFFF", 'filter="url(#card)"'));
  const av = 96 * s;
  const ax = cx + 40 * s;
  const ay = cy + 40 * s;
  const hasLogo = await logo(c, false, av, ax, ay);
  if (!hasLogo)
    c.svg.push(`<circle cx="${ax + av / 2}" cy="${ay + av / 2}" r="${av / 2}" fill="${c.cfg.colors.primary}"/>`);
  c.svg.push(
    label("inter_bold", c.input.brand.name, 34 * s, { x: ax + av + 24 * s, y: ay + 42 * s, color: "#0F1419" }).svg,
  );
  const handle = `@${c.input.brand.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  c.svg.push(label("inter_regular", handle, 28 * s, { x: ax + av + 24 * s, y: ay + 84 * s, color: "#536471" }).svg);
  const ty = ay + av + 36 * s;
  c.svg.push(drawLines(ft, { x: ax, top: ty, boxW: inner, color: "#0F1419" }).svg);
  c.boxes.push({ x: ax, y: ty, w: inner, h: textH, color: "#0F1419" });
};

/** One big number with its label (only numbers the brand provided). */
const stat: Tpl = async (c) => {
  const file = c.input.imageFile;
  const dark = !!file || luminance(c.cfg.colors.ink) < 0.3;
  if (file) c.bg = await cover(file, c.W, c.H, { dim: 0.55 });
  else c.bg = { color: c.cfg.colors.ink };
  const ink = "#FFFFFF";
  const w = c.W - c.pad * 2;
  const st = sl(c, "stat");
  const ft = fit(c.head, st, { max: 300 * c.s, min: 120 * c.s, maxW: w, maxLines: 1 });
  const lbl = sl(c, "statLabel");
  let y = c.H * 0.24;
  if (sl(c, "headline")) headline(c, { x: c.pad, top: c.pad * 1.2, w, color: ink, max: 60, min: 40, lines: 2 });
  c.svg.push(
    drawLines(ft, { x: c.pad, top: y, boxW: w, color: readable(c.cfg.colors.accent, "#000000", 3), align: "center" })
      .svg,
  );
  y += ft.lineH + 20 * c.s;
  if (lbl)
    y +=
      para(c, lbl, {
        x: c.pad,
        top: y,
        w,
        color: ink,
        size: 48,
        lines: 3,
        align: "center",
        font: "inter_bold",
        lineH: 1.2,
      }) +
      30 * c.s;
  const body = sl(c, "body");
  if (body)
    para(c, body, {
      x: c.pad * 1.3,
      top: y,
      w: w - c.pad * 0.6,
      color: ink,
      size: 32,
      lines: 3,
      align: "center",
      opacity: 0.85,
    });
  const foot = sl(c, "footnote");
  const by = c.H - c.pad - 70 * c.s;
  if (foot)
    para(c, foot, { x: c.pad, top: by - 50 * c.s, w, color: ink, size: 20, lines: 2, align: "center", opacity: 0.7 });
  if (!(await logo(c, dark, 70 * c.s, c.W / 2 - 35 * c.s, by))) wordmark(c, c.W / 2, by + 48 * c.s, ink, "middle");
};

/** Myth vs fact: two stacked cards. */
const mythFact: Tpl = async (c) => {
  const bg = c.cfg.colors.paper;
  const ink = onColor(bg, c.cfg.colors.ink);
  c.bg = { color: bg };
  const w = c.W - c.pad * 2;
  let y = c.pad * 1.1;
  const head = sl(c, "headline");
  const file = c.input.imageFile;
  if (file) {
    // photo band on top with the headline over a gradient: the cover of a myth-busting carousel
    const bh = Math.round(c.H * 0.36);
    c.layers.push({ input: await cover(file, c.W, bh), left: 0, top: 0 });
    if (head) {
      c.defs.push(
        `<linearGradient id="mb" x1="0" y1="0" x2="0" y2="1"><stop offset="0.05" stop-color="#000" stop-opacity="0.05"/><stop offset="0.5" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0.86"/></linearGradient>`,
      );
      c.svg.push(`<rect width="${c.W}" height="${bh}" fill="url(#mb)"/>`);
      const ft = fit(c.head, head, { max: 64 * c.s, min: 40 * c.s, maxW: w, maxLines: 2, lineH: 1.08 });
      const top = bh - 36 * c.s - ft.lines.length * ft.lineH;
      const accent = sl(c, "accentWord");
      c.svg.push(
        drawLines(ft, {
          x: c.pad,
          top,
          boxW: w,
          color: "#FFFFFF",
          accent: accent ? { words: [accent], color: readable(c.cfg.colors.accent, "#000000", 3) } : undefined,
        }).svg,
      );
      c.boxes.push({ x: c.pad, y: top, w, h: ft.lines.length * ft.lineH, color: "#FFFFFF" });
    }
    y = bh + 36 * c.s;
  } else if (head)
    y += headline(c, { x: c.pad, top: y, w, color: ink, max: 64, min: 42, lines: 2, accentOn: bg }) + 40 * c.s;
  const bottom = c.H - c.pad - 110 * c.s;
  const cardH = (bottom - y - 30 * c.s) / 2;
  const card = (kind: "myth" | "fact", text: string, top: number) => {
    const isMyth = kind === "myth";
    const fill = isMyth ? mix(ink, bg, 0.92) : c.cfg.colors.ink;
    const tc = isMyth ? mix(ink, bg, 0.15) : onColor(c.cfg.colors.ink, "#111111");
    c.svg.push(rect(c.pad, top, w, cardH, 30 * c.s, fill));
    const tagBg = isMyth ? "#D64545" : c.cfg.colors.accent;
    const tag = kind === "myth" ? sl(c, "leftLabel") || "Myth" : sl(c, "rightLabel") || "Fact";
    pill(c, tag, {
      x: c.pad + 36 * c.s,
      y: top + 36 * c.s,
      h: 52 * c.s,
      bg: tagBg,
      color: onColor(tagBg, "#111111"),
      size: 22,
      upper: true,
      track: 2 * c.s,
    });
    const tagBottom = top + 36 * c.s + 52 * c.s;
    const ft = fitBox(isMyth ? "inter_semibold" : "inter_bold", text, {
      max: 62 * c.s,
      min: 24 * c.s,
      maxW: w - 72 * c.s,
      maxH: top + cardH - tagBottom - 56 * c.s,
      lineH: 1.2,
      balance: false,
    });
    const ty = tagBottom + Math.max(28 * c.s, (top + cardH - tagBottom - ft.lines.length * ft.lineH) / 2 - 10 * c.s);
    c.svg.push(drawLines(ft, { x: c.pad + 36 * c.s, top: ty, boxW: w - 72 * c.s, color: tc }).svg);
    c.boxes.push({ x: c.pad + 36 * c.s, y: ty, w: w - 72 * c.s, h: ft.lines.length * ft.lineH, color: tc });
    if (isMyth) {
      for (const [i, line] of ft.lines.entries()) {
        const lw = measure(ft.font, line, ft.size);
        const ly = ty + i * ft.lineH + ft.size * 0.55;
        c.svg.push(rect(c.pad + 36 * c.s, ly, lw, 3 * c.s, 0, "#D64545", 'opacity="0.55"'));
      }
    }
  };
  card("myth", sl(c, "myth"), y);
  card("fact", sl(c, "fact"), y + cardH + 30 * c.s);
  const by = c.H - c.pad - 70 * c.s;
  const cta = sl(c, "cta");
  if (cta)
    pill(c, cta, {
      x: c.pad,
      y: by,
      h: 70 * c.s,
      bg: c.cfg.colors.accent,
      color: onColor(c.cfg.colors.accent, c.cfg.colors.ink),
      size: 28,
    });
  if (!(await logo(c, false, 70 * c.s, c.W - c.pad - 70 * c.s, by)))
    wordmark(c, c.W - c.pad, by + 48 * c.s, ink, "end");
};

/** Offer card: product (brand image or phone) centred, headline, price/offer line, CTA. */
const offerCard: Tpl = async (c) => {
  const file = c.input.imageFile;
  const bg = mix(c.cfg.colors.primary, "#FFFFFF", 0.86);
  const ink = onColor(bg, c.cfg.colors.ink);
  c.bg = { color: bg };
  const w = c.W - c.pad * 2;
  let y = c.pad * 1.1;
  y += headline(c, { x: c.pad, top: y, w, color: ink, max: 80, min: 46, lines: 3, align: "center", accentOn: bg });
  const body = sl(c, "body");
  if (body)
    y +=
      16 * c.s +
      para(c, body, { x: c.pad, top: y + 16 * c.s, w, color: ink, size: 32, lines: 2, align: "center", opacity: 0.8 });
  y += 36 * c.s;
  const priceH = sl(c, "price") ? 100 * c.s : 0;
  const bottom = c.H - c.pad - 76 * c.s - 40 * c.s - priceH;
  const ih = Math.round(bottom - y);
  if (file && ih > 200 * c.s) {
    if (c.input.slide.image.source === "product") {
      const p = await phone(file, c.W / 2, Math.round(y), ih);
      c.svg.push(p.svg);
      c.over.push(p.layer);
    } else {
      const iw = Math.round(Math.min(w, ih * 1.1));
      c.layers.push({
        input: await rounded(file, iw, ih, 34 * c.s),
        left: Math.round((c.W - iw) / 2),
        top: Math.round(y),
      });
    }
  }
  const price = sl(c, "price");
  if (price) {
    const ft = fit(c.head, price, { max: 64 * c.s, min: 36 * c.s, maxW: w, maxLines: 1 });
    c.svg.push(
      drawLines(ft, {
        x: c.pad,
        top: bottom + 20 * c.s,
        boxW: w,
        color: readable(c.cfg.colors.accent, bg, 3),
        align: "center",
      }).svg,
    );
  }
  const by = c.H - c.pad - 76 * c.s;
  const cta = sl(c, "cta");
  if (cta)
    pill(c, cta, {
      x: c.W / 2,
      y: by,
      h: 76 * c.s,
      bg: c.cfg.colors.ink,
      color: onColor(c.cfg.colors.ink, "#111111"),
      size: 30,
      anchor: "middle",
    });
  const foot = sl(c, "footnote");
  if (foot)
    para(c, foot, {
      x: c.pad,
      top: c.H - c.pad * 0.55,
      w,
      color: ink,
      size: 18,
      lines: 1,
      align: "center",
      opacity: 0.6,
    });
};

/** Carousel body slide: solid colour, big number, headline and a short paragraph; optional inset image. */
const textSlide: Tpl = async (c) => {
  const i = c.input.index?.i ?? 0;
  const darkBg = i % 2 === 1;
  const bg = darkBg ? c.cfg.colors.ink : c.cfg.colors.paper;
  const ink = onColor(bg, c.cfg.colors.ink);
  c.bg = { color: bg };
  const w = c.W - c.pad * 2;
  const startSvg = c.svg.length;
  const startBoxes = c.boxes.length;
  let y = c.pad * 1.3;
  const eyebrow = sl(c, "eyebrow");
  if (eyebrow) {
    const ft = fit(c.head, eyebrow, { max: 120 * c.s, min: 60 * c.s, maxW: w, maxLines: 1 });
    c.svg.push(drawLines(ft, { x: c.pad, top: y, boxW: w, color: readable(c.cfg.colors.accent, bg, 3) }).svg);
    y += ft.lineH + 20 * c.s;
  }
  y += headline(c, { x: c.pad, top: y, w, color: ink, max: 96, min: 52, lines: 4, accentOn: bg });
  const body = sl(c, "body");
  if (body)
    y +=
      34 * c.s +
      para(c, body, {
        x: c.pad,
        top: y + 34 * c.s,
        w,
        color: ink,
        size: 46,
        lines: 6,
        opacity: 0.86,
        font: "inter_medium",
        lineH: 1.36,
      });
  const bullets = (c.slots.bullets ?? []).map(clean).filter(Boolean).slice(0, 4);
  if (bullets.length) y += 30 * c.s;
  for (const b of bullets) {
    c.svg.push(
      check(
        c.pad + 20 * c.s,
        y + 24 * c.s,
        20 * c.s,
        c.cfg.colors.accent,
        onColor(c.cfg.colors.accent, c.cfg.colors.ink),
      ),
    );
    y +=
      para(c, b, {
        x: c.pad + 60 * c.s,
        top: y,
        w: w - 60 * c.s,
        color: ink,
        size: 34,
        lines: 2,
        font: "inter_semibold",
      }) +
      20 * c.s;
  }
  const file = c.input.imageFile;
  const by = c.H - c.pad - 64 * c.s;
  if (!file) {
    // type only: centre the block in the space above the logo row instead of leaving the bottom half empty
    const free = by - 60 * c.s - y;
    const dy = Math.max(0, free * 0.42);
    if (dy > 20 * c.s) {
      const moved = c.svg.splice(startSvg);
      c.svg.push(`<g transform="translate(0 ${dy.toFixed(1)})">${moved.join("")}</g>`);
      for (const b of c.boxes.slice(startBoxes)) b.y += dy;
    }
  }
  if (file) {
    const room = by - 40 * c.s - (y + 40 * c.s);
    if (room > 220 * c.s) {
      if (c.input.slide.image.source === "product") {
        const p = await phone(file, c.W / 2, Math.round(y + 40 * c.s), Math.round(room));
        c.svg.push(p.svg);
        c.over.push(p.layer);
      } else
        c.layers.push({
          input: await rounded(file, Math.round(w), Math.round(room), 28 * c.s),
          left: Math.round(c.pad),
          top: Math.round(y + 40 * c.s),
        });
    }
  }
  if (!(await logo(c, darkBg, 64 * c.s, c.pad, by))) wordmark(c, c.pad, by + 46 * c.s, ink);
};

/** Last slide / end card: logo, headline, CTA pill with the URL. */
const ctaEnd: Tpl = async (c) => {
  const file = c.input.imageFile;
  if (file) c.bg = await cover(file, c.W, c.H, { dim: 0.5 });
  else c.bg = { color: c.cfg.colors.primary };
  const bgc = file ? "#000000" : c.cfg.colors.primary;
  const ink = file ? "#FFFFFF" : onColor(c.cfg.colors.primary, c.cfg.colors.ink);
  const w = c.W - c.pad * 2;
  const logoS = 150 * c.s;
  const ft = fit(c.head, sl(c, "headline"), { max: 86 * c.s, min: 52 * c.s, maxW: w, maxLines: 3, lineH: 1.08 });
  const hh = ft.lines.length * ft.lineH;
  const body = sl(c, "body");
  const total = logoS + 50 * c.s + hh + (body ? 120 * c.s : 0) + 60 * c.s + 92 * c.s;
  let y = (c.H - total) / 2;
  if (!(await logo(c, !!file || luminance(c.cfg.colors.primary) < 0.4, logoS, c.W / 2 - logoS / 2, y)))
    wordmark(c, c.W / 2, y + logoS * 0.6, ink, "middle");
  y += logoS + 50 * c.s;
  const accent = sl(c, "accentWord");
  c.svg.push(
    drawLines(ft, {
      x: c.pad,
      top: y,
      boxW: w,
      color: ink,
      align: "center",
      accent: accent ? { words: [accent], color: readable(c.cfg.colors.accent, bgc, 3) } : undefined,
    }).svg,
  );
  c.boxes.push({ x: c.pad, y, w, h: hh, color: ink });
  y += hh;
  if (body)
    y +=
      24 * c.s +
      para(c, body, { x: c.pad, top: y + 24 * c.s, w, color: ink, size: 34, lines: 2, align: "center", opacity: 0.88 });
  y += 60 * c.s;
  const cta = sl(c, "cta") || c.cfg.ctaUrl;
  const pbg = file ? c.cfg.colors.accent : c.cfg.colors.ink;
  pill(c, cta, { x: c.W / 2, y, h: 92 * c.s, bg: pbg, color: onColor(pbg, "#111111"), size: 36, anchor: "middle" });
  if (sl(c, "cta") && c.cfg.ctaUrl && !cta.includes(c.cfg.ctaUrl))
    c.svg.push(
      label("inter_semibold", c.cfg.ctaUrl, 28 * c.s, { x: c.W / 2, y: y + 150 * c.s, color: ink, anchor: "middle" })
        .svg,
    );
  const foot = sl(c, "footnote");
  if (foot)
    para(c, foot, {
      x: c.pad,
      top: c.H - c.pad - 30 * c.s,
      w,
      color: ink,
      size: 20,
      lines: 2,
      align: "center",
      opacity: 0.7,
    });
};

/** UGC photo with native caption boxes (white rounded box, black text), no logo: reads as a post, not an ad. */
const ugcCaption: Tpl = async (c) => {
  const file = c.input.imageFile;
  c.bg = file ? await cover(file, c.W, c.H) : { color: c.cfg.colors.ink };
  const w = c.W - c.pad * 2.4;
  const tall = c.H / c.W > 1.6;
  let y = c.H * (tall ? 0.24 : 0.2);
  const box = (text: string, size: number) => {
    if (!text) return;
    const ft = fit("tiktok_bold", text, { max: size * c.s, min: 32 * c.s, maxW: w, maxLines: 3, lineH: 1.2 });
    const lineBoxes = ft.lines.map((l) => measure(ft.font, l, ft.size));
    const padX = 26 * c.s;
    const padY = 12 * c.s;
    for (const [i, lw] of lineBoxes.entries()) {
      const bx = (c.W - lw) / 2 - padX;
      const by = y + i * ft.lineH - padY + ft.lineH * 0.04;
      c.svg.push(rect(bx, by, lw + padX * 2, ft.lineH + padY * 1.2, 14 * c.s, "#FFFFFF"));
    }
    c.svg.push(drawLines(ft, { x: (c.W - w) / 2, top: y, boxW: w, color: "#111111", align: "center" }).svg);
    c.boxes.push({ x: (c.W - w) / 2, y, w, h: ft.lines.length * ft.lineH, color: "#111111" });
    y += ft.lines.length * ft.lineH + 48 * c.s;
  };
  box(sl(c, "headline"), 54);
  box(sl(c, "body"), 44);
  await smallMark(c);
};

/** A short letter from a real doctor or founder: paper, header, lines, signature, small portrait. */
const letter: Tpl = async (c) => {
  const paper = "#FBF8F1";
  const ink = "#24221F";
  c.bg = { color: paper };
  const s = c.s;
  const x = c.pad * 1.1;
  const w = c.W - x * 2;
  let y = c.pad * 1.2;
  const header = sl(c, "eyebrow");
  if (header) {
    c.svg.push(
      label("inter_semibold", header, 28 * s, {
        x,
        y: y + 28 * s,
        color: readable(c.cfg.colors.accent, paper, 4.5),
        upper: true,
        track: 2 * s,
      }).svg,
    );
    y += 64 * s;
  }
  y += headline(c, { x, top: y, w, color: ink, max: 64, min: 42, lines: 3, accentOn: paper }) + 30 * s;
  c.svg.push(rect(x, y, 120 * s, 4 * s, 2, c.cfg.colors.accent));
  y += 44 * s;
  const lines = [sl(c, "body"), ...(c.slots.bullets ?? []).map(clean)].filter(Boolean);
  for (const t of lines)
    y += para(c, t, { x, top: y, w, color: ink, size: 48, lines: 4, font: "serif_dm", lineH: 1.3 }) + 30 * s;
  const sig = sl(c, "attribution");
  const file = c.input.imageFile;
  const by = c.H - c.pad * 1.1 - 130 * s;
  if (file) {
    const sz = Math.round(130 * s);
    c.over.push({ input: await rounded(file, sz, sz, sz / 2), left: Math.round(x), top: Math.round(by) });
  }
  if (sig) {
    const sx = x + (file ? 160 * s : 0);
    c.svg.push(label("handwritten", sig.split(",")[0]!, 64 * s, { x: sx, y: by + 64 * s, color: ink }).svg);
    const cred = sig.includes(",") ? sig.slice(sig.indexOf(",") + 1).trim() : "";
    if (cred)
      c.svg.push(label("inter_medium", cred, 24 * s, { x: sx, y: by + 108 * s, color: mix(ink, paper, 0.4) }).svg);
  }
  if (!(await logo(c, false, 64 * s, c.W - c.pad - 64 * s, c.H - c.pad - 64 * s)))
    wordmark(c, c.W - c.pad, c.H - c.pad - 10 * s, ink, "end");
};

/** Quiz: a question and 3 to 4 answer pills, then the CTA. */
const quiz: Tpl = async (c) => {
  const file = c.input.imageFile;
  const bg = c.cfg.colors.paper;
  const ink = onColor(bg, c.cfg.colors.ink);
  c.bg = { color: bg };
  const w = c.W - c.pad * 2;
  let y = c.pad * 1.1;
  const eyebrow = sl(c, "eyebrow");
  if (eyebrow) {
    c.svg.push(
      label("inter_bold", eyebrow, 24 * c.s, {
        x: c.pad,
        y: y + 24 * c.s,
        color: readable(c.cfg.colors.accent, bg, 4.5),
        upper: true,
        track: 2 * c.s,
      }).svg,
    );
    y += 52 * c.s;
  }
  y += headline(c, { x: c.pad, top: y, w, color: ink, max: 80, min: 46, lines: 3, accentOn: bg }) + 44 * c.s;
  const opts = (c.slots.bullets ?? []).map(clean).filter(Boolean).slice(0, 4);
  const limit = c.H - c.pad - 76 * c.s - 34 * c.s;
  let h = 112 * c.s;
  let ih = file ? Math.round(Math.min(c.H * 0.42, limit - y - opts.length * (h + 22 * c.s) - 36 * c.s)) : 0;
  const need = () => (ih ? ih + 36 * c.s : 0) + opts.length * (h + 22 * c.s);
  // nothing may run into the CTA row: shrink the photo first, then the answer rows, then drop the photo
  while (need() > limit - y && ih > c.H * 0.15) ih -= 10 * c.s;
  while (need() > limit - y && h > 92 * c.s) h -= 4 * c.s;
  if (need() > limit - y) ih = 0;
  if (file && ih) {
    c.layers.push({
      input: await rounded(file, Math.round(w), Math.round(ih), 26 * c.s),
      left: Math.round(c.pad),
      top: Math.round(y),
    });
    y += ih + 36 * c.s;
  }
  for (const [i, o] of opts.entries()) {
    c.svg.push(rect(c.pad, y, w, h, 24 * c.s, "#FFFFFF", `stroke="${mix(ink, bg, 0.8)}" stroke-width="${3 * c.s}"`));
    const letterC = String.fromCharCode(65 + i);
    c.svg.push(`<circle cx="${c.pad + 56 * c.s}" cy="${y + h / 2}" r="${28 * c.s}" fill="${c.cfg.colors.accent}"/>`);
    c.svg.push(
      label("inter_bold", letterC, 28 * c.s, {
        x: c.pad + 56 * c.s,
        y: y + h / 2 + capHeight("inter_bold", 28 * c.s) / 2,
        color: onColor(c.cfg.colors.accent, c.cfg.colors.ink),
        anchor: "middle",
      }).svg,
    );
    const ft = fit("inter_semibold", o, {
      max: 46 * c.s,
      min: 26 * c.s,
      maxW: w - 140 * c.s,
      maxLines: 2,
      lineH: 1.15,
      balance: false,
    });
    c.svg.push(
      drawLines(ft, {
        x: c.pad + 110 * c.s,
        top: y + (h - ft.lines.length * ft.lineH) / 2,
        boxW: w - 140 * c.s,
        color: "#1C1C1E",
      }).svg,
    );
    y += h + 22 * c.s;
  }
  const by = c.H - c.pad - 76 * c.s;
  const cta = sl(c, "cta");
  if (cta)
    pill(c, cta, {
      x: c.pad,
      y: by,
      h: 76 * c.s,
      bg: c.cfg.colors.ink,
      color: onColor(c.cfg.colors.ink, "#111111"),
      size: 30,
    });
  if (!(await logo(c, false, 76 * c.s, c.W - c.pad - 76 * c.s, by)))
    wordmark(c, c.W - c.pad, by + 52 * c.s, ink, "end");
};

/** A handwritten sticky note on a real photo (fridge, laptop, crate). */
const sticky: Tpl = async (c) => {
  const file = c.input.imageFile;
  c.bg = file ? await cover(file, c.W, c.H, { dim: 0.08 }) : { color: c.cfg.colors.paper };
  const s = c.s;
  const nw = Math.round(c.W * 0.6);
  const text = sl(c, "headline");
  const ft = fit("handwritten", text, { max: 100 * s, min: 52 * s, maxW: nw - 90 * s, maxLines: 6, lineH: 1.05 });
  // the note is as tall as its words (plus margins), never a half-empty square
  const nh = Math.max(nw * 0.5, ft.lines.length * ft.lineH + 150 * s);
  const nx = (c.W - nw) / 2;
  const ny = c.H * (c.H / c.W > 1.6 ? 0.28 : 0.16);
  // paper, not a UI card: soft contact shadow, a lit-to-shaded gradient, a lifted bottom corner, a strip of tape
  c.defs.push(
    `<filter id="note" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="${4 * s}" dy="${10 * s}" stdDeviation="${9 * s}" flood-color="#000" flood-opacity="0.28"/></filter>`,
    `<linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF19A"/><stop offset="0.6" stop-color="#FCE36E"/><stop offset="1" stop-color="#EFCF4F"/></linearGradient>`,
    `<linearGradient id="curl" x1="1" y1="1" x2="0.6" y2="0.6"><stop offset="0" stop-color="#000" stop-opacity="0.22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`,
  );
  const rot = -2.5;
  c.svg.push(`<g transform="rotate(${rot} ${c.W / 2} ${ny + nh / 2})">`);
  const curl = 46 * s;
  c.svg.push(
    `<path d="M${nx} ${ny} H${nx + nw} V${ny + nh - curl} Q${nx + nw - 4 * s} ${ny + nh - 4 * s} ${nx + nw - curl} ${ny + nh} H${nx} Z" fill="url(#paper)" filter="url(#note)"/>`,
    `<path d="M${nx + nw} ${ny + nh - curl} Q${nx + nw - 4 * s} ${ny + nh - 4 * s} ${nx + nw - curl} ${ny + nh} Q${nx + nw - curl * 0.55} ${ny + nh - curl * 0.55} ${nx + nw} ${ny + nh - curl} Z" fill="#E6C445"/>`,
    `<rect x="${nx}" y="${ny}" width="${nw}" height="${nh}" fill="url(#curl)" opacity="0.6"/>`,
    `<rect x="${nx + nw / 2 - 70 * s}" y="${ny - 18 * s}" width="${140 * s}" height="${40 * s}" fill="#FFFFFF" opacity="0.55" transform="rotate(3 ${nx + nw / 2} ${ny})"/>`,
  );
  const accent = sl(c, "accentWord");
  c.svg.push(
    drawLines(ft, {
      x: nx + 45 * s,
      top: ny + 46 * s + (nh - 46 * s - ft.lines.length * ft.lineH) / 2,
      boxW: nw - 90 * s,
      color: "#2B2A26",
      align: "center",
      accent: accent ? { words: [accent], color: "#C23A2B" } : undefined,
    }).svg,
  );
  c.svg.push("</g>");
  const body = sl(c, "body");
  if (body) {
    const by = ny + nh + 80 * s;
    const f2 = fit("tiktok_bold", body, { max: 46 * s, min: 30 * s, maxW: c.W - c.pad * 2.4, maxLines: 2, lineH: 1.2 });
    const lw = Math.max(...f2.lines.map((l) => measure(f2.font, l, f2.size)));
    c.svg.push(
      rect((c.W - lw) / 2 - 26 * s, by - 14 * s, lw + 52 * s, f2.lines.length * f2.lineH + 22 * s, 14 * s, "#FFFFFF"),
    );
    c.svg.push(drawLines(f2, { x: c.pad * 1.2, top: by, boxW: c.W - c.pad * 2.4, color: "#111", align: "center" }).svg);
  }
  await smallMark(c);
};

/** How it works: 3 numbered steps (title + one line each). Bullets are "Title: line". */
const steps: Tpl = async (c) => {
  const bg = c.cfg.colors.paper;
  const ink = onColor(bg, c.cfg.colors.ink);
  c.bg = { color: bg };
  const w = c.W - c.pad * 2;
  let y = c.pad * 1.1;
  y += headline(c, { x: c.pad, top: y, w, color: ink, max: 80, min: 48, lines: 3, accentOn: bg }) + 56 * c.s;
  const items = (c.slots.bullets ?? []).map(clean).filter(Boolean).slice(0, 4);
  const bottom = c.H - c.pad - 76 * c.s - 50 * c.s;
  const step = (bottom - y) / Math.max(1, items.length);
  const r = 40 * c.s;
  for (const [i, it] of items.entries()) {
    const [title, ...rest] = it.split(/:\s+/);
    const line = rest.join(": ");
    const cy = y + i * step;
    if (i < items.length - 1)
      c.svg.push(rect(c.pad + r - 2 * c.s, cy + r * 2, 4 * c.s, step - r * 2, 2, mix(ink, bg, 0.8)));
    c.svg.push(`<circle cx="${c.pad + r}" cy="${cy + r}" r="${r}" fill="${c.cfg.colors.accent}"/>`);
    c.svg.push(
      label(c.head, String(i + 1), 40 * c.s, {
        x: c.pad + r,
        y: cy + r + capHeight(c.head, 40 * c.s) / 2,
        color: onColor(c.cfg.colors.accent, c.cfg.colors.ink),
        anchor: "middle",
      }).svg,
    );
    const tx = c.pad + r * 2 + 34 * c.s;
    const tw = w - r * 2 - 34 * c.s;
    const th = para(c, title ?? it, {
      x: tx,
      top: cy,
      w: tw,
      color: ink,
      size: 46,
      lines: 2,
      font: "inter_bold",
      lineH: 1.15,
    });
    if (line) para(c, line, { x: tx, top: cy + th + 10 * c.s, w: tw, color: ink, size: 34, lines: 2, opacity: 0.78 });
  }
  const by = c.H - c.pad - 76 * c.s;
  const cta = sl(c, "cta");
  if (cta)
    pill(c, cta, {
      x: c.pad,
      y: by,
      h: 76 * c.s,
      bg: c.cfg.colors.ink,
      color: onColor(c.cfg.colors.ink, "#111111"),
      size: 30,
    });
  const foot = sl(c, "footnote");
  if (foot) para(c, foot, { x: c.pad, top: by - 46 * c.s, w, color: ink, size: 20, lines: 1, opacity: 0.6 });
  if (!(await logo(c, false, 76 * c.s, c.W - c.pad - 76 * c.s, by)))
    wordmark(c, c.W - c.pad, by + 52 * c.s, ink, "end");
};

/** Centred brand mark at the top: the logo image, or the name set in the headline font. */
async function centredMark(c: Ctx, y: number, onDark: boolean, size = 64) {
  const s = c.s;
  if (await logo(c, onDark, size * 1.6 * s, c.W / 2 - size * 0.8 * s, y)) return y + size * 1.6 * s;
  const color = onDark ? "#FFFFFF" : c.cfg.colors.ink;
  const name = c.input.brand.name;
  const dot = name.indexOf(".");
  if (dot > 0) {
    // brand names with a dot (a.clinic): the dot in the accent colour, like the real wordmark
    const fz = size * s;
    const f = fitBox(c.head, name, { max: fz, min: fz, maxW: c.W, maxH: fz * 2 });
    const total = measure(f.font, name, f.size);
    const x0 = c.W / 2 - total / 2;
    const before = name.slice(0, dot);
    const wb = measure(f.font, before, f.size);
    const wd = measure(f.font, ".", f.size);
    c.svg.push(label(c.head, before, f.size, { x: x0, y: y + fz, color }).svg);
    c.svg.push(label(c.head, ".", f.size, { x: x0 + wb, y: y + fz, color: c.cfg.colors.accent }).svg);
    c.svg.push(label(c.head, name.slice(dot + 1), f.size, { x: x0 + wb + wd, y: y + fz, color }).svg);
  } else c.svg.push(label(c.head, name, size * s, { x: c.W / 2, y: y + size * s, color, anchor: "middle" }).svg);
  return y + size * 1.3 * s;
}

/**
 * The emotional hook (the operator's own best-performing layout): a calm photo dimmed, the wordmark centred at
 * the top, a short first-person or reframe headline centred, one sub-line, and a big white button.
 */
const hookOverlay: Tpl = async (c) => {
  const file = c.input.imageFile;
  // a light dim keeps the photo alive; the darkening sits in a soft band behind the type only
  c.bg = file ? await cover(file, c.W, c.H, { dim: 0.12 }) : { color: c.cfg.colors.primary };
  const s = c.s;
  const w = c.W - c.pad * 2.4;
  const head = sl(c, "headline");
  const ft = fit(c.head, head, { max: 84 * s, min: 52 * s, maxW: w, maxLines: 4, lineH: 1.12 });
  const body = sl(c, "body");
  const bf = body ? fit(c.body, body, { max: 42 * s, min: 32 * s, maxW: w, maxLines: 2, lineH: 1.25 }) : null;
  const blockH = ft.lines.length * ft.lineH + (bf ? 30 * s + bf.lines.length * bf.lineH : 0);
  // centred like the original layout, unless the middle of the photo is where the face is: then the type goes up
  let center = c.H * 0.47;
  if (file && !("color" in c.bg)) {
    const busy = async (top: number, height: number) =>
      (
        await sharp(c.bg as Buffer)
          .extract({
            left: Math.round(c.W * 0.15),
            top: Math.round(top),
            width: Math.round(c.W * 0.7),
            height: Math.round(height),
          })
          .greyscale()
          .resize(100, 50, { fit: "fill" })
          .stats()
      ).channels[0]!.stdev;
    const mid = await busy(c.H * 0.34, c.H * 0.28);
    const upper = await busy(c.H * 0.22, c.H * 0.22);
    if (mid > upper * 1.2) center = c.H * 0.24 + blockH / 2 + 40 * s;
  }
  const top0 = center - blockH / 2;
  if (file) {
    const a = Math.max(0, (top0 - 160 * s) / c.H);
    const m1 = Math.min(1, (top0 + 20 * s) / c.H);
    const m2 = Math.min(1, (top0 + blockH - 20 * s) / c.H);
    const b = Math.min(1, (top0 + blockH + 160 * s) / c.H);
    c.defs.push(
      `<linearGradient id="hb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.18"/><stop offset="${a.toFixed(3)}" stop-color="#000" stop-opacity="0.08"/><stop offset="${m1.toFixed(3)}" stop-color="#000" stop-opacity="0.5"/><stop offset="${m2.toFixed(3)}" stop-color="#000" stop-opacity="0.5"/><stop offset="${b.toFixed(3)}" stop-color="#000" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient>`,
    );
    c.svg.push(`<rect width="${c.W}" height="${c.H}" fill="url(#hb)"/>`);
  }
  await centredMark(c, Math.min(c.H * 0.1, top0 - 130 * s), true, 60);
  let y = top0;
  const accent = sl(c, "accentWord");
  c.svg.push(
    drawLines(ft, {
      x: (c.W - w) / 2,
      top: y,
      boxW: w,
      color: "#FFFFFF",
      align: "center",
      accent: accent
        ? { words: [accent], color: readable(mix(c.cfg.colors.accent, "#FFFFFF", 0.35), "#000000", 4.5) }
        : undefined,
    }).svg,
  );
  c.boxes.push({ x: (c.W - w) / 2, y, w, h: ft.lines.length * ft.lineH, color: "#FFFFFF" });
  y += ft.lines.length * ft.lineH;
  if (bf) {
    y += 30 * s;
    c.svg.push(
      drawLines(bf, { x: (c.W - w) / 2, top: y, boxW: w, color: "#FFFFFF", align: "center", opacity: 0.96 }).svg,
    );
    c.boxes.push({ x: (c.W - w) / 2, y, w, h: bf.lines.length * bf.lineH, color: "#FFFFFF" });
  }
  const cta = sl(c, "cta");
  if (cta) {
    const h = 118 * s;
    const fz = 38 * s;
    const tw = label("inter_medium", cta, fz, { x: 0, y: 0, color: "#111" }).width;
    const bw = Math.min(c.W - c.pad * 2, tw + 120 * s);
    const by = c.H * 0.86 - h / 2;
    c.svg.push(rect((c.W - bw) / 2, by, bw, h, h / 2, "#FFFFFF"));
    c.svg.push(
      label("inter_medium", cta, fz, {
        x: c.W / 2,
        y: by + h / 2 + capHeight("inter_medium", fz) / 2,
        color: "#111111",
        anchor: "middle",
      }).svg,
    );
  }
};

/**
 * How it works in four photos (the operator's own layout): light background, wordmark and headline centred, a 2x2
 * grid of photos with black numbered squares, and a short caption under each.
 */
const stepsGrid: Tpl = async (c) => {
  const bg = "#F4F4F2";
  c.bg = { color: bg };
  const s = c.s;
  const ink = c.cfg.colors.ink;
  let y = await centredMark(c, c.H * 0.045, false, 66);
  y += 36 * s;
  const head = sl(c, "headline");
  const ft = fit(c.head, head, { max: 62 * s, min: 40 * s, maxW: c.W - c.pad * 2, maxLines: 2, lineH: 1.15 });
  c.svg.push(drawLines(ft, { x: c.pad, top: y, boxW: c.W - c.pad * 2, color: ink, align: "center" }).svg);
  c.boxes.push({ x: c.pad, y, w: c.W - c.pad * 2, h: ft.lines.length * ft.lineH, color: ink });
  y += ft.lines.length * ft.lineH + 50 * s;
  const caps = (c.slots.bullets ?? []).map(clean).filter(Boolean).slice(0, 4);
  const files = (c.input.imageFiles?.length ? c.input.imageFiles : c.input.imageFile ? [c.input.imageFile] : []).slice(
    0,
    4,
  );
  const gap = 56 * s;
  const cellW = (c.W - c.pad * 2.4 - gap) / 2;
  const capH = 96 * s;
  const rows = 2;
  const avail = c.H - y - c.pad * 0.6;
  const cellH = Math.min(cellW, (avail - rows * capH - gap * 0.4) / rows);
  const x0 = (c.W - (cellW * 2 + gap)) / 2;
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = x0 + col * (cellW + gap);
    const cy = y + row * (cellH + capH + gap * 0.4);
    const f = files[i] ?? files[i % Math.max(1, files.length)];
    if (f)
      c.layers.push({
        input: await rounded(f, Math.round(cellW), Math.round(cellH), 14 * s),
        left: Math.round(cx),
        top: Math.round(cy),
      });
    else c.svg.push(rect(cx, cy, cellW, cellH, 14 * s, mix(ink, bg, 0.9)));
    const b = 58 * s;
    c.svg.push(rect(cx - 14 * s, cy - 18 * s, b, b, 4 * s, "#111111"));
    c.svg.push(
      label("inter_bold", String(i + 1), 32 * s, {
        x: cx - 14 * s + b / 2,
        y: cy - 18 * s + b / 2 + capHeight("inter_bold", 32 * s) / 2,
        color: "#FFFFFF",
        anchor: "middle",
      }).svg,
    );
    const cap = caps[i] ?? "";
    if (cap) {
      const cf = fit("inter_bold", cap, { max: 32 * s, min: 22 * s, maxW: cellW, maxLines: 2, lineH: 1.2 });
      c.svg.push(drawLines(cf, { x: cx, top: cy + cellH + 22 * s, boxW: cellW, color: ink, align: "center" }).svg);
      c.boxes.push({ x: cx, y: cy + cellH + 22 * s, w: cellW, h: cf.lines.length * cf.lineH, color: ink });
    }
  }
};

/** The model rendered the whole ad (text included): cover-crop it to the canvas. */
const native: Tpl = async (c) => {
  const file = c.input.imageFile;
  c.bg = file ? await cover(file, c.W, c.H) : { color: c.cfg.colors.paper };
};

const TEMPLATES: Record<TemplateId, Tpl> = {
  photo_headline: photoHeadline,
  split_panel: splitPanel,
  checklist,
  comparison,
  quote_card: quoteCard,
  notes_app: notesApp,
  post_card: postCard,
  stat,
  myth_fact: mythFact,
  offer_card: offerCard,
  text_slide: textSlide,
  cta_end: ctaEnd,
  ugc_caption: ugcCaption,
  letter,
  quiz,
  sticky,
  steps,
  hook_overlay: hookOverlay,
  steps_grid: stepsGrid,
  native,
};

/** Which templates draw a full-bleed photo behind the type (image prompts must keep a calm zone). */
export const FULL_BLEED: TemplateId[] = [
  "hook_overlay",
  "photo_headline",
  "quote_card",
  "post_card",
  "stat",
  "cta_end",
  "ugc_caption",
  "sticky",
];
/** Templates that use an image at all (others are type and shapes only). */
export const USES_IMAGE: TemplateId[] = [
  "hook_overlay",
  "steps_grid",
  "photo_headline",
  "split_panel",
  "checklist",
  "quote_card",
  "post_card",
  "stat",
  "offer_card",
  "text_slide",
  "cta_end",
  "ugc_caption",
  "letter",
  "quiz",
  "sticky",
  "native",
];

export interface RenderResult {
  file: string;
  /** smallest text contrast found against the actual pixels behind it (WCAG ratio) */
  minContrast: number;
}

/** Render one slide to PNG. */
export async function renderSlide(input: RenderInput): Promise<RenderResult> {
  const { w: W, h: H } = SIZE[input.aspect];
  const s = W / 1080;
  const c: Ctx = {
    W,
    H,
    s,
    pad: 72 * s,
    cfg: input.brand.config,
    slots: input.slide.slots,
    head: input.brand.config.fonts.head,
    body: input.brand.config.fonts.body === "inter" ? "inter_medium" : input.brand.config.fonts.body,
    svg: [],
    defs: [],
    layers: [],
    over: [],
    bg: { color: "#FFFFFF" },
    input,
    boxes: [],
  };
  await TEMPLATES[input.slide.template](c);
  if (input.slide.template !== "native") bottomFootnote(c, !("color" in c.bg));
  const base =
    "color" in c.bg
      ? await sharp({ create: { width: W, height: H, channels: 3, background: c.bg.color } })
          .png()
          .toBuffer()
      : c.bg;
  // layers under the type first (photos, phones), then the type and shapes on top
  const under = c.layers.length ? await sharp(base).composite(c.layers).png().toBuffer() : base;
  // the counter reads against whatever is actually behind its corner (a photo band, a panel)
  if (input.slide.template !== "native") {
    const corner = await sharp(under)
      .extract({
        left: Math.round(W - c.pad - 140 * s),
        top: Math.round(c.pad * 0.5),
        width: Math.round(140 * s),
        height: Math.round(70 * s),
      })
      .stats();
    counter(c, luminance(corner.channels.slice(0, 3).map((ch) => ch.mean)) < 0.45);
  }
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${c.defs.join("")}</defs>${c.svg.join("")}</svg>`,
  );
  fs.mkdirSync(path.dirname(input.out), { recursive: true });
  const final = await sharp(under)
    .composite([{ input: overlay }, ...c.over])
    .png()
    .toBuffer();
  await sharp(final).png({ compressionLevel: 8 }).toFile(input.out);
  const minContrast = await auditContrast(under, overlay, c.boxes, W, H);
  return { file: input.out, minContrast };
}

/**
 * Contrast audit: for each text box, compare the text colour to the median pixel of what is behind it (photo +
 * gradients, without the type). Returns the worst ratio; the generator flags slides under 3:1.
 */
async function auditContrast(
  under: Buffer,
  overlay: Buffer,
  boxes: Ctx["boxes"],
  W: number,
  H: number,
): Promise<number> {
  if (!boxes.length) return 21;
  // behind the text = photo + any non-text shapes; approximate with the composited image under the overlay,
  // darkened by the overlay's gradients: render the overlay alone and blend
  const withShapes = await sharp(under)
    .composite([{ input: overlay }])
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = withShapes;
  let worst = 21;
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x));
    const y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(W - 1, Math.ceil(b.x + b.w));
    const y1 = Math.min(H - 1, Math.ceil(b.y + b.h));
    const samples: number[][] = [];
    const tc = rgb(b.color);
    for (let y = y0; y <= y1; y += 6)
      for (let x = x0; x <= x1; x += 6) {
        const i = (y * info.width + x) * info.channels;
        const px = [data[i]!, data[i + 1]!, data[i + 2]!];
        // skip pixels that are the text itself
        if (Math.abs(px[0]! - tc[0]!) + Math.abs(px[1]! - tc[1]!) + Math.abs(px[2]! - tc[2]!) < 60) continue;
        samples.push(px);
      }
    if (samples.length < 8) continue;
    const lums = samples.map((p) => luminance(p)).sort((a, b2) => a - b2);
    // the 80th percentile background against the text: a few bright spots behind white text matter
    const bgL = luminance(b.color) > 0.5 ? lums[Math.floor(lums.length * 0.2)]! : lums[Math.floor(lums.length * 0.8)]!;
    const tl = luminance(b.color);
    const ratio = (Math.max(tl, bgL) + 0.05) / (Math.min(tl, bgL) + 0.05);
    worst = Math.min(worst, ratio);
  }
  return Math.round(worst * 10) / 10;
}

/** Small contact sheet of slides (review and the board). */
export async function contactSheet(files: string[], out: string, h = 420): Promise<string> {
  const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
  const ws = metas.map((m) => Math.round(((m.width ?? 1080) / (m.height ?? 1350)) * h));
  const gap = 12;
  const total = ws.reduce((a, b) => a + b, 0) + gap * (files.length + 1);
  const thumbs = await Promise.all(files.map((f, i) => sharp(f).resize(ws[i], h).png().toBuffer()));
  let x = gap;
  const comps = thumbs.map((input, i) => {
    const o = { input, left: x, top: gap };
    x += ws[i]! + gap;
    return o;
  });
  await sharp({ create: { width: total, height: h + gap * 2, channels: 3, background: "#141414" } })
    .composite(comps)
    .jpeg({ quality: 84 })
    .toFile(out);
  return out;
}

export { esc };
