import fs from "node:fs";
import sharp from "sharp";
import type { Db } from "../db/client";
import { callProvider } from "./call";
import { fetchRetry, okJson } from "./http";

/**
 * Higgsfield (Kling Omni, reference-guided video). Auth: `Authorization: Key <key>` (verified 12 Oct).
 * The image goes inline as a JPEG data URI. Price is not documented: the ledger records a conservative estimate.
 */
const API = "https://api.higgsfield.ai";
export const HF_MODEL_PATH = () => process.env.HIGGSFIELD_I2V_PATH || "/kling-video/omni/image-reference";
export const hfClipCost = (sec: number) => 0.5 * Math.max(1, sec / 5);

function auth(): string {
  const key = process.env.HIGGSFIELD_API_KEY ?? "";
  const secret = process.env.HIGGSFIELD_API_SECRET ?? "";
  return `Key ${secret && !key.includes(":") ? `${key}:${secret}` : key}`;
}

export async function higgsfieldClip(
  db: Db,
  o: {
    imageFile: string;
    prompt: string;
    durationSec?: number;
    out: string;
    runId?: string;
    signal?: AbortSignal;
    demo: () => Promise<string | null>;
  },
): Promise<{ file: string | null; mode: "live" | "demo"; usd: number; model: string }> {
  const dur = Math.min(10, Math.max(3, Math.round(o.durationSec ?? 5)));
  const out = await callProvider(db, {
    provider: "higgsfield",
    note: `video ${dur}s: ${o.prompt.slice(0, 50)}`,
    runId: o.runId,
    estimateUsd: hfClipCost(dur),
    demo: o.demo,
    live: async () => {
      const jpeg = await sharp(o.imageFile)
        .resize(720, 1280, { fit: "cover", position: "attention" })
        .jpeg({ quality: 88 })
        .toBuffer();
      const sub = await okJson<{ request_id: string; status_url: string }>(
        await fetchRetry(`${API}${HF_MODEL_PATH()}`, {
          method: "POST",
          headers: { Authorization: auth(), "content-type": "application/json" },
          body: JSON.stringify({
            prompt: o.prompt,
            image_urls: [`data:image/jpeg;base64,${jpeg.toString("base64")}`],
            duration: dur,
            aspect_ratio: "9:16",
          }),
          signal: o.signal,
          timeoutMs: 60_000,
          retries: 1,
        }),
        "higgsfield submit",
      );
      const until = Date.now() + 12 * 60_000;
      for (;;) {
        if (Date.now() > until) throw new Error("higgsfield: timed out");
        await new Promise((r) => setTimeout(r, 6000));
        const st = await okJson<{ status: string; video?: { url?: string }; error?: unknown }>(
          await fetchRetry(sub.status_url, { headers: { Authorization: auth() }, signal: o.signal, timeoutMs: 30_000 }),
          "higgsfield status",
        );
        if (st.status === "completed" && st.video?.url) {
          const vid = await fetchRetry(st.video.url, { signal: o.signal, timeoutMs: 120_000 });
          fs.writeFileSync(o.out, Buffer.from(await vid.arrayBuffer()));
          return { result: o.out, usd: hfClipCost(dur), units: `${dur}s clip (estimate)` };
        }
        if (["failed", "nsfw", "cancelled", "error"].includes(st.status))
          throw new Error(`higgsfield: ${st.status} ${JSON.stringify(st.error ?? "").slice(0, 120)}`);
      }
    },
  });
  return {
    file: out.value,
    mode: out.mode,
    usd: out.usd,
    model: out.mode === "live" ? `higgsfield${HF_MODEL_PATH()}` : "none",
  };
}
