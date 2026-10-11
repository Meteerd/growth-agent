import fs from "node:fs";
import OpenAI from "openai";
import type { Db } from "../db/client";
import { probe } from "../media/ffmpeg";
import { callProvider } from "./call";
import { PRICES } from "./prices";

let client: OpenAI | undefined;
const oa = () => (client ??= new OpenAI({ maxRetries: 3, timeout: 180_000 }));

export const IMAGE_MODEL = () => process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
export const TTS_MODEL = () => process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

export interface Transcript {
  text: string;
  segments: { start: number; end: number; text: string }[];
  language?: string;
  source: "openai" | "provided" | "none";
}

/** Speech to text with segment timestamps (whisper-1 verbose_json). */
export async function transcribe(
  db: Db,
  audioFile: string,
  o: { runId?: string; demo: () => Transcript },
): Promise<{ t: Transcript; mode: "live" | "demo" }> {
  const info = await probe(audioFile).catch(() => ({ durationSec: 60 }));
  const minutes = Math.max(0.1, info.durationSec / 60);
  const out = await callProvider(db, {
    provider: "openai",
    note: `transcribe ${Math.round(info.durationSec)}s`,
    runId: o.runId,
    estimateUsd: minutes * PRICES.openai.transcribePerMinute + 0.001,
    demo: o.demo,
    live: async () => {
      const r = await oa().audio.transcriptions.create({
        file: fs.createReadStream(audioFile),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });
      return {
        result: {
          text: r.text,
          language: r.language,
          segments: (r.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })),
          source: "openai" as const,
        },
        usd: minutes * PRICES.openai.transcribePerMinute,
        units: `${minutes.toFixed(2)} min`,
      };
    },
  });
  return { t: out.value, mode: out.mode };
}

/** One image from a prompt (keyframes). Returns PNG bytes. */
export async function generateImage(
  db: Db,
  prompt: string,
  o: { runId?: string; size?: "1024x1536" | "1024x1024" | "1536x1024"; demo: () => Promise<Buffer>; refs?: string[] },
): Promise<{ png: Buffer; mode: "live" | "demo"; usd: number; model: string }> {
  const out = await callProvider(db, {
    provider: "openai",
    note: `image: ${prompt.slice(0, 60)}`,
    runId: o.runId,
    estimateUsd: PRICES.openai.imagePerImage,
    demo: o.demo,
    live: async () => {
      const r = await oa().images.generate({
        model: IMAGE_MODEL(),
        prompt,
        size: o.size ?? "1024x1536",
        quality: "medium",
        n: 1,
      });
      const b64 = r.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI image: empty response");
      return { result: Buffer.from(b64, "base64"), usd: PRICES.openai.imagePerImage, units: "1 image" };
    },
  });
  return { png: out.value, mode: out.mode, usd: out.usd, model: out.mode === "live" ? IMAGE_MODEL() : "local-svg" };
}

/** Voiceover (mp3). */
export async function speak(
  db: Db,
  text: string,
  o: { runId?: string; voice?: string; instructions?: string; demo: () => Promise<Buffer | null> },
): Promise<{ mp3: Buffer | null; mode: "live" | "demo"; usd: number }> {
  const minutes = Math.max(0.05, text.split(/\s+/).length / 150);
  const out = await callProvider(db, {
    provider: "openai",
    note: `tts ${text.length} chars`,
    runId: o.runId,
    estimateUsd: minutes * PRICES.openai.ttsPerMinute + 0.002,
    demo: o.demo,
    live: async () => {
      const r = await oa().audio.speech.create({
        model: TTS_MODEL(),
        voice: (o.voice ?? "alloy") as "alloy",
        input: text,
        instructions: o.instructions ?? "Warm, calm, natural pace. Not salesy.",
        response_format: "mp3",
      });
      return {
        result: Buffer.from(await r.arrayBuffer()),
        usd: minutes * PRICES.openai.ttsPerMinute,
        units: `${text.length} chars`,
      };
    },
  });
  return { mp3: out.value, mode: out.mode, usd: out.usd };
}
