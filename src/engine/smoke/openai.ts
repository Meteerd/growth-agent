import fs from "node:fs";
import path from "node:path";
import { SEED_BRANDS } from "@/contracts";
import type { Db } from "../db/client";
import { extractAudio } from "../media/ffmpeg";
import { generateImage, IMAGE_MODEL, speak, transcribe } from "../providers/openai";
import { listSpend } from "../repo";
import { demoKeyframe, writeAsset } from "../video/keyframes";
import { saveFixture } from "./record";

/** One keyframe image, one TTS line, then transcribe that line back. Records results + spend. */
export async function smokeOpenai(db: Db) {
  const hound = SEED_BRANDS.find((b) => b.slug === "hound")!;
  const shot = {
    idx: 0,
    durationSec: 3,
    visualPrompt: "A beagle lying calmly on a rug by the front door, morning light",
    approved: false,
  };
  const img = await generateImage(
    db,
    `${shot.visualPrompt}. Style: ${hound.dossier.visual.styleNotes} Vertical 9:16, no text.`,
    { runId: "smoke_openai", demo: () => demoKeyframe(hound, shot) },
  );
  const imgFile = writeAsset("smoke/openai_keyframe.png", img.png);
  const line = "Ten minutes a day. Same dog. Calmer goodbyes.";
  const vo = await speak(db, line, { runId: "smoke_openai", demo: async () => null });
  let transcript: unknown = null;
  if (vo.mp3) {
    const mp3 = writeAsset("smoke/openai_vo.mp3", vo.mp3);
    const audio = await extractAudio(mp3, path.join(path.dirname(mp3), "openai_vo_16k.mp3"));
    if (audio)
      transcript = (
        await transcribe(db, audio, { runId: "smoke_openai", demo: () => ({ text: "", segments: [], source: "none" }) })
      ).t;
  }
  const spend = await listSpend(db, "smoke_openai");
  const usd = spend.reduce((a, s) => a + s.usd, 0);
  const file = saveFixture("openai", "smoke", {
    imageModel: IMAGE_MODEL(),
    image: { mode: img.mode, bytes: img.png.length, file: path.basename(imgFile) },
    tts: { mode: vo.mode, bytes: vo.mp3?.length ?? 0, line },
    transcript,
    spend,
  });
  fs.copyFileSync(imgFile, path.join(path.dirname(file), "smoke_keyframe.png"));
  return {
    mode: img.mode === "live" && vo.mode === "live" ? ("live" as const) : ("demo" as const),
    usd,
    file,
    imageMode: img.mode,
    ttsMode: vo.mode,
    transcript,
  };
}
