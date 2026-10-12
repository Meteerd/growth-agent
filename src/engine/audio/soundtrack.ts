import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Blueprint, Brand, Concept } from "@/contracts";
import type { Db } from "../db/client";
import { probe } from "../media/ffmpeg";
import { composeMusic, soundEffect } from "../providers/elevenlabs";
import { isLive } from "../providers/env";
import { type CaptionTrack, type CapWord, HORMOZI, markEmphasis, wordsForSilentText } from "../video/captions";
import { buildVoiceTrack, globalWords, layoutVoice, speakShots, type VoiceLayout } from "./track";
import { brandVoice } from "./voices";

/**
 * The whole soundtrack of an ad (A18), ElevenLabs end to end: the brand's cast voice line by line with word
 * timestamps, laid out over the shots; a music bed composed to the winner's sound; subtle sound effects on the
 * hook and the cuts; and the live caption track built from the spoken words in the winner's text style.
 */
export interface Soundtrack {
  voiceFile: string;
  durations: number[];
  layout: VoiceLayout;
  musicFile?: string;
  musicPrompt?: string;
  sfx: { src: string; at: number; gainDb: number }[];
  captions: CaptionTrack;
  usd: number;
  voice: string;
}

export function soundtrackAvailable(slug: string, language: string): boolean {
  return isLive("elevenlabs") && !!brandVoice(slug, language);
}

/** The music prompt: the winner's sound (Gemini) adapted to an instrumental bed under a voiceover. */
export function musicPrompt(bp: Blueprint | null, brand: Brand, totalSec: number): string {
  // ElevenLabs refuses prompts naming songs or artists: drop quoted titles, parentheses and "X style" references
  const raw = (bp?.audio?.music ?? "")
    .replace(/\([^)]*\)/g, "")
    .replace(/["'‘’“”][^"'‘’“”]{2,60}["'‘’“”]/g, "")
    .replace(/\b[A-Z][\w'’]+(?: [A-Z][\w'’]+)* style\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // a winner without music still gets a bed (an ad without one reads as unfinished): very soft and minimal
  const winner = /\bno (background )?music\b/i.test(raw)
    ? "very soft, minimal ambient pad with a slow gentle pulse, almost unnoticeable, calm and trustworthy"
    : raw;
  const mood = brand.dossier.visual.styleNotes ?? "";
  return [
    `Instrumental background music bed for a ${Math.round(totalSec)} second vertical social ad, sits under a spoken voiceover (leave room for the voice, no lead melody fighting it, no vocals).`,
    winner ? `Match this reference sound: ${winner}` : "Warm, modern, light percussion, gentle build.",
    mood ? `Brand mood: ${mood.slice(0, 200)}` : "",
    "Clean start, a light lift at the hook, steady through the middle, resolves at the end.",
  ]
    .filter(Boolean)
    .join(" ");
}

const SFX_SET = {
  whoosh: { text: "very soft short airy swoosh transition, subtle, clean, no reverb tail", sec: 0.7 },
  hit: { text: "soft deep cinematic low thump for a title reveal, subtle, short", sec: 0.9 },
  pop: { text: "tiny soft UI pop click, gentle, short", sec: 0.3 },
} as const;

/** The brand's small sound-effect kit, generated once and kept (data/assets/sfx/<slug>/). */
async function sfxKit(db: Db, slug: string, runId?: string): Promise<Partial<Record<keyof typeof SFX_SET, string>>> {
  const dir = path.resolve(process.env.ASSETS_DIR || "data/assets", "sfx", slug);
  const out: Partial<Record<keyof typeof SFX_SET, string>> = {};
  for (const [k, v] of Object.entries(SFX_SET) as [keyof typeof SFX_SET, (typeof SFX_SET)[keyof typeof SFX_SET]][]) {
    const f = path.join(dir, `${k}.mp3`);
    if (!fs.existsSync(f)) await soundEffect(db, { text: v.text, durationSec: v.sec, out: f, runId }).catch(() => null);
    if (fs.existsSync(f)) out[k] = f;
  }
  return out;
}

export async function buildSoundtrack(
  db: Db,
  o: {
    concept: Concept;
    brand: Brand;
    bp: Blueprint | null;
    mode: "voice_led" | "picture_locked";
    endCardSec: number;
    dir: string;
    music?: boolean;
  },
): Promise<Soundtrack | null> {
  const c = o.concept;
  const voice = brandVoice(o.brand.slug, c.language);
  if (!voice || !isLive("elevenlabs")) return null;
  fs.mkdirSync(o.dir, { recursive: true });
  const lines = c.shots.map((s) => ({ idx: s.idx, text: s.voiceover ?? "" }));
  const spoken = await speakShots(db, { voice, lines, dir: path.join(o.dir, "voice"), runId: c.runId });
  if (spoken.mode === "demo" || !spoken.segs.length) return null;
  const lay = layoutVoice(c.shots, spoken.segs, o.mode);
  const shotsTotal = lay.durations.reduce((a, b) => a + b, 0);
  const total = Math.max(shotsTotal, lay.voiceEnd + 0.3) + o.endCardSec;
  const voiceFile = await buildVoiceTrack(spoken.segs, lay, total, path.join(o.dir, "voice.wav"));
  let usd = spoken.usd;

  // captions: the spoken words; a shot without a line shows its on-screen text, revealed word by word
  const words: CapWord[] = globalWords(spoken.segs, lay).map(({ word, start, end }) => ({ word, start, end }));
  let t = 0;
  const starts = lay.durations.map((d) => {
    const s = t;
    t += d;
    return s;
  });
  for (const s of c.shots)
    if (lay.starts[s.idx] === undefined && s.onScreenText && s.idx !== 0)
      words.push(...wordsForSilentText(s.onScreenText, starts[s.idx]!, starts[s.idx]! + lay.durations[s.idx]!));
  words.sort((a, b) => a.start - b.start);
  const keys = [o.brand.name, ...(c.cta.match(/\b[\p{L}.]{3,}\.(com|xyz|health|sk|cz|ai)\b/giu) ?? [])];
  const base = o.bp?.captionStyle ?? HORMOZI;
  // readable on a phone and lively (Mete, 12 Oct): at least 7% of the width, 1 to 3 words at a time
  const style = { ...base, sizePct: Math.max(7, base.sizePct), wordsPerCaption: Math.min(3, base.wordsPerCaption) };
  const first = c.shots[0];
  // the hook title only when it adds something: a title that repeats the spoken hook reads as doubled text
  const norm = (x: string) =>
    x
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const tw = norm(first?.onScreenText ?? "");
  const vw = new Set(norm(first?.voiceover ?? ""));
  const repeats = tw.length > 0 && tw.filter((w) => vw.has(w)).length / tw.length > 0.4;
  const title =
    first?.onScreenText && !repeats && (style.hookTitle || lay.starts[0] === undefined)
      ? { text: first.onScreenText, t0: 0, t1: lay.durations[0] ?? 2 }
      : undefined;
  if (lay.starts[0] === undefined && first?.onScreenText && !title)
    words.unshift(...wordsForSilentText(first.onScreenText, 0, lay.durations[0] ?? 2));
  const captions: CaptionTrack = {
    style,
    words: markEmphasis(words, keys),
    regions: c.shots.map((s, i) => ({
      t0: starts[i]!,
      t1: starts[i]! + lay.durations[i]!,
      region: s.captionRegion ?? style.position,
    })),
    title,
  };

  // music bed composed to the winner's sound
  let musicFile: string | undefined;
  let prompt: string | undefined;
  if (o.music !== false) {
    prompt = musicPrompt(o.bp, o.brand, total);
    // one bed per concept and prompt, reused while it is long enough (the ad keeps its music across re-renders)
    const h = crypto
      .createHash("sha1")
      .update(prompt.replace(/\d+ second/, ""))
      .digest("hex")
      .slice(0, 12);
    const cached = path.resolve(process.env.ASSETS_DIR || "data/assets", "music-cache", `${c.id}_${h}.mp3`);
    const len = fs.existsSync(cached) ? (await probe(cached)).durationSec : 0;
    const m =
      len >= total
        ? { file: cached, usd: 0, mode: "live" as const }
        : await composeMusic(db, { prompt, lengthSec: total + 2, out: cached, runId: c.runId }).catch(() =>
            composeMusic(db, {
              prompt: `Instrumental background music bed for a short vertical social ad under a voiceover, no vocals. ${o.bp?.audio?.music && /upbeat|energetic|driving/i.test(o.bp.audio.music) ? "Upbeat, warm, light groove" : "Warm, calm, modern, light"}, gentle build, resolves at the end.`,
              lengthSec: total + 2,
              out: cached,
              runId: c.runId,
            }).catch(() => null),
          );
    if (m?.file) {
      musicFile = m.file;
      usd += m.usd;
    }
  }

  // subtle sound effects: a low hit under the hook, a soft swoosh into every cut
  const kit = await sfxKit(db, o.brand.slug, c.runId);
  const sfx: Soundtrack["sfx"] = [];
  if (kit.hit) sfx.push({ src: kit.hit, at: 0, gainDb: -15 });
  for (let i = 1; i < starts.length; i++)
    if (kit.whoosh) sfx.push({ src: kit.whoosh, at: Math.max(0, starts[i]! - 0.25), gainDb: -19 });
  if (kit.pop) sfx.push({ src: kit.pop, at: shotsTotal + 0.05, gainDb: -16 });
  return {
    voiceFile,
    durations: lay.durations,
    layout: lay,
    musicFile,
    musicPrompt: prompt,
    sfx,
    captions,
    usd,
    voice: `${voice.name} (${voice.voiceId}, ${voice.modelId})`,
  };
}
