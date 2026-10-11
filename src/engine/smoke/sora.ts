import fs from "node:fs";
import path from "node:path";
import type { Db } from "../db/client";
import { probe } from "../media/ffmpeg";
import { soraClip, VIDEO_MODEL } from "../providers/openai";
import { saveFixture } from "./record";

/** One 4 s OpenAI video from the smoke keyframe (checks the video API is available on our key). */
export async function smokeSora(db: Db) {
  const img = path.resolve(process.env.ASSETS_DIR || "data/assets", "smoke/openai_keyframe.png");
  const out = path.resolve(process.env.ASSETS_DIR || "data/assets", "smoke/sora_clip.mp4");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = await soraClip(db, {
    imageFile: fs.existsSync(img) ? img : undefined,
    prompt:
      "The beagle lifts its head, looks toward the door, then settles back down calmly on the rug. Soft morning light, gentle handheld feel.",
    seconds: 4,
    out,
    runId: "smoke_sora",
    demo: async () => null,
  });
  const info = r.file ? await probe(r.file) : null;
  const file = saveFixture("openai", "video_smoke", { model: VIDEO_MODEL(), mode: r.mode, usd: r.usd, clip: info });
  return { mode: r.mode, usd: r.usd, file, clip: info };
}
