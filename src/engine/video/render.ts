import fs from "node:fs";
import path from "node:path";
import type { Ad916Props } from "../../../remotion/types";
import { probe } from "../media/ffmpeg";
import { composeAd916 } from "./compose";
import { withAssetServer } from "./files";

const g = globalThis as unknown as { __nexusBundle?: Promise<string> };

async function bundleOnce(): Promise<string> {
  if (!g.__nexusBundle) {
    g.__nexusBundle = (async () => {
      const { bundle } = await import("@remotion/bundler");
      return bundle({ entryPoint: path.resolve("remotion/index.ts"), onProgress: () => undefined });
    })();
    g.__nexusBundle.catch(() => {
      g.__nexusBundle = undefined;
    });
  }
  return g.__nexusBundle;
}

export interface RenderOut {
  file: string;
  durationSec: number;
  width: number;
  height: number;
  renderer: "remotion" | "ffmpeg";
}

/** Props use /api/assets/... URLs; rewritten to the local asset server for the render. */
function withBase(p: Ad916Props, base: string): Ad916Props {
  const abs = (u?: string) => (u?.startsWith("/api/") ? `${base}${u}` : u);
  return {
    ...p,
    shots: p.shots.map((s) => ({ ...s, src: abs(s.src)!, clipSrc: abs(s.clipSrc) })),
    voiceoverSrc: abs(p.voiceoverSrc),
    logoSrc: abs(p.logoSrc),
  };
}

export async function renderRemotion(
  props: Ad916Props,
  out: string,
  onProgress?: (p: number) => void,
): Promise<RenderOut> {
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const serveUrl = await bundleOnce();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await withAssetServer(async (base) => {
    const inputProps = withBase(props, base);
    const composition = await selectComposition({ serveUrl, id: "Ad916", inputProps });
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: out,
      inputProps,
      concurrency: Number(process.env.RENDER_CONCURRENCY ?? 4) || 4,
      onProgress: ({ progress }) => onProgress?.(progress),
      chromiumOptions: { gl: "angle" },
    });
  });
  const info = await probe(out);
  return {
    file: out,
    durationSec: info.durationSec,
    width: info.width ?? 1080,
    height: info.height ?? 1920,
    renderer: "remotion",
  };
}

/** The Ad916 spec rendered with sharp + ffmpeg (default; see docs/DECISIONS.md). */
export async function renderFfmpeg(
  props: Ad916Props,
  out: string,
  onProgress?: (p: number) => void,
): Promise<RenderOut> {
  return composeAd916(props, out, `${out}.parts`, onProgress);
}

/**
 * Default renderer: sharp + ffmpeg (fast, no browser). RENDERER=remotion tries the Remotion composition first
 * (it timed out loading in headless Chrome on this machine on 12 Oct; kept for later).
 */
export async function renderAd(props: Ad916Props, out: string, onProgress?: (p: number) => void): Promise<RenderOut> {
  if (process.env.RENDERER === "remotion") {
    try {
      return await renderRemotion(props, out, onProgress);
    } catch (e) {
      console.warn("[render] Remotion failed, falling back to ffmpeg:", e instanceof Error ? e.message : e);
    }
  }
  return renderFfmpeg(props, out, onProgress);
}
