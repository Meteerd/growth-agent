import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";
import type { CaptionStyle } from "@/contracts";

/**
 * Live captions (A18): CapCut / Hormozi style auto-captions rendered per frame. 1 to 3 words on screen, each word
 * pops in when it is spoken (ElevenLabs word timestamps), the spoken word is highlighted, key words slam bigger in
 * the accent colour, and the block breathes slightly so no frame is frozen. The look follows the winner's
 * CaptionStyle (font, case, colours, stroke, box, position). Glyphs are drawn as vector paths from bundled OFL
 * fonts (assets/fonts), so the result is identical on every machine and has no pixel-rounding jitter.
 */
const W = 1080;
const H = 1920;
/** outside the platform UI: status bar, caption + buttons (bottom ~20%), action rail (right ~15%) */
const SAFE = { top: 200, bottom: Math.round(H * 0.8), left: 70, right: Math.round(W * 0.85) };
export const FPS = 30;

export interface CapWord {
  word: string;
  start: number;
  end: number;
  /** key word: bigger, accent colour */
  emph?: boolean;
}

export interface CaptionTrack {
  style: CaptionStyle;
  words: CapWord[];
  /** where the captions sit over time (per shot, chosen to keep faces and the subject clear) */
  regions: { t0: number; t1: number; region: CaptionStyle["position"] }[];
  /** the hook title over the first shot */
  title?: { text: string; t0: number; t1: number };
}

export const HORMOZI: CaptionStyle = {
  font: "montserrat",
  weight: "black",
  case: "upper",
  sizePct: 8.5,
  fill: "#FFFFFF",
  accent: "#FFE14D",
  stroke: { color: "#000000", widthPct: 14 },
  shadow: true,
  background: "none",
  position: "middle",
  animation: "pop",
  wordsPerCaption: 3,
};

const FONT_FILES: Record<CaptionStyle["font"], [string, string]> = {
  tiktok_sans: ["TikTokSans-Bold.ttf", "TikTokSans-Black.ttf"],
  montserrat: ["Montserrat-ExtraBold.ttf", "Montserrat-Black.ttf"],
  poppins: ["Poppins-ExtraBold.ttf", "Poppins-ExtraBold.ttf"],
  inter: ["Inter-ExtraBold.ttf", "Inter-ExtraBold.ttf"],
  anton: ["Anton-Regular.ttf", "Anton-Regular.ttf"],
  bebas: ["BebasNeue-Regular.ttf", "BebasNeue-Regular.ttf"],
  serif_dm: ["DMSerifDisplay-Regular.ttf", "DMSerifDisplay-Regular.ttf"],
  serif_playfair: ["PlayfairDisplay-ExtraBold.ttf", "PlayfairDisplay-ExtraBold.ttf"],
  handwritten: ["Caveat-Bold.ttf", "Caveat-Bold.ttf"],
  jakarta: ["PlusJakartaSans-ExtraBold.ttf", "PlusJakartaSans-ExtraBold.ttf"],
};

const fonts = new Map<string, opentype.Font>();
export function fontFor(f: CaptionStyle["font"], weight: CaptionStyle["weight"] = "black"): opentype.Font {
  const file = FONT_FILES[f]?.[weight === "bold" ? 0 : 1] ?? FONT_FILES.montserrat[1];
  let font = fonts.get(file);
  if (!font) {
    font = opentype.loadSync(path.resolve("assets/fonts", file));
    fonts.set(file, font);
  }
  return font;
}

const applyCase = (t: string, c: CaptionStyle["case"]) =>
  c === "upper" ? t.toLocaleUpperCase() : c === "lower" ? t.toLocaleLowerCase() : t;

export interface CapGroup {
  words: CapWord[];
  t0: number;
  t1: number;
}

/**
 * Words -> groups of 1..n words: a group ends at punctuation, at a pause (> 0.35 s) or when full; each group shows
 * from its first word until the next group starts (at most a short hold after a pause), so the caption changes
 * every ~0.3 to 0.8 s while someone speaks and never holds longer than 1.2 s.
 */
export function groupWords(words: CapWord[], per = 3, maxChars = 24): CapGroup[] {
  // phrases of 2 to 4 words: a group ends at punctuation, at a real pause (> 0.45 s) or when full
  const max = Math.max(2, Math.min(4, per + 1));
  const groups: CapWord[][] = [];
  let cur: CapWord[] = [];
  const chars = (ws: CapWord[]) => ws.map((w) => w.word).join(" ").length;
  for (const [i, w] of words.entries()) {
    const prev = words[i - 1];
    const pause = prev ? w.start - prev.end > 0.45 : false;
    if (cur.length && (cur.length >= max || chars([...cur, w]) > maxChars || pause)) {
      groups.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.!?,;:…]$/.test(w.word) && cur.length >= 2) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  // readable pace (Mete, 11:24): a group is on screen for at least 0.8 s, so a short group joins its neighbour
  // (never a lone flashing word); merged groups may hold up to 5 words
  const span = (g: CapWord[], next?: CapWord[]) => (next?.[0]?.start ?? g.at(-1)!.end + 0.4) - g[0]!.start;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    const nx = groups[i + 1];
    if (
      (g.length === 1 || span(g, nx) < 0.8) &&
      nx &&
      g.length + nx.length <= 5 &&
      nx[0]!.start - g.at(-1)!.end < 0.6
    ) {
      groups[i] = [...g, ...nx];
      groups.splice(i + 1, 1);
      i--;
    } else if (g.length === 1 && i > 0 && groups[i - 1]!.length < 5 && g[0]!.start - groups[i - 1]!.at(-1)!.end < 0.6) {
      groups[i - 1] = [...groups[i - 1]!, ...g];
      groups.splice(i, 1);
      i -= 2;
      if (i < -1) i = -1;
    }
  }
  return groups.map((g, i) => {
    const t0 = g[0]!.start;
    const end = g.at(-1)!.end;
    const next = groups[i + 1]?.[0]?.start;
    // no blank flicker: the group holds until the next one appears (or a short hold after the last word)
    const t1 = next !== undefined && next - end < 1.2 ? next : Math.max(end + 0.5, t0 + 0.8);
    return { words: g, t0, t1: next !== undefined ? Math.min(t1, next) : t1 };
  });
}

/** Key words: numbers, words written in capitals, and the brand/offer words passed in. */
export function markEmphasis(words: CapWord[], keys: string[] = []): CapWord[] {
  const k = new Set(keys.map((x) => x.toLocaleLowerCase()));
  return words.map((w) => {
    const bare = w.word.replace(/[^\p{L}\p{N}%+]/gu, "");
    const emph =
      /\d/.test(bare) ||
      (bare.length >= 3 && bare === bare.toLocaleUpperCase() && /\p{L}/u.test(bare)) ||
      k.has(bare.toLocaleLowerCase());
    return emph ? { ...w, emph: true } : w;
  });
}

const ease = (x: number) => 1 - (1 - x) ** 3;

/**
 * A damped spring from `from` to 1 (underdamped: zeta 0.28, omega 33 rad/s): 0.85 -> ~1.06 at ~100 ms -> 1.0,
 * settled by ~0.3 s. Real easing, not linear (the same maths as Remotion's spring()).
 */
export function spring(age: number, from = 0.85): number {
  if (age <= 0) return from;
  const z = 0.28;
  const w0 = 33;
  const wd = w0 * Math.sqrt(1 - z * z);
  const e = Math.exp(-z * w0 * age);
  return 1 - (1 - from) * e * (Math.cos(wd * age) + ((z * w0) / wd) * Math.sin(wd * age));
}

/** Scale of a word `age` seconds after it was spoken (pop: 80% -> 110% -> 100% in ~160 ms). */
export function popScale(age: number, anim: CaptionStyle["animation"], emph = false): number {
  if (age < 0) return 0;
  // key words slam in from bigger; the others spring up from 85%
  if (anim === "spring") return emph ? spring(age, 1.35) : spring(age, 0.85);
  if (anim === "fade" || anim === "typewriter") return 1;
  const peak = emph ? 1.22 : anim === "bounce" ? 1.14 : 1.1;
  if (age < 0.08) return 0.8 + (peak - 0.8) * ease(age / 0.08);
  if (age < 0.18) return peak - (peak - 1) * ease((age - 0.08) / 0.1);
  return 1;
}

function regionAt(tr: CaptionTrack, t: number): CaptionStyle["position"] {
  return tr.regions.find((r) => t >= r.t0 && t < r.t1)?.region ?? tr.style.position;
}

function centreY(region: CaptionStyle["position"], blockH: number): number {
  const c = region === "upper" ? H * 0.3 : region === "middle" ? H * 0.52 : SAFE.bottom - 90 - blockH / 2;
  return Math.min(Math.max(c, SAFE.top + blockH / 2), SAFE.bottom - blockH / 2);
}

interface Placed {
  w: CapWord;
  text: string;
  x: number;
  baseline: number;
  width: number;
  size: number;
}

/** Lay a group out in at most 2 centred lines inside the safe width, shrinking the size if needed. */
function layoutGroup(
  g: CapGroup,
  style: CaptionStyle,
  font: opentype.Font,
  region: CaptionStyle["position"],
  maxLines = 2,
) {
  let size = (style.sizePct / 100) * W;
  const maxW = SAFE.right - SAFE.left - 40;
  for (let attempt = 0; attempt < 8; attempt++) {
    // a little wider than the font's space: popping words must never touch ("Startevery")
    const space = font.getAdvanceWidth(" ", size) * 1.35;
    const items = g.words.map((w) => {
      const s = w.emph ? size * 1.12 : size;
      const text = applyCase(w.word, style.case);
      return { w, text, size: s, width: font.getAdvanceWidth(text, s) };
    });
    const lines: (typeof items)[] = [[]];
    let lw = 0;
    for (const it of items) {
      if (lines.at(-1)!.length && lw + space + it.width > maxW) {
        lines.push([]);
        lw = 0;
      }
      lw += (lines.at(-1)!.length ? space : 0) + it.width;
      lines.at(-1)!.push(it);
    }
    const tooWide = items.some((i) => i.width > maxW);
    if (lines.length <= maxLines && !tooWide) {
      const lh = size * 1.12;
      const blockH = lines.length * lh;
      const cy = centreY(region, blockH);
      const cx = (SAFE.left + SAFE.right) / 2;
      const placed: Placed[] = [];
      lines.forEach((ln, li) => {
        const total = ln.reduce((a, it, i) => a + it.width + (i ? space : 0), 0);
        let x = cx - total / 2;
        const baseline = cy - blockH / 2 + li * lh + size * 0.86;
        for (const it of ln) {
          placed.push({ w: it.w, text: it.text, x, baseline, width: it.width, size: it.size });
          x += it.width + space;
        }
      });
      return { placed, size, blockH, cy };
    }
    size *= 0.9;
  }
  return { placed: [] as Placed[], size, blockH: 0, cy: 0 };
}

/** Escapes text; an 8-digit hex colour (#RRGGBBAA) becomes rgba() so every SVG renderer reads the alpha. */
const esc = (s: string) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
  if (m)
    // boxes behind captions stay nearly opaque: a see-through box makes the words hard to read
    return `rgba(${Number.parseInt(m[1]!, 16)},${Number.parseInt(m[2]!, 16)},${Number.parseInt(m[3]!, 16)},${Math.max(0.9, Number.parseInt(m[4]!, 16) / 255).toFixed(3)})`;
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

/** SVG of the caption layer at time t (transparent background). Empty string when nothing is on screen. */
export function captionFrameSvg(tr: CaptionTrack, groups: CapGroup[], t: number): string {
  const style = tr.style;
  const font = fontFor(style.font, style.weight);
  const parts: string[] = [];
  // hook title: words pop in over the first ~0.6 s, then it breathes
  if (tr.title && t >= tr.title.t0 && t < tr.title.t1) parts.push(titleSvg(tr, t));
  const g = groups.find((x) => t >= x.t0 && t < x.t1);
  if (g) {
    const region = regionAt(tr, g.t0);
    // only the words already spoken are laid out (re-centred as each one pops in, like CapCut pop-up captions), so
    // a box behind the line grows with it
    const shown = { ...g, words: g.words.filter((w) => t >= w.start - 0.03) };
    const lay = layoutGroup(shown, style, font, region);
    // subtle continuous motion so no frame is frozen
    const breathe = 1 + 0.018 * Math.sin((2 * Math.PI * t) / 1.4);
    const bob = 5 * Math.sin((2 * Math.PI * t) / 2.1);
    // smooth in (120 ms) and a quick fade at the hand-over, never a hard cut
    const out = Math.min(t > g.t1 - 0.06 ? Math.max(0, (g.t1 - t) / 0.06) : 1, Math.min(1, (t - g.t0 + 0.03) / 0.12));
    const cx = W / 2;
    const active = [...g.words].reverse().find((w) => t >= w.start - 0.03);
    const strokeW = style.stroke ? (style.stroke.widthPct / 100) * lay.size : 0;
    const inner: string[] = [];
    if (style.background === "box" && lay.placed.length) {
      const x0 = Math.min(...lay.placed.map((p) => p.x)) - lay.size * 0.35;
      const x1 = Math.max(...lay.placed.map((p) => p.x + p.width)) + lay.size * 0.35;
      const y0 = lay.cy - lay.blockH / 2 - lay.size * 0.18;
      inner.push(
        `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(lay.blockH + lay.size * 0.3).toFixed(1)}" rx="${(lay.size * 0.22).toFixed(1)}" fill="${esc(style.backgroundColor ?? "#000000")}"/>`,
      );
    }
    for (const p of lay.placed) {
      const age = t - p.w.start;
      // typewriter/fade: words not yet spoken are hidden; pop/bounce/slide: they pop in when spoken
      if (age < -0.03) continue;
      const s = popScale(age + 0.03, style.animation, p.w.emph);
      const isActive = p.w === active;
      const wx = p.x + p.width / 2;
      const wy = p.baseline - p.size * 0.35;
      const slide =
        style.animation === "slide" && age < 0.15
          ? (1 - ease(age / 0.15)) * 30
          : style.animation === "spring" && !p.w.emph
            ? Math.max(0, (1 - spring(age + 0.03, 0.85)) / 0.15) * 14
            : 0;
      const shake = p.w.emph && age < 0.2 ? Math.sin(age * 90) * 4 * (1 - age / 0.2) : 0;
      // fade-in is quick and never starts see-through (a pale first word is hard to read)
      const op = style.animation === "fade" ? Math.min(1, 0.6 + (0.4 * (age + 0.03)) / 0.06) : 1;
      const d = font.getPath(p.text, p.x, p.baseline, p.size).toPathData(1);
      const fill = isActive || p.w.emph ? style.accent : style.fill;
      const box =
        style.background === "word_box" && isActive
          ? `<rect x="${(p.x - p.size * 0.18).toFixed(1)}" y="${(p.baseline - p.size * 0.9).toFixed(1)}" width="${(p.width + p.size * 0.36).toFixed(1)}" height="${(p.size * 1.12).toFixed(1)}" rx="${(p.size * 0.2).toFixed(1)}" fill="${esc(style.backgroundColor ?? style.accent)}"/>`
          : "";
      const textFill = style.background === "word_box" && isActive ? style.fill : fill;
      // a soft drop shadow: one offset copy, slightly spread, low opacity
      const shadow = style.shadow
        ? `<path d="${d}" transform="translate(${(p.size * 0.025).toFixed(1)} ${(p.size * 0.05).toFixed(1)})" fill="#000" stroke="#000" stroke-width="${(p.size * 0.06).toFixed(1)}" stroke-linejoin="round" opacity="0.32"/>`
        : "";
      const stroke = strokeW
        ? `<path d="${d}" fill="${esc(style.stroke!.color)}" stroke="${esc(style.stroke!.color)}" stroke-width="${strokeW.toFixed(1)}" stroke-linejoin="round"/>`
        : "";
      inner.push(
        `<g opacity="${op.toFixed(3)}" transform="translate(${(wx + shake).toFixed(2)} ${(wy + slide).toFixed(2)}) scale(${s.toFixed(4)}) translate(${(-wx).toFixed(2)} ${(-wy).toFixed(2)})">${box}${shadow}${stroke}<path d="${d}" fill="${esc(textFill)}"/></g>`,
      );
    }
    parts.push(
      `<g opacity="${out.toFixed(3)}" transform="translate(${cx} ${(lay.cy + bob).toFixed(2)}) scale(${breathe.toFixed(4)}) translate(${-cx} ${(-lay.cy).toFixed(2)})">${inner.join("")}</g>`,
    );
  }
  if (!parts.length) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
}

function titleSvg(tr: CaptionTrack, t: number): string {
  const ts = tr.style.hookTitle ?? {
    font: tr.style.font,
    case: tr.style.case,
    sizePct: Math.max(6, tr.style.sizePct * 0.95),
    fill: tr.style.fill,
    background: tr.style.background === "none" ? ("none" as const) : ("box" as const),
    backgroundColor: tr.style.backgroundColor,
    position: "upper" as const,
  };
  const font = fontFor(ts.font, "black");
  const words = applyCase(tr.title!.text, ts.case).split(/\s+/).filter(Boolean);
  const per = 0.45 / Math.max(1, words.length);
  const fake: CapGroup = {
    words: words.map((w, i) => ({ word: w, start: tr.title!.t0 + i * per, end: tr.title!.t0 + (i + 1) * per })),
    t0: tr.title!.t0,
    t1: tr.title!.t1,
  };
  // title sits in the top band unless the winner put it elsewhere; it may use up to 3 lines
  const style: CaptionStyle = { ...tr.style, ...ts, sizePct: ts.sizePct, case: "as_is", weight: "black" };
  let lay = layoutGroup(fake, style, font, ts.position, 3);
  if (!lay.placed.length) lay = layoutGroup(fake, { ...style, sizePct: ts.sizePct * 0.7 }, font, ts.position, 4);
  const shift = ts.position === "upper" ? SAFE.top + 40 + lay.blockH / 2 - lay.cy : 0;
  const breathe = 1 + 0.012 * Math.sin((2 * Math.PI * t) / 1.8);
  const inner: string[] = [];
  if (ts.background === "box" && lay.placed.length) {
    const x0 = Math.min(...lay.placed.map((p) => p.x)) - lay.size * 0.35;
    const x1 = Math.max(...lay.placed.map((p) => p.x + p.width)) + lay.size * 0.35;
    const y0 = lay.cy - lay.blockH / 2 - lay.size * 0.2;
    inner.push(
      `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(lay.blockH + lay.size * 0.35).toFixed(1)}" rx="${(lay.size * 0.2).toFixed(1)}" fill="${esc(ts.backgroundColor ?? "#FFFFFF")}"/>`,
    );
  }
  const strokeW = ts.background === "none" ? lay.size * 0.12 : 0;
  for (const p of lay.placed) {
    const age = t - p.w.start;
    if (age < 0) continue;
    const s = popScale(age, "pop");
    const wx = p.x + p.width / 2;
    const wy = p.baseline - p.size * 0.35;
    const d = font.getPath(p.text, p.x, p.baseline, p.size).toPathData(1);
    inner.push(
      `<g transform="translate(${wx.toFixed(2)} ${wy.toFixed(2)}) scale(${s.toFixed(4)}) translate(${(-wx).toFixed(2)} ${(-wy).toFixed(2)})">${strokeW ? `<path d="${d}" fill="#000" stroke="#000" stroke-width="${strokeW.toFixed(1)}" stroke-linejoin="round"/>` : ""}<path d="${d}" fill="${esc(ts.fill)}"/></g>`,
    );
  }
  const cx = W / 2;
  return `<g transform="translate(0 ${shift.toFixed(1)}) translate(${cx} ${lay.cy.toFixed(1)}) scale(${breathe.toFixed(4)}) translate(${-cx} ${(-lay.cy).toFixed(1)})">${inner.join("")}</g>`;
}

/**
 * Render the caption layer as a transparent PNG sequence (`dir/%05d.png`, 30 fps, `totalSec` long). Frames with
 * nothing on screen share one blank file (hard link) so the sequence stays cheap.
 */
export async function renderCaptionFrames(tr: CaptionTrack, totalSec: number, dir: string): Promise<string> {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const groups = groupWords(tr.words, tr.style.wordsPerCaption);
  const n = Math.ceil(totalSec * FPS);
  const blank = path.join(dir, "blank.png");
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png()
    .toFile(blank);
  const jobs = Array.from({ length: n }, (_, i) => i);
  const worker = async () => {
    for (let i = jobs.shift(); i !== undefined; i = jobs.shift()) {
      const f = path.join(dir, `${String(i).padStart(5, "0")}.png`);
      const svg = captionFrameSvg(tr, groups, i / FPS);
      if (!svg) fs.linkSync(blank, f);
      else await sharp(Buffer.from(svg)).png({ compressionLevel: 1 }).toFile(f);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return path.join(dir, "%05d.png");
}

/** Spoken-text-free shots (no voice) get evenly spaced words so their text still animates in. */
export function wordsForSilentText(text: string, t0: number, t1: number): CapWord[] {
  const ws = text.split(/\s+/).filter(Boolean);
  const span = Math.max(0.6, (t1 - t0) * 0.75);
  const per = span / Math.max(1, ws.length);
  return ws.map((w, i) => ({ word: w, start: t0 + 0.1 + i * per, end: t0 + 0.1 + (i + 1) * per }));
}

/** A brand colour bright enough to read as the active word on video (dark colours are mixed toward white). */
export function readableAccent(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return "#FFD60A";
  let [r, g, b] = [m[1], m[2], m[3]].map((x) => Number.parseInt(x!, 16)) as [number, number, number];
  const lum = () => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  for (let i = 0; i < 12 && lum() < 0.42; i++) {
    r = Math.round(r + (255 - r) * 0.18);
    g = Math.round(g + (255 - g) * 0.18);
    b = Math.round(b + (255 - b) * 0.18);
  }
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * The premium caption look (Mete, 12 Oct): bold geometric sans (Plus Jakarta Sans ExtraBold), large, 1 to 3 words,
 * white with a thin dark stroke and a soft shadow, the active word in the brand's accent, spring-in per word, key
 * words slam. No box, unless the winner itself uses a box (kept as a refined black box). Position follows the
 * winner; regions keep faces and the subject clear.
 */
export function premiumStyle(winner: CaptionStyle | undefined, brandAccent: string): CaptionStyle {
  const boxed = winner?.background === "box" || winner?.background === "word_box";
  return {
    font: "jakarta",
    weight: "black",
    case: "as_is",
    sizePct: boxed ? 10 : 13,
    fill: "#FFFFFF",
    accent: readableAccent(brandAccent),
    stroke: { color: "#111111", widthPct: boxed ? 0 : 7 },
    shadow: !boxed,
    background: boxed ? "box" : "none",
    backgroundColor: boxed ? "#000000E6" : undefined,
    position: winner?.position ?? "middle",
    animation: "spring",
    wordsPerCaption: Math.min(3, Math.max(1, winner?.wordsPerCaption ?? 3)),
    hookTitle: winner?.hookTitle ? { ...winner.hookTitle, font: "jakarta" } : undefined,
    notes: `premium spec over the winner's ${winner?.font ?? "default"} ${winner?.background ?? ""} style`,
  };
}
