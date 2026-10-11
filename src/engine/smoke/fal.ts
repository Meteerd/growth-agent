import fs from "node:fs";
import path from "node:path";
import type { Db } from "../db/client";
import { probe } from "../media/ffmpeg";
import { FAL_I2V_MODEL, imageToVideo } from "../providers/fal";
import { saveFixture } from "./record";

/** One 5 s clip from the OpenAI smoke keyframe (data/assets/smoke/openai_keyframe.png). */
export async function smokeFal(db: Db) {
  const img = path.resolve(process.env.ASSETS_DIR || "data/assets", "smoke/openai_keyframe.png");
  if (!fs.existsSync(img)) throw new Error("run `pnpm smoke openai` first (needs its keyframe)");
  const out = path.resolve(process.env.ASSETS_DIR || "data/assets", "smoke/fal_clip.mp4");
  const r = await imageToVideo(db, {
    imageFile: img,
    prompt:
      "The beagle slowly lifts its head and settles back down calmly, gentle breathing, soft morning light, subtle camera push-in. Flat warm illustration style.",
    out,
    runId: "smoke_fal",
    demo: async () => null,
  });
  const info = r.file ? await probe(r.file) : null;
  const file = saveFixture("fal", "smoke", { model: FAL_I2V_MODEL(), mode: r.mode, usd: r.usd, clip: info });
  return { mode: r.mode, usd: r.usd, file, clip: info };
}
