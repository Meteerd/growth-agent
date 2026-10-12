import fs from "node:fs";
import path from "node:path";
import type { VoiceSettings } from "../providers/elevenlabs";

/**
 * The chosen ElevenLabs voice per brand and language (A18). Checked in (`assets/voices.json`) so every render of a
 * brand speaks with the same voice on any machine. Written by `pnpm voices` after the candidate takes were heard.
 */
export interface BrandVoice {
  voiceId: string;
  name: string;
  publicOwnerId?: string;
  modelId: string;
  /** ISO 639-1 */
  language: string;
  settings: VoiceSettings;
  persona: string;
  why: string;
  candidates?: { voiceId: string; name: string; score?: number; note?: string }[];
  chosenAt: string;
}

export type VoiceBook = Record<string, Record<string, BrandVoice>>;

export const voicesFile = () => path.resolve(process.env.VOICES_FILE || "assets/voices.json");

export function readVoices(): VoiceBook {
  try {
    return JSON.parse(fs.readFileSync(voicesFile(), "utf8")) as VoiceBook;
  } catch {
    return {};
  }
}

export function brandVoice(slug: string, language: string): BrandVoice | undefined {
  return readVoices()[slug]?.[language.toLowerCase().slice(0, 2)];
}

export function saveBrandVoice(slug: string, v: BrandVoice) {
  const book = readVoices();
  book[slug] = { ...(book[slug] ?? {}), [v.language]: v };
  fs.mkdirSync(path.dirname(voicesFile()), { recursive: true });
  fs.writeFileSync(voicesFile(), `${JSON.stringify(book, null, 2)}\n`);
}

/** Persona per brand (who speaks), used when searching the library and when no voice was chosen yet. */
export const PERSONAS: Record<string, { persona: string; gender?: string; search: string[] }> = {
  aclinic: {
    persona: "calm, warm, doctor-led; a trusted physician explaining simply, never salesy",
    gender: "female",
    search: ["calm", "narration", "warm", "doctor"],
  },
  hound: {
    persona: "warm, conversational dog owner talking to a friend on TikTok; gentle, a little playful",
    gender: "female",
    search: ["conversational", "warm", "friendly", "social media"],
  },
  dynova: {
    persona: "clear, friendly Turkish science explainer; credible and calm, like a health educator",
    search: ["calm", "narration", "friendly", "educational"],
  },
  evreon: {
    persona: "credible UK English professional; measured, confident, clinical-software narrator",
    search: ["british", "professional", "narration", "calm"],
  },
};

/** Defaults that read as natural speech for short ads (lower stability = more expressive). */
export const DEFAULT_SETTINGS: VoiceSettings = {
  stability: 0.45,
  similarity_boost: 0.8,
  style: 0.15,
  use_speaker_boost: true,
  speed: 1.0,
};
