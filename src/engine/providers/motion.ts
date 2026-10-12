import type { Db } from "../db/client";
import { falLocked, imageToVideo } from "./fal";
import { higgsfieldClip } from "./higgsfield";

/** Animate one keyframe: fal first; Higgsfield when fal is locked, fails or is not live. Null = keep the still. */
export async function animateShot(
  db: Db,
  o: {
    imageFile: string;
    prompt: string;
    durationSec: number;
    out: string;
    runId?: string;
    onFallback?: (why: string) => Promise<void> | void;
  },
): Promise<{ file: string; usd: number; model: string; provider: "fal" | "higgsfield" } | null> {
  if (!falLocked()) {
    try {
      const r = await imageToVideo(db, {
        imageFile: o.imageFile,
        prompt: o.prompt,
        durationSec: o.durationSec > 5 ? 10 : 5,
        out: o.out,
        runId: o.runId,
        demo: async () => null,
      });
      if (r.file) return { file: r.file, usd: r.usd, model: r.model, provider: "fal" };
    } catch (e) {
      await o.onFallback?.(`fal: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const h = await higgsfieldClip(db, {
    imageFile: o.imageFile,
    prompt: o.prompt,
    durationSec: Math.max(5, Math.round(o.durationSec)),
    out: o.out,
    runId: o.runId,
    demo: async () => null,
  });
  return h.file ? { file: h.file, usd: h.usd, model: h.model, provider: "higgsfield" } : null;
}
