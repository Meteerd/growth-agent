import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Db } from "../db/client";
import { callProvider } from "../providers/call";
import { fetchRetry, okJson } from "../providers/http";
import { generateImage } from "../providers/openai";
import type { Aspect, ImageModel } from "./types";

/**
 * Image generation for studio slides. The image never carries the ad copy (templates draw it), except for the
 * "native" template. Models: OpenAI gpt-image-2 direct (the engine's proven default) or fal (GPT Image 2.5 Flare,
 * Nano Banana Pro / 2.1, Seedream 5 Lite) through fal's queue REST API. References (brand images, product shots,
 * the carousel's first image for consistency) go inline as data URIs. Every call goes through the spend ledger.
 */

export interface ImageModelInfo {
  label: string;
  /** USD per image (list price, high quality, ~1 MP) */
  usd: number;
  t2i: string;
  edit?: string;
  kind: "openai" | "fal-gpt" | "fal-nano" | "fal-seedream";
  note: string;
}

export const IMAGE_MODEL_INFO: Record<ImageModel, ImageModelInfo> = {
  "openai:gpt-image-2": {
    label: "OpenAI GPT Image 2 (direct)",
    usd: 0.21,
    t2i: "gpt-image-2",
    kind: "openai",
    note: "The engine's proven photoreal default; strong text when the native template is used.",
  },
  "fal:gpt-image-2.5-flare": {
    label: "GPT Image 2.5 Flare (fal)",
    usd: 0.05,
    t2i: "openai/gpt-image-2.5/flare/text-to-image",
    edit: "openai/gpt-image-2.5/flare/edit",
    kind: "fal-gpt",
    note: "Newest OpenAI image model on fal, ~4x cheaper than GPT Image 2 direct; up to 16 references.",
  },
  "fal:nano-banana-pro": {
    label: "Nano Banana Pro (fal)",
    usd: 0.15,
    t2i: "fal-ai/nano-banana-pro",
    edit: "fal-ai/nano-banana-pro/edit",
    kind: "fal-nano",
    note: "Best at keeping the same person, pet or product across carousel slides; native 4:5 and 9:16.",
  },
  "fal:nano-banana-2.1": {
    label: "Nano Banana 2.1 (fal)",
    usd: 0.06,
    t2i: "fal-ai/nano-banana-2.1",
    edit: "fal-ai/nano-banana-2.1/edit",
    kind: "fal-nano",
    note: "Cheaper Google model, good fallback when another model refuses a health prompt.",
  },
  "fal:seedream-5-lite": {
    label: "Seedream 5 Lite (fal)",
    usd: 0.035,
    t2i: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    edit: "fal-ai/bytedance/seedream/v5/lite/edit",
    kind: "fal-seedream",
    note: "Cheapest; fine for backgrounds and textures.",
  },
};

const SIZES: Record<Aspect, { w: number; h: number; openai: "1024x1536" | "1024x1024" }> = {
  "4:5": { w: 1024, h: 1280, openai: "1024x1536" },
  "1:1": { w: 1024, h: 1024, openai: "1024x1024" },
  "9:16": { w: 1152, h: 2048, openai: "1024x1536" },
};

const falHeaders = () => ({ Authorization: `Key ${process.env.FAL_KEY}`, "content-type": "application/json" });

async function dataUri(file: string): Promise<string> {
  const buf = await sharp(file, file.endsWith(".svg") ? { density: 200 } : {})
    .flatten({ background: "#ffffff" })
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/** Submit to fal's queue, poll, fetch the first image. */
async function falRun(endpoint: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<Buffer> {
  const res0 = await fetchRetry(`https://queue.fal.run/${endpoint}`, {
    method: "POST",
    headers: falHeaders(),
    body: JSON.stringify(input),
    signal,
    timeoutMs: 60_000,
    retries: 1,
  });
  if (!res0.ok) throw new Error(`fal ${endpoint} HTTP ${res0.status}: ${(await res0.text()).slice(0, 300)}`);
  const sub = (await res0.json()) as { status_url: string; response_url: string };
  const until = Date.now() + 6 * 60_000;
  for (;;) {
    if (Date.now() > until) throw new Error(`fal ${endpoint}: timed out`);
    await new Promise((r) => setTimeout(r, 2500));
    const st = await okJson<{ status: string; error?: string }>(
      await fetchRetry(sub.status_url, { headers: falHeaders(), signal, timeoutMs: 30_000 }),
      "fal status",
    );
    if (st.status === "COMPLETED") break;
    if (st.status === "FAILED" || st.status === "ERROR") throw new Error(`fal ${endpoint}: ${st.error ?? st.status}`);
  }
  const r = await fetchRetry(sub.response_url, { headers: falHeaders(), signal, timeoutMs: 60_000 });
  const body = (await r.json()) as { images?: { url?: string }[]; detail?: unknown };
  if (!r.ok) throw new Error(`fal ${endpoint} result HTTP ${r.status}: ${JSON.stringify(body).slice(0, 300)}`);
  const url = body.images?.[0]?.url;
  if (!url) throw new Error(`fal ${endpoint}: no image (${JSON.stringify(body).slice(0, 200)})`);
  const img = await fetchRetry(url, { signal, timeoutMs: 120_000 });
  return Buffer.from(await img.arrayBuffer());
}

export interface GenImageOpts {
  model: ImageModel;
  prompt: string;
  aspect: Aspect;
  /** local files used as references (product, brand image, the carousel's anchor image) */
  refs?: string[];
  out: string;
  signal?: AbortSignal;
  note?: string;
}

export interface GenImageResult {
  file: string;
  model: string;
  usd: number;
  mode: "live" | "demo";
}

function placeholder(aspect: Aspect, prompt: string): Promise<Buffer> {
  const { w, h } = SIZES[aspect];
  const hue = [...prompt].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},35%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},30%,32%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Generate one image (text-to-image, or edit with references) and save it as PNG. */
export async function genImage(db: Db, o: GenImageOpts): Promise<GenImageResult> {
  const info = IMAGE_MODEL_INFO[o.model];
  fs.mkdirSync(path.dirname(o.out), { recursive: true });
  const refs = (o.refs ?? []).filter((f) => fs.existsSync(f)).slice(0, 6);
  if (info.kind === "openai") {
    const g = await generateImage(db, o.prompt, {
      size: SIZES[o.aspect].openai,
      quality: "high",
      refs: refs.length ? refs : undefined,
      demo: () => placeholder(o.aspect, o.prompt),
    });
    fs.writeFileSync(o.out, g.png);
    return { file: o.out, model: g.model, usd: g.usd, mode: g.mode };
  }
  const { w, h } = SIZES[o.aspect];
  const out = await callProvider(db, {
    provider: "fal",
    note: o.note ?? `image ${o.model}: ${o.prompt.slice(0, 50)}`,
    estimateUsd: info.usd * 1.2,
    demo: () => placeholder(o.aspect, o.prompt),
    live: async () => {
      const useEdit = refs.length > 0 && info.edit;
      const image_urls = useEdit ? await Promise.all(refs.map(dataUri)) : undefined;
      const input: Record<string, unknown> =
        info.kind === "fal-gpt"
          ? {
              prompt: o.prompt,
              image_size: { width: w, height: h },
              quality: "high",
              num_images: 1,
              output_format: "png",
            }
          : info.kind === "fal-nano"
            ? { prompt: o.prompt, aspect_ratio: o.aspect, resolution: "2K", num_images: 1, output_format: "png" }
            : { prompt: o.prompt, image_size: { width: w + (w % 16), height: h + (h % 16) }, num_images: 1 };
      if (image_urls) input.image_urls = image_urls;
      const buf = await falRun(useEdit ? info.edit! : info.t2i, input, o.signal);
      return { result: buf, usd: info.usd, units: `1 image ${o.model}` };
    },
  });
  await sharp(out.value).png().toFile(o.out);
  return { file: o.out, model: out.mode === "live" ? o.model : "placeholder", usd: out.usd, mode: out.mode };
}
