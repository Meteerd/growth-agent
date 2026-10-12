import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Db } from "../db/client";
import { probe } from "../media/ffmpeg";
import { callProvider } from "./call";
import { fetchRetry, okJson } from "./http";
import { PRICES } from "./prices";

/**
 * Gemini (A18): the video watcher. Uploads a whole MP4 (picture + sound) through the Files API and asks for
 * structured JSON (generateContent, responseJsonSchema). Used for winners (motion, music, text style, pacing) and
 * for our own renders (plain-language critique + per-shot scores into the regenerate loop).
 */
const BASE = "https://generativelanguage.googleapis.com";
export const GEMINI_MODEL = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";
const key = () => process.env.GEMINI_API_KEY ?? "";

async function upload(file: string, mime: string, signal?: AbortSignal): Promise<{ name: string; uri: string }> {
  const bytes = fs.readFileSync(file);
  const start = await fetchRetry(`${BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key(),
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length),
      "X-Goog-Upload-Header-Content-Type": mime,
      "content-type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: path.basename(file) } }),
    signal,
    timeoutMs: 60_000,
  });
  if (!start.ok) throw new Error(`gemini upload start HTTP ${start.status}: ${(await start.text()).slice(0, 200)}`);
  const url = start.headers.get("x-goog-upload-url");
  if (!url) throw new Error("gemini upload: no upload url");
  const done = await okJson<{ file: { name: string; uri: string; state: string } }>(
    await fetchRetry(url, {
      method: "POST",
      headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
      body: new Uint8Array(bytes),
      signal,
      timeoutMs: 300_000,
      retries: 1,
    }),
    "gemini upload",
  );
  let state = done.file.state;
  const until = Date.now() + 5 * 60_000;
  while (state !== "ACTIVE") {
    if (state === "FAILED") throw new Error("gemini: file processing failed");
    if (Date.now() > until) throw new Error("gemini: file never became ACTIVE");
    await new Promise((r) => setTimeout(r, 2000));
    const st = await okJson<{ state: string }>(
      await fetchRetry(`${BASE}/v1beta/${done.file.name}`, { headers: { "x-goog-api-key": key() }, signal }),
      "gemini file",
    );
    state = st.state;
  }
  return { name: done.file.name, uri: done.file.uri };
}

async function remove(name: string) {
  await fetch(`${BASE}/v1beta/${name}`, { method: "DELETE", headers: { "x-goog-api-key": key() } }).catch(
    () => undefined,
  );
}

/**
 * One Gemini call at a time per process (the project's per-minute quota trips on bursts); 429 waits and retries.
 * A model whose daily quota is used up (free tier: 20 requests per model per day) is skipped for the next one in
 * GEMINI_FALLBACKS, so the watcher keeps working until billing is enabled on the Google project.
 */
const g = globalThis as unknown as { __geminiQueue?: Promise<unknown>; __geminiDead?: Set<string> };
export const GEMINI_FALLBACKS = () =>
  (process.env.GEMINI_FALLBACKS || "gemini-3.6-flash,gemini-3-flash-preview,gemini-2.5-flash,gemini-3.5-flash-lite")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

async function generate(
  model: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ res: Response; model: string }> {
  g.__geminiDead ??= new Set();
  const run = async () => {
    const chain = [model, ...GEMINI_FALLBACKS().filter((m) => m !== model)].filter((m) => !g.__geminiDead!.has(m));
    let last: Response | null = null;
    for (const m of chain) {
      // thinkingLevel is for Gemini 3+; 2.5 models take a thinking budget instead
      const cfg = { ...(body.generationConfig as Record<string, unknown>) };
      if (m.startsWith("gemini-2.5")) cfg.thinkingConfig = { thinkingBudget: 4096 };
      const b = { ...body, generationConfig: cfg };
      for (let i = 0; ; i++) {
        const res = await fetchRetry(`${BASE}/v1beta/models/${m}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": key(), "content-type": "application/json" },
          body: JSON.stringify(b),
          signal,
          timeoutMs: 300_000,
          retries: 0,
        });
        if (res.ok) return { res, model: m };
        if (res.status === 429) {
          const t = await res.clone().text();
          if (/PerDay|per day/i.test(t)) {
            g.__geminiDead!.add(m);
            last = res;
            break; // next model
          }
        }
        if ((res.status !== 429 && res.status < 500) || i >= 3) {
          if (res.status === 404) break; // unknown model id: next model
          return { res, model: m };
        }
        await new Promise((r) => setTimeout(r, 15_000 * (i + 1)));
      }
    }
    if (last) return { res: last, model };
    throw new Error("gemini: no model available (daily free-tier quota used up on all; enable billing)");
  };
  const p = (g.__geminiQueue ?? Promise.resolve()).catch(() => undefined).then(run);
  g.__geminiQueue = p;
  return p;
}

export const geminiCost = (inTok: number, outTok: number) =>
  (inTok * PRICES.gemini.inputPer1M + outTok * PRICES.gemini.outputPer1M) / 1_000_000;

/** zod -> the JSON Schema subset Gemini accepts (no $schema, no additionalProperties false noise, no pattern). */
function jsonSchema(schema: z.ZodType): unknown {
  const raw = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        if (["$schema", "pattern", "minLength", "maxLength", "const", "default"].includes(k)) continue;
        if (k === "additionalProperties" && x === false) continue;
        o[k] = strip(x);
      }
      return o;
    }
    return v;
  };
  return strip(raw);
}

/**
 * Watch a media file (video with sound, or audio) and answer with JSON matching `schema`.
 * `fps` raises frame sampling (default 1 fps; 2 to 4 for short ads so cuts and shake are seen).
 */
export async function watch<T>(
  db: Db,
  o: {
    file: string;
    prompt: string;
    system?: string;
    schema: z.ZodType<T>;
    fps?: number;
    runId?: string;
    note: string;
    demo: () => T;
    signal?: AbortSignal;
  },
): Promise<{ value: T; mode: "live" | "demo"; usd: number; model: string }> {
  const isAudio = /\.(mp3|wav|m4a)$/i.test(o.file);
  const info = await probe(o.file).catch(() => ({ durationSec: 60 }));
  const fps = o.fps ?? 1;
  const estTok = Math.ceil(info.durationSec * (isAudio ? 32 : 32 + 258 * fps)) + 3000;
  const model = GEMINI_MODEL();
  let used = model;
  const out = await callProvider(db, {
    provider: "gemini",
    note: o.note,
    runId: o.runId,
    estimateUsd: geminiCost(estTok, 12_000),
    demo: o.demo,
    live: async () => {
      const f = await upload(o.file, isAudio ? "audio/mpeg" : "video/mp4", o.signal);
      try {
        const media: Record<string, unknown> = {
          fileData: { mimeType: isAudio ? "audio/mpeg" : "video/mp4", fileUri: f.uri },
        };
        if (!isAudio) {
          media.videoMetadata = { fps };
          media.mediaProcessing = "STATIC";
        }
        const body = {
          contents: [{ role: "user", parts: [media, { text: o.prompt }] }],
          ...(o.system ? { systemInstruction: { parts: [{ text: o.system }] } } : {}),
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema(o.schema),
            thinkingConfig: { thinkingLevel: "MEDIUM" },
            mediaResolution: "MEDIA_RESOLUTION_HIGH",
            maxOutputTokens: 24_000,
          },
        };
        const gen = await generate(model, body, o.signal);
        used = gen.model;
        const res = gen.res;
        const r = await okJson<{
          candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
        }>(res, "gemini generateContent");
        const c = r.candidates?.[0];
        const text = (c?.content?.parts ?? [])
          .filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("");
        if (!text) throw new Error(`gemini: empty answer (${c?.finishReason ?? "no candidate"})`);
        const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
        const value = o.schema.parse(json);
        const u = r.usageMetadata ?? {};
        const usd = geminiCost(
          u.promptTokenCount ?? estTok,
          (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
        );
        return {
          result: value,
          usd,
          units: `${used} ${u.promptTokenCount ?? "?"} in / ${u.candidatesTokenCount ?? "?"} out`,
        };
      } finally {
        await remove(f.name);
      }
    },
  });
  return { value: out.value, mode: out.mode, usd: out.usd, model: out.mode === "live" ? used : "demo" };
}
