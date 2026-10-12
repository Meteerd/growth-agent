import fs from "node:fs";
import path from "node:path";
import type { Db } from "../db/client";
import { callProvider } from "./call";
import { fetchRetry, okJson } from "./http";
import { PRICES } from "./prices";

/**
 * ElevenLabs (A18, event day): native voices with character timestamps, the voice library, music beds, sound
 * effects and dubbing. Plain fetch against api.elevenlabs.io; every call goes through callProvider (cap + ledger).
 */
const BASE = "https://api.elevenlabs.io";
const key = () => process.env.ELEVENLABS_API_KEY ?? "";
const headers = (json = true) => ({ "xi-api-key": key(), ...(json ? { "content-type": "application/json" } : {}) });

export const TTS_MODEL_11 = () => process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
}

export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface SpokenWord {
  word: string;
  start: number;
  end: number;
}

/** Characters with times -> words with times (whitespace splits words; punctuation stays with its word). */
export function wordsFromAlignment(a: Alignment | null | undefined): SpokenWord[] {
  if (!a?.characters?.length) return [];
  const out: SpokenWord[] = [];
  let cur: SpokenWord | null = null;
  a.characters.forEach((ch, i) => {
    const s = a.character_start_times_seconds[i] ?? 0;
    const e = a.character_end_times_seconds[i] ?? s;
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { word: ch, start: s, end: e };
    else {
      cur.word += ch;
      cur.end = e;
    }
  });
  if (cur) out.push(cur);
  return out;
}

export const ttsCost = (chars: number) => (chars / 1000) * PRICES.elevenlabs.perThousandChars;

/** Text to speech with character timestamps. Returns mp3 bytes and the words with times (seconds). */
export async function ttsWithTimestamps(
  db: Db,
  o: {
    voiceId: string;
    text: string;
    languageCode?: string;
    modelId?: string;
    settings?: VoiceSettings;
    previousText?: string;
    nextText?: string;
    seed?: number;
    runId?: string;
    note?: string;
  },
): Promise<{ mp3: Buffer | null; words: SpokenWord[]; durationSec: number; mode: "live" | "demo"; usd: number }> {
  const model = o.modelId ?? TTS_MODEL_11();
  const out = await callProvider(db, {
    provider: "elevenlabs",
    note: o.note ?? `tts ${o.text.length} chars (${o.voiceId})`,
    runId: o.runId,
    estimateUsd: ttsCost(o.text.length) + 0.001,
    demo: () => ({ mp3: null as Buffer | null, alignment: null as Alignment | null }),
    live: async () => {
      const body: Record<string, unknown> = {
        text: o.text,
        model_id: model,
        voice_settings: o.settings,
      };
      if (o.languageCode && model !== "eleven_multilingual_v2") body.language_code = o.languageCode;
      if (o.previousText && !model.startsWith("eleven_v3")) body.previous_text = o.previousText;
      if (o.nextText && !model.startsWith("eleven_v3")) body.next_text = o.nextText;
      if (o.seed !== undefined) body.seed = o.seed;
      const r = await okJson<{ audio_base64: string; alignment?: Alignment; normalized_alignment?: Alignment }>(
        await fetchRetry(
          `${BASE}/v1/text-to-speech/${encodeURIComponent(o.voiceId)}/with-timestamps?output_format=mp3_44100_128`,
          { method: "POST", headers: headers(), body: JSON.stringify(body), timeoutMs: 120_000, retries: 2 },
        ),
        "elevenlabs tts",
      );
      return {
        result: {
          mp3: Buffer.from(r.audio_base64, "base64"),
          alignment: r.alignment ?? r.normalized_alignment ?? null,
        },
        usd: ttsCost(o.text.length),
        units: `${o.text.length} chars ${model}`,
      };
    },
  });
  const words = wordsFromAlignment(out.value.alignment);
  const durationSec = out.value.alignment?.character_end_times_seconds.at(-1) ?? words.at(-1)?.end ?? 0;
  return { mp3: out.value.mp3, words, durationSec, mode: out.mode, usd: out.usd };
}

export interface SharedVoice {
  voice_id: string;
  public_owner_id: string;
  name: string;
  accent?: string;
  gender?: string;
  age?: string;
  language?: string;
  locale?: string;
  descriptive?: string;
  use_case?: string;
  category?: string;
  description?: string;
  preview_url?: string;
  cloned_by_count?: number;
  usage_character_count_1y?: number;
  verified_languages?: { language: string; accent?: string; locale?: string; preview_url?: string }[];
}

/** Search the public voice library (free). */
export async function searchSharedVoices(
  db: Db,
  q: { language?: string; search?: string; gender?: string; useCases?: string; pageSize?: number; accent?: string },
): Promise<SharedVoice[]> {
  const out = await callProvider(db, {
    provider: "elevenlabs",
    note: `voice library: ${q.language ?? ""} ${q.search ?? ""}`.trim(),
    estimateUsd: 0,
    demo: () => [] as SharedVoice[],
    live: async () => {
      const p = new URLSearchParams({ page_size: String(q.pageSize ?? 30), sort: "usage_character_count_1y" });
      if (q.language) p.set("language", q.language);
      if (q.search) p.set("search", q.search);
      if (q.gender) p.set("gender", q.gender);
      if (q.accent) p.set("accent", q.accent);
      if (q.useCases) p.set("use_cases", q.useCases);
      const r = await okJson<{ voices: SharedVoice[] }>(
        await fetchRetry(`${BASE}/v1/shared-voices?${p}`, { headers: headers(false), timeoutMs: 30_000 }),
        "elevenlabs shared-voices",
      );
      return { result: r.voices ?? [], usd: 0 };
    },
  });
  return out.value;
}

/** Add a library voice to the account so TTS can use it (idempotent: an already-added voice is fine). */
export async function addSharedVoice(db: Db, v: { publicOwnerId: string; voiceId: string; name: string }) {
  const out = await callProvider(db, {
    provider: "elevenlabs",
    note: `add library voice ${v.name}`,
    estimateUsd: 0,
    demo: () => v.voiceId,
    live: async () => {
      const res = await fetchRetry(
        `${BASE}/v1/voices/add/${encodeURIComponent(v.publicOwnerId)}/${encodeURIComponent(v.voiceId)}`,
        { method: "POST", headers: headers(), body: JSON.stringify({ new_name: v.name }), timeoutMs: 30_000 },
      );
      if (res.ok) {
        const j = (await res.json()) as { voice_id?: string };
        return { result: j.voice_id ?? v.voiceId, usd: 0 };
      }
      const t = await res.text();
      if (/already|exists/i.test(t)) return { result: v.voiceId, usd: 0 };
      throw new Error(`elevenlabs add voice HTTP ${res.status}: ${t.slice(0, 200)}`);
    },
  });
  return out.value;
}

export const musicCost = (sec: number) => (sec / 60) * PRICES.elevenlabs.musicPerMinute;

/** A music bed (instrumental) from a prompt. Writes the mp3 to `out`. */
export async function composeMusic(
  db: Db,
  o: { prompt: string; lengthSec: number; out: string; runId?: string },
): Promise<{ file: string | null; mode: "live" | "demo"; usd: number }> {
  const sec = Math.min(300, Math.max(5, Math.ceil(o.lengthSec)));
  const out = await callProvider(db, {
    provider: "elevenlabs",
    note: `music ${sec}s: ${o.prompt.slice(0, 50)}`,
    runId: o.runId,
    estimateUsd: musicCost(sec),
    demo: () => null as string | null,
    live: async () => {
      const res = await fetchRetry(`${BASE}/v1/music?output_format=mp3_44100_128`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          prompt: o.prompt,
          music_length_ms: sec * 1000,
          force_instrumental: true,
          model_id: process.env.ELEVENLABS_MUSIC_MODEL || "music_v2_5",
        }),
        timeoutMs: 300_000,
        retries: 1,
      });
      if (!res.ok) throw new Error(`elevenlabs music HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      fs.mkdirSync(path.dirname(o.out), { recursive: true });
      fs.writeFileSync(o.out, Buffer.from(await res.arrayBuffer()));
      return { result: o.out, usd: musicCost(sec), units: `${sec}s music` };
    },
  });
  return { file: out.value, mode: out.mode, usd: out.usd };
}

/** One sound effect (whoosh on a cut, a soft hit on the hook). Writes the mp3 to `out`. */
export async function soundEffect(
  db: Db,
  o: { text: string; durationSec?: number; out: string; runId?: string; promptInfluence?: number },
): Promise<{ file: string | null; mode: "live" | "demo"; usd: number }> {
  const out = await callProvider(db, {
    provider: "elevenlabs",
    note: `sfx: ${o.text.slice(0, 50)}`,
    runId: o.runId,
    estimateUsd: PRICES.elevenlabs.sfxEach,
    demo: () => null as string | null,
    live: async () => {
      const res = await fetchRetry(`${BASE}/v1/sound-generation?output_format=mp3_44100_128`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          text: o.text,
          ...(o.durationSec ? { duration_seconds: o.durationSec } : {}),
          prompt_influence: o.promptInfluence ?? 0.5,
        }),
        timeoutMs: 120_000,
      });
      if (!res.ok) throw new Error(`elevenlabs sfx HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      fs.mkdirSync(path.dirname(o.out), { recursive: true });
      fs.writeFileSync(o.out, Buffer.from(await res.arrayBuffer()));
      return { result: o.out, usd: PRICES.elevenlabs.sfxEach, units: "1 sfx" };
    },
  });
  return { file: out.value, mode: out.mode, usd: out.usd };
}

export const dubCost = (sec: number) => (sec / 60) * PRICES.elevenlabs.dubPerMinute;

/**
 * Dub a finished ad into another language (ElevenLabs Dubbing): upload, poll until dubbed, download the dubbed MP4
 * to `out`. The original picture stays; the voice is re-spoken in the target language.
 */
export async function dubVideo(
  db: Db,
  o: {
    file: string;
    sourceLang: string;
    targetLang: string;
    durationSec: number;
    out: string;
    runId?: string;
    signal?: AbortSignal;
  },
): Promise<{ file: string | null; mode: "live" | "demo"; usd: number; dubbingId?: string }> {
  const out = await callProvider(db, {
    provider: "elevenlabs",
    note: `dubbing ${o.sourceLang}->${o.targetLang} ${Math.round(o.durationSec)}s`,
    runId: o.runId,
    estimateUsd: dubCost(o.durationSec) + 0.05,
    demo: () => ({ file: null as string | null, id: undefined as string | undefined }),
    live: async () => {
      const form = new FormData();
      form.set(
        "file",
        new Blob([new Uint8Array(fs.readFileSync(o.file))], { type: "video/mp4" }),
        path.basename(o.file),
      );
      form.set("source_lang", o.sourceLang);
      form.set("target_lang", o.targetLang);
      form.set("num_speakers", "1");
      form.set("watermark", "false");
      form.set("name", `nexus ${path.basename(o.file)} ${o.targetLang}`);
      const sub = await okJson<{ dubbing_id: string; expected_duration_sec?: number }>(
        await fetchRetry(`${BASE}/v1/dubbing`, {
          method: "POST",
          headers: headers(false),
          body: form,
          timeoutMs: 180_000,
          retries: 0,
        }),
        "elevenlabs dubbing",
      );
      const until = Date.now() + 15 * 60_000;
      for (;;) {
        if (Date.now() > until) throw new Error("elevenlabs dubbing: timed out");
        await new Promise((r) => setTimeout(r, 6000));
        const st = await okJson<{ status: string; error?: string }>(
          await fetchRetry(`${BASE}/v1/dubbing/${sub.dubbing_id}`, { headers: headers(false), timeoutMs: 30_000 }),
          "elevenlabs dubbing status",
        );
        if (st.status === "dubbed") break;
        if (st.status === "failed") throw new Error(`elevenlabs dubbing failed: ${st.error ?? ""}`);
      }
      const res = await fetchRetry(`${BASE}/v1/dubbing/${sub.dubbing_id}/audio/${o.targetLang}`, {
        headers: headers(false),
        timeoutMs: 180_000,
      });
      if (!res.ok)
        throw new Error(`elevenlabs dubbing download HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      fs.mkdirSync(path.dirname(o.out), { recursive: true });
      fs.writeFileSync(o.out, Buffer.from(await res.arrayBuffer()));
      return {
        result: { file: o.out, id: sub.dubbing_id },
        usd: dubCost(o.durationSec),
        units: `${o.durationSec}s dub`,
      };
    },
  });
  return { file: out.value.file, mode: out.mode, usd: out.usd, dubbingId: out.value.id };
}

/** Remaining character credits (free). */
export async function subscription(): Promise<{ used: number; limit: number; tier: string } | null> {
  if (!key()) return null;
  const r = await fetchRetry(`${BASE}/v1/user/subscription`, { headers: headers(false), timeoutMs: 20_000 });
  if (!r.ok) return null;
  const j = (await r.json()) as { character_count: number; character_limit: number; tier: string };
  return { used: j.character_count, limit: j.character_limit, tier: j.tier };
}

/** Speech to text (Scribe) with word timestamps: used for dubbed audio (captions in the new language). */
export async function scribe(
  db: Db,
  o: { file: string; languageCode?: string; runId?: string; durationSec: number },
): Promise<{ words: SpokenWord[]; text: string; mode: "live" | "demo"; usd: number }> {
  const out = await callProvider(db, {
    provider: "elevenlabs",
    note: `scribe ${Math.round(o.durationSec)}s ${o.languageCode ?? ""}`.trim(),
    runId: o.runId,
    estimateUsd: (o.durationSec / 3600) * PRICES.elevenlabs.sttPerHour + 0.01,
    demo: () => ({ words: [] as SpokenWord[], text: "" }),
    live: async () => {
      const form = new FormData();
      form.set(
        "file",
        new Blob([new Uint8Array(fs.readFileSync(o.file))], { type: "audio/mpeg" }),
        path.basename(o.file),
      );
      form.set("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
      form.set("timestamps_granularity", "word");
      form.set("tag_audio_events", "false");
      if (o.languageCode) form.set("language_code", o.languageCode);
      const r = await okJson<{ text: string; words: { text: string; start: number; end: number; type: string }[] }>(
        await fetchRetry(`${BASE}/v1/speech-to-text`, {
          method: "POST",
          headers: headers(false),
          body: form,
          timeoutMs: 180_000,
          retries: 1,
        }),
        "elevenlabs scribe",
      );
      const words = (r.words ?? [])
        .filter((w) => w.type === "word" && w.text.trim())
        .map((w) => ({ word: w.text.trim(), start: w.start, end: w.end }));
      return {
        result: { words, text: r.text },
        usd: (o.durationSec / 3600) * PRICES.elevenlabs.sttPerHour,
        units: `${Math.round(o.durationSec)}s scribe`,
      };
    },
  });
  return { ...out.value, mode: out.mode, usd: out.usd };
}
