import fs from "node:fs";
import sharp from "sharp";
import type { Db } from "../db/client";
import { callProvider } from "./call";
import { fetchRetry, okJson } from "./http";

/**
 * Kling 2.5 Turbo Pro (event day, 12 Oct): better motion than 2.1 Standard and ~50 s per clip while 2.1 Standard
 * timed out in fal's queue. fal pricing: $0.35 per 5 s, +$0.07/s.
 */
export const FAL_I2V_MODEL = () => process.env.FAL_I2V_MODEL || "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
export const falClipCost = (sec: number) =>
  FAL_I2V_MODEL().includes("v2.1/standard") ? 0.25 + Math.max(0, sec - 5) * 0.05 : 0.35 + Math.max(0, sec - 5) * 0.07;

const headers = () => ({ Authorization: `Key ${process.env.FAL_KEY}`, "content-type": "application/json" });

/** Circuit breaker: once fal says the account is locked (no balance), stop calling it in this process. */
const g = globalThis as unknown as { __falLocked?: string };
export const falLocked = () => g.__falLocked;

interface QueueRes {
  request_id: string;
  status_url: string;
  response_url: string;
}

/**
 * Animate one keyframe into a short clip through fal's queue API (submit, poll, fetch result, download).
 * Audio off. The image goes inline as a JPEG data URI so nothing is uploaded elsewhere.
 */
export async function imageToVideo(
  db: Db,
  o: {
    imageFile: string;
    prompt: string;
    durationSec?: 5 | 10;
    out: string;
    runId?: string;
    signal?: AbortSignal;
    demo: () => Promise<string | null>;
  },
): Promise<{ file: string | null; mode: "live" | "demo"; usd: number; model: string }> {
  const dur = o.durationSec ?? 5;
  if (g.__falLocked) throw new Error(`fal unavailable: ${g.__falLocked}`);
  const out = await callProvider(db, {
    provider: "fal",
    note: `image-to-video ${dur}s: ${o.prompt.slice(0, 50)}`,
    runId: o.runId,
    estimateUsd: falClipCost(dur),
    demo: o.demo,
    live: async () => {
      const jpeg = await sharp(o.imageFile).resize(720, 1280, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer();
      const image_url = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      const res0 = await fetchRetry(`https://queue.fal.run/${FAL_I2V_MODEL()}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          prompt: o.prompt,
          image_url,
          duration: String(dur),
          negative_prompt: "blur, distortion, warped hands, extra limbs, text, watermark",
          cfg_scale: 0.5,
        }),
        signal: o.signal,
        timeoutMs: 60_000,
        retries: 1,
      });
      if (res0.status === 403 || res0.status === 402) {
        const body = (await res0.text()).slice(0, 200);
        if (/balance|locked|credit/i.test(body)) g.__falLocked = "account balance exhausted (top up at fal.ai)";
        throw new Error(`fal submit HTTP ${res0.status}: ${body}`);
      }
      const sub = await okJson<QueueRes>(res0, "fal submit");
      const until = Date.now() + 12 * 60_000;
      for (;;) {
        if (Date.now() > until) throw new Error("fal: timed out waiting for the clip");
        await new Promise((r) => setTimeout(r, 5000));
        const st = await okJson<{ status: string }>(
          await fetchRetry(sub.status_url, { headers: headers(), signal: o.signal, timeoutMs: 30_000 }),
          "fal status",
        );
        if (st.status === "COMPLETED") break;
        if (st.status === "FAILED" || st.status === "ERROR") throw new Error(`fal: ${st.status}`);
      }
      const res = await okJson<{ video?: { url?: string } }>(
        await fetchRetry(sub.response_url, { headers: headers(), signal: o.signal, timeoutMs: 60_000 }),
        "fal result",
      );
      if (!res.video?.url) throw new Error("fal: no video in the result");
      const vid = await fetchRetry(res.video.url, { signal: o.signal, timeoutMs: 120_000 });
      fs.writeFileSync(o.out, Buffer.from(await vid.arrayBuffer()));
      return { result: o.out, usd: falClipCost(dur), units: `${dur}s clip` };
    },
  });
  return { file: out.value, mode: out.mode, usd: out.usd, model: out.mode === "live" ? FAL_I2V_MODEL() : "none" };
}
