import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { type Blueprint, CAPTION_FONTS, type CaptionStyle, type Concept, type Review } from "@/contracts";
import type { Db } from "../db/client";
import { watch } from "../providers/gemini";

/**
 * The video watcher (A18): Gemini watches whole videos with sound. Winners -> how they look, move and sound
 * (caption style, music, sound effects, voice, pacing), merged into the blueprint. Our renders -> a plain-language
 * critique with timestamps and per-shot scores, merged into the review (the stricter of Claude and Gemini wins).
 */

const Style = z.object({
  font: z.enum(CAPTION_FONTS),
  weight: z.enum(["bold", "black"]),
  case: z.enum(["as_is", "upper", "lower"]),
  sizePct: z.number(),
  fill: z.string(),
  accent: z.string(),
  strokeColor: z.string(),
  strokeWidthPct: z.number(),
  shadow: z.boolean(),
  background: z.enum(["none", "box", "word_box"]),
  backgroundColor: z.string(),
  position: z.enum(["upper", "middle", "lower"]),
  animation: z.enum(["pop", "bounce", "slide", "typewriter", "fade"]),
  wordsPerCaption: z.number(),
});

export const WinnerWatch = z.object({
  hasCaptions: z.boolean(),
  captions: Style,
  hasHookTitle: z.boolean(),
  hookTitle: z.object({
    text: z.string(),
    font: z.enum(CAPTION_FONTS),
    case: z.enum(["as_is", "upper", "lower"]),
    sizePct: z.number(),
    fill: z.string(),
    background: z.enum(["none", "box", "word_box"]),
    backgroundColor: z.string(),
    position: z.enum(["upper", "middle", "lower"]),
  }),
  captionNotes: z.string(),
  music: z.string(),
  sfx: z.array(z.string()),
  voice: z.string(),
  pacing: z.string(),
  motion: z.string(),
  notes: z.string(),
});
export type WinnerWatch = z.infer<typeof WinnerWatch>;

const WINNER_PROMPT = `Watch this whole short-form ad WITH its sound. It is a winning ad we will remake shot for shot for another brand (same structure and style, our own words and footage).
Describe precisely, as a video editor would:
1. On-screen text. The spoken-word captions (if any) and, separately, the hook title (big text over the first seconds, if any). For each: closest font look from this list: tiktok_sans (TikTok's own caption font / Proxima-like), montserrat (CapCut bold geometric), poppins (rounded geometric), inter (neutral UI), anton (condensed heavy caps), bebas (condensed caps), serif_dm (high-contrast display serif), serif_playfair (editorial serif), handwritten. Weight, letter case, size as % of frame WIDTH (font size; TikTok auto-captions ~5, big Hormozi captions ~9), text colour, highlight colour of the spoken word (or the same colour if none), outline colour and width as % of font size (0 if none), drop shadow, background (none / box behind the line / word_box behind the spoken word) and its colour, vertical position (upper/middle/lower third), animation (pop = words pop in as spoken, bounce, slide, typewriter, fade; use fade for a calm static-looking reveal), words on screen at once. Use hex colours.
2. Sound: music (genre, tempo/BPM estimate, mood, instruments, energy curve, when it starts and drops), sound effects (each: what and when, e.g. "whoosh on every cut", "pop when text appears"), voice delivery (gender, age, accent, pace, tone).
3. Pacing (cuts, rhythm) and motion (camera moves, handheld, zooms, transitions).
Be concrete, no filler. If there are no spoken captions set hasCaptions false and still fill captions with the closest style for captions that would fit this ad.`;

export async function watchWinner(db: Db, file: string, runId?: string): Promise<WinnerWatch | null> {
  const r = await watch(db, {
    file,
    prompt: WINNER_PROMPT,
    schema: WinnerWatch,
    fps: 2,
    runId,
    note: `watch winner ${path.basename(file)}`,
    demo: () => null as unknown as WinnerWatch,
  });
  return r.mode === "live" ? r.value : null;
}

const clampN = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** WinnerWatch -> the blueprint's captionStyle + audio (additive fields). */
export function styleFromWatch(w: WinnerWatch): CaptionStyle {
  const c = w.captions;
  return {
    font: c.font,
    weight: c.weight,
    case: c.case,
    // live captions stay readable on a phone: never smaller than ~5.5% of the width
    sizePct: clampN(c.sizePct, 5.5, 11),
    fill: c.fill,
    accent: c.accent && c.accent.toLowerCase() !== c.fill.toLowerCase() ? c.accent : "#FFE14D",
    stroke: c.strokeWidthPct > 0 ? { color: c.strokeColor, widthPct: clampN(c.strokeWidthPct, 4, 22) } : undefined,
    shadow: c.shadow,
    background: c.background,
    backgroundColor: c.backgroundColor,
    position: c.position,
    animation: c.animation,
    wordsPerCaption: clampN(Math.round(c.wordsPerCaption), 1, 3),
    hookTitle: w.hasHookTitle
      ? {
          font: w.hookTitle.font,
          case: w.hookTitle.case,
          sizePct: clampN(w.hookTitle.sizePct, 5, 12),
          fill: w.hookTitle.fill,
          background: w.hookTitle.background,
          backgroundColor: w.hookTitle.backgroundColor,
          position: w.hookTitle.position,
        }
      : undefined,
    notes: w.captionNotes,
  };
}

export function mergeWinnerWatch(bp: Blueprint, w: WinnerWatch): Blueprint {
  return {
    ...bp,
    captionStyle: styleFromWatch(w),
    audio: { music: w.music, sfx: w.sfx, voice: w.voice },
    watchNotes: [w.notes, `Pacing: ${w.pacing}`, `Motion: ${w.motion}`, `Text: ${w.captionNotes}`].join("\n"),
  };
}

export const RenderWatch = z.object({
  overall: z.number(),
  perShot: z.array(z.object({ idx: z.number(), score: z.number(), issues: z.array(z.string()) })),
  critique: z.array(z.string()),
  captionsAlive: z.boolean(),
  captionsSynced: z.boolean(),
  captionStyleMatch: z.boolean(),
  captionsCoverFace: z.boolean(),
  musicPresent: z.boolean(),
  voiceNatural: z.boolean(),
  shake: z.array(z.string()),
  wouldScroll: z.boolean(),
});
export type RenderWatch = z.infer<typeof RenderWatch>;

/** Our own render, watched with sound against the winner's blueprint. */
export async function watchRender(
  db: Db,
  o: { file: string; concept: Concept; bp: Blueprint | null; runId?: string },
): Promise<RenderWatch | null> {
  let t = 0;
  const shots = o.concept.shots.map((s) => {
    const x = {
      idx: s.idx,
      from: Math.round(t * 10) / 10,
      to: Math.round((t + s.durationSec) * 10) / 10,
      voiceover: s.voiceover,
    };
    t += s.durationSec;
    return x;
  });
  const prompt = `You are the strictest short-form ad reviewer at a performance agency. Watch this ad WITH its sound, as a viewer scrolling TikTok/Reels would.
It remakes a winning ad (blueprint below) for our brand. Language: ${o.concept.language}.
Shots (seconds): ${JSON.stringify(shots)}
Winner blueprint: ${JSON.stringify(o.bp ? { structure: o.bp.structure, hook: o.bp.hook, captionStyle: o.bp.captionStyle, audio: o.bp.audio, watchNotes: o.bp.watchNotes } : null)}

Score each shot 0-100 (80 = good enough to run as a paid ad; anything a viewer would scroll past as fake, cheap or broken is under 70) and the whole ad. Check, with timestamps ("0:04-0:07 the camera shakes"):
- motion: real-looking footage, smooth camera, no shaking/jitter, no frozen stills pretending to be video, no AI tells (warped hands/paws, morphing faces or objects, garbled text, plastic skin);
- captions: alive (words pop in as spoken, change every ~0.3-0.8 s; a sentence sitting still on screen fails), synced to the voice, readable, never covering faces/the dog/the product, outside the TikTok UI zones, and in the WINNER's text style (font look, colour, outline/box, position) - a style mismatch is a failing issue;
- sound: music bed present and fitting the winner's sound, voice natural and native for the language (no robotic or foreign accent), mix balanced, sound effects subtle;
- the hook in the first 2 s, pacing versus the winner, the CTA.
critique: the plain-language list of everything to fix, worst first.`;
  const r = await watch(db, {
    file: o.file,
    prompt,
    schema: RenderWatch,
    fps: 3,
    runId: o.runId,
    note: `watch render ${o.concept.id}`,
    demo: () => null as unknown as RenderWatch,
  });
  if (r.mode !== "live") return null;
  saveCritique(o.concept.id, o.file, r.value);
  return r.value;
}

/** Every critique is kept (data/critiques/<concept>.jsonl) so quality can be tracked render over render. */
export function saveCritique(conceptId: string, file: string, w: RenderWatch) {
  const dir = path.resolve("data/critiques");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(
    path.join(dir, `${conceptId}.jsonl`),
    `${JSON.stringify({ at: new Date().toISOString(), file: path.basename(file), ...w })}\n`,
  );
}

/** Merge Gemini's watch into a review: per shot and overall the stricter score wins; hard failures cap the score. */
export function mergeRenderWatch(r: Review, w: RenderWatch): Review {
  const perShot = r.perShot.map((p) => {
    const g = w.perShot.find((x) => x.idx === p.idx);
    if (!g) return p;
    const score = Math.min(p.score, Math.round(g.score));
    return { ...p, score, issues: [...g.issues.map((i) => `Gemini: ${i}`), ...p.issues] };
  });
  let overall = Math.min(r.overall, Math.round(w.overall));
  const caps: string[] = [];
  const cap = (n: number, why: string) => {
    if (overall > n) overall = n;
    caps.push(why);
  };
  if (!w.captionsAlive) cap(70, "captions read as static text");
  if (!w.captionsSynced) cap(72, "captions are out of sync with the voice");
  if (!w.captionStyleMatch) cap(76, "caption style does not match the winner");
  if (w.captionsCoverFace) cap(74, "captions cover a face or the subject");
  if (!w.musicPresent) cap(75, "no music bed");
  if (!w.voiceNatural) cap(74, "voice does not sound natural/native");
  if (w.shake.length) cap(70, `shake: ${w.shake.join("; ")}`);
  if (w.wouldScroll) cap(70, "a viewer would scroll past");
  const low = perShot.some((p) => p.score < 80);
  return {
    ...r,
    perShot,
    overall,
    decision: low || overall < 80 ? "regenerate" : r.decision,
    notes: `Gemini watched it with sound: ${w.critique.slice(0, 6).join(" | ")}${caps.length ? ` [caps: ${caps.join(", ")}]` : ""}. Claude: ${r.notes}`,
  };
}
