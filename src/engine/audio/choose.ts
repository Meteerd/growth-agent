import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Db } from "../db/client";
import { ffmpeg, probe } from "../media/ffmpeg";
import {
  addSharedVoice,
  type SharedVoice,
  searchSharedVoices,
  TTS_MODEL_11,
  ttsWithTimestamps,
} from "../providers/elevenlabs";
import { watch } from "../providers/gemini";
import { type BrandVoice, DEFAULT_SETTINGS, PERSONAS, saveBrandVoice } from "./voices";

/**
 * Voice casting (A18): search the ElevenLabs library for native voices that fit the brand's persona and language,
 * render the same two lines with each candidate, let Gemini listen to all takes, keep the best and store it.
 */
export interface CastingBrief {
  slug: string;
  language: string;
  /** e.g. "british" for UK English */
  accent?: string;
  gender?: string;
  lines: string[];
  runId?: string;
}

const USE_CASE_RANK = ["conversational", "informative_educational", "narrative_story", "social_media", "advertisement"];

export function rankCandidates(voices: SharedVoice[], b: Pick<CastingBrief, "language" | "accent" | "gender">, n = 3) {
  const lang = b.language.toLowerCase();
  const ok = voices.filter((v) => {
    const verified = (v.verified_languages ?? []).some((x) => x.language === lang);
    if (!verified && v.language !== lang) return false;
    if ((v as { rate?: number }).rate && (v as { rate?: number }).rate! > 1) return false;
    if ((v as { free_users_allowed?: boolean }).free_users_allowed === false) return false;
    if (
      b.accent &&
      !`${v.accent ?? ""} ${(v.verified_languages ?? []).map((x) => x.accent).join(" ")}`
        .toLowerCase()
        .includes(b.accent)
    )
      return false;
    return true;
  });
  const score = (v: SharedVoice) => {
    const uc = USE_CASE_RANK.indexOf(v.use_case ?? "");
    return (
      (uc >= 0 ? 10 - uc : 0) +
      Math.log10(1 + (v.usage_character_count_1y ?? 0)) +
      (b.gender && v.gender === b.gender ? 3 : 0)
    );
  };
  const seen = new Set<string>();
  return ok
    .sort((a, c) => score(c) - score(a))
    .filter((v) => (seen.has(v.voice_id) ? false : (seen.add(v.voice_id), true)))
    .slice(0, n);
}

const Pick = z.object({
  ranking: z.array(z.object({ take: z.number(), score: z.number(), note: z.string() })),
  best: z.number(),
  settingsAdvice: z.string(),
});

export async function castVoice(db: Db, b: CastingBrief, dir: string): Promise<BrandVoice | null> {
  const persona = PERSONAS[b.slug];
  const gender = b.gender ?? persona?.gender;
  const pool: SharedVoice[] = [];
  for (const q of [
    { language: b.language, gender, pageSize: 60 },
    { language: b.language, pageSize: 60 },
    ...(persona?.search ?? []).slice(0, 2).map((s) => ({ language: b.language, search: s, pageSize: 30 })),
  ])
    pool.push(...(await searchSharedVoices(db, { ...q, accent: undefined })));
  const cands = rankCandidates(pool, { language: b.language, accent: b.accent, gender }, 3);
  if (!cands.length) return null;
  fs.mkdirSync(dir, { recursive: true });
  const text = b.lines.filter(Boolean).join(" ");
  const takes: { v: SharedVoice; file: string; dur: number }[] = [];
  for (const v of cands) {
    const id = await addSharedVoice(db, {
      publicOwnerId: v.public_owner_id,
      voiceId: v.voice_id,
      name: `${b.slug} ${v.name}`.slice(0, 60),
    });
    const r = await ttsWithTimestamps(db, {
      voiceId: id,
      text,
      languageCode: b.language,
      settings: DEFAULT_SETTINGS,
      runId: b.runId,
      note: `casting ${b.slug}/${b.language}: ${v.name}`,
    });
    if (!r.mp3) continue;
    const file = path.join(dir, `take_${takes.length + 1}.mp3`);
    fs.writeFileSync(file, r.mp3);
    takes.push({ v: { ...v, voice_id: id }, file, dur: (await probe(file)).durationSec });
  }
  if (!takes.length) return null;
  // one file: take 1, 1 s silence, take 2, ... so Gemini compares them side by side
  const all = path.join(dir, "takes.mp3");
  const inputs = takes.flatMap((t) => ["-i", t.file]);
  const chain = takes
    .map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono,apad=pad_dur=1[t${i}]`)
    .join(";");
  await ffmpeg([
    "-y",
    ...inputs,
    "-filter_complex",
    `${chain};${takes.map((_, i) => `[t${i}]`).join("")}concat=n=${takes.length}:v=0:a=1[a]`,
    "-map",
    "[a]",
    all,
  ]);
  let at = 0;
  const marks = takes.map((t, i) => {
    const m = `take ${i + 1} starts at ${at.toFixed(1)} s`;
    at += t.dur + 1;
    return m;
  });
  const w = await watch(db, {
    file: all,
    schema: Pick,
    runId: b.runId,
    note: `listen to ${takes.length} voice takes ${b.slug}/${b.language}`,
    prompt: `These are ${takes.length} voice takes of the same ad lines in ${b.language} (${marks.join("; ")}). Persona wanted: ${persona?.persona ?? "natural, trustworthy"}${b.accent ? `, ${b.accent} accent` : ""}. Score each take 0-100 for: sounds like a real native speaker of this language (no foreign accent, correct stress), natural and warm, fits the persona and a TikTok/Reels ad, clear. best = the take number to keep. settingsAdvice: one line on stability/style/speed for this voice.`,
    demo: () => ({
      ranking: takes.map((_, i) => ({ take: i + 1, score: 0, note: "demo" })),
      best: 1,
      settingsAdvice: "",
    }),
  });
  const best = takes[Math.max(0, Math.min(takes.length - 1, w.value.best - 1))]!;
  const chosen: BrandVoice = {
    voiceId: best.v.voice_id,
    name: best.v.name,
    publicOwnerId: best.v.public_owner_id,
    modelId: TTS_MODEL_11(),
    language: b.language,
    settings: DEFAULT_SETTINGS,
    persona: persona?.persona ?? "",
    why: `${w.value.ranking.find((r) => r.take === w.value.best)?.note ?? ""} ${w.value.settingsAdvice}`.trim(),
    candidates: takes.map((t, i) => ({
      voiceId: t.v.voice_id,
      name: t.v.name,
      score: w.value.ranking.find((r) => r.take === i + 1)?.score,
      note: w.value.ranking.find((r) => r.take === i + 1)?.note,
    })),
    chosenAt: new Date().toISOString(),
  };
  saveBrandVoice(b.slug, chosen);
  return chosen;
}
