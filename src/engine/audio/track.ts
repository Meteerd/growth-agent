import fs from "node:fs";
import path from "node:path";
import type { Db } from "../db/client";
import { ffmpeg, probe } from "../media/ffmpeg";
import { type SpokenWord, ttsWithTimestamps } from "../providers/elevenlabs";
import { stripEmoji } from "../video/compose";
import type { BrandVoice } from "./voices";

/**
 * The voice track of an ad (A18): one ElevenLabs take per shot (with the neighbouring lines as context, so the
 * read flows like one take), each with word timestamps; then a layout that places every line in its shot, and the
 * spoken words become the captions.
 */
export interface VoiceSegment {
  idx: number;
  file: string;
  /** shot-local word times of the raw take (seconds) */
  words: SpokenWord[];
  durationSec: number;
}

export const LEAD = 0.15;
export const TAIL = 0.3;

export interface VoiceLayout {
  /** shot durations after the layout */
  durations: number[];
  /** global start (s) of each shot's line, by shot idx */
  starts: Record<number, number>;
  /** playback speed per line (1 = as spoken; >1 only when a picture-locked shot is too short) */
  tempo: Record<number, number>;
  /** end of the last spoken word (s) */
  voiceEnd: number;
}

/**
 * voice_led: shot length follows its line (lead + line + tail, at least 1.2 s, at most 10 s: a clip's length);
 * shots without a line keep their planned length. picture_locked: shot lengths stay; a line that does not fit is
 * sped up (max 1.2x) and then may run into the next shot, never over another line.
 */
export function layoutVoice(
  shots: { idx: number; durationSec: number }[],
  segs: VoiceSegment[],
  mode: "voice_led" | "picture_locked",
): VoiceLayout {
  const byIdx = new Map(segs.map((s) => [s.idx, s]));
  const durations = shots.map((s) => {
    const seg = byIdx.get(s.idx);
    if (mode === "picture_locked" || !seg) return s.durationSec;
    return Math.round(Math.min(10, Math.max(1.2, LEAD + seg.durationSec + TAIL)) * 100) / 100;
  });
  const starts: Record<number, number> = {};
  const tempo: Record<number, number> = {};
  let t = 0;
  let prevEnd = 0;
  shots.forEach((s, i) => {
    const seg = byIdx.get(s.idx);
    if (seg) {
      const room = durations[i]! - LEAD - TAIL;
      const k = mode === "picture_locked" && seg.durationSec > room ? Math.min(1.2, seg.durationSec / room) : 1;
      tempo[s.idx] = Math.round(k * 1000) / 1000;
      const start = Math.max(t + (i === 0 ? 0.1 : LEAD), prevEnd + 0.08);
      starts[s.idx] = Math.round(start * 1000) / 1000;
      prevEnd = start + seg.durationSec / k;
    }
    t += durations[i]!;
  });
  return { durations, starts, tempo, voiceEnd: Math.round(prevEnd * 1000) / 1000 };
}

/** Spoken words in global time after the layout. */
export function globalWords(segs: VoiceSegment[], lay: VoiceLayout): (SpokenWord & { idx: number })[] {
  return segs.flatMap((s) => {
    const st = lay.starts[s.idx];
    if (st === undefined) return [];
    const k = lay.tempo[s.idx] ?? 1;
    return s.words.map((w) => ({ idx: s.idx, word: w.word, start: st + w.start / k, end: st + w.end / k }));
  });
}

export interface Phrase {
  text: string;
  /** global seconds */
  t0: number;
  t1: number;
}

/**
 * Words -> caption phrases the way native captions read: 2 to 4 words, a break after punctuation, at most
 * `maxChars` characters, each shown from its first word until the next phrase starts (or a short hold at a pause).
 */
export function phrasesFromWords(words: SpokenWord[], maxChars = 22, maxWords = 4): Phrase[] {
  const out: { words: SpokenWord[] }[] = [];
  let cur: SpokenWord[] = [];
  const len = (ws: SpokenWord[]) => ws.map((w) => w.word).join(" ").length;
  for (const w of words) {
    const clean = stripEmoji(w.word);
    if (!clean) continue;
    const ww = { ...w, word: clean };
    if (cur.length && (cur.length >= maxWords || len([...cur, ww]) > maxChars)) {
      out.push({ words: cur });
      cur = [];
    }
    cur.push(ww);
    if (/[.!?,;:…]$/.test(clean) && cur.length >= 2) {
      out.push({ words: cur });
      cur = [];
    }
  }
  if (cur.length) out.push({ words: cur });
  // a lone short word joins the phrase before it when that still fits
  const merged: { words: SpokenWord[] }[] = [];
  for (const p of out) {
    const prev = merged.at(-1);
    if (prev && p.words.length === 1 && len([...prev.words, ...p.words]) <= maxChars + 6) prev.words.push(...p.words);
    else merged.push(p);
  }
  return merged.map((p, i) => {
    const t0 = p.words[0]!.start;
    const lastEnd = p.words.at(-1)!.end;
    const next = merged[i + 1]?.words[0]?.start;
    const t1 = next !== undefined && next - lastEnd < 0.6 ? next : lastEnd + 0.35;
    return {
      text: p.words.map((w) => w.word).join(" "),
      t0: Math.round(t0 * 1000) / 1000,
      t1: Math.round(t1 * 1000) / 1000,
    };
  });
}

/** One take per shot line, in order, with the previous/next lines as context. */
export async function speakShots(
  db: Db,
  o: {
    voice: BrandVoice;
    lines: { idx: number; text: string }[];
    dir: string;
    runId?: string;
    speed?: number;
    seed?: number;
  },
): Promise<{ segs: VoiceSegment[]; usd: number; mode: "live" | "demo" }> {
  fs.mkdirSync(o.dir, { recursive: true });
  const lines = o.lines.filter((l) => stripEmoji(l.text).trim());
  const segs: VoiceSegment[] = [];
  let usd = 0;
  let mode: "live" | "demo" = "live";
  for (const [i, l] of lines.entries()) {
    const r = await ttsWithTimestamps(db, {
      voiceId: o.voice.voiceId,
      text: stripEmoji(l.text),
      languageCode: o.voice.language,
      modelId: o.voice.modelId,
      settings: { ...o.voice.settings, ...(o.speed ? { speed: o.speed } : {}) },
      previousText: lines[i - 1]?.text,
      nextText: lines[i + 1]?.text,
      seed: o.seed,
      runId: o.runId,
      note: `voice shot ${l.idx + 1} (${o.voice.name})`,
    });
    usd += r.usd;
    if (r.mode === "demo" || !r.mp3) {
      mode = "demo";
      continue;
    }
    const file = path.join(o.dir, `line_${l.idx}.mp3`);
    fs.writeFileSync(file, r.mp3);
    // the take may carry a little silence after the last word: trust the timestamps, fall back to the file length
    const dur = r.words.at(-1)?.end ?? (await probe(file)).durationSec;
    segs.push({ idx: l.idx, file, words: r.words, durationSec: Math.round(dur * 1000) / 1000 });
  }
  return { segs, usd, mode };
}

/** Mix the laid-out lines into one 48 kHz stereo WAV of `totalSec`. */
export async function buildVoiceTrack(
  segs: VoiceSegment[],
  lay: VoiceLayout,
  totalSec: number,
  out: string,
): Promise<string> {
  const placed = segs.filter((s) => lay.starts[s.idx] !== undefined);
  if (!placed.length) throw new Error("no voice lines to place");
  const inputs = placed.flatMap((s) => ["-i", s.file]);
  const parts = placed.map((s, i) => {
    const ms = Math.round(lay.starts[s.idx]! * 1000);
    const k = lay.tempo[s.idx] ?? 1;
    const trim = `atrim=0:${(s.durationSec + 0.12).toFixed(3)},afade=t=out:st=${Math.max(0, s.durationSec + 0.02).toFixed(3)}:d=0.1`;
    return `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,${trim}${k !== 1 ? `,atempo=${k}` : ""},adelay=${ms}|${ms}[l${i}]`;
  });
  const mix = `${placed.map((_, i) => `[l${i}]`).join("")}amix=inputs=${placed.length}:normalize=0:duration=longest,apad,atrim=0:${totalSec.toFixed(3)}[a]`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await ffmpeg([
    "-y",
    ...inputs,
    "-filter_complex",
    `${parts.join(";")};${mix}`,
    "-map",
    "[a]",
    "-ar",
    "48000",
    "-ac",
    "2",
    out,
  ]);
  return out;
}
