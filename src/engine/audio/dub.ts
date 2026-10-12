import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Asset } from "@/contracts";
import { structured } from "../agent/claude";
import type { Db } from "../db/client";
import { newId, nowIso } from "../ids";
import { extractFrame, ffmpeg, probe } from "../media/ffmpeg";
import { dubVideo, scribe } from "../providers/elevenlabs";
import { getAsset, getBlueprint, getBrand, getConcept, upsertAsset } from "../repo";
import { type CaptionTrack, HORMOZI, markEmphasis } from "../video/captions";
import { composeAd916 } from "../video/compose";
import { fileToUrl, urlToFile } from "../video/files";

/**
 * A18 dubbing: the finished flagship re-spoken in another language by ElevenLabs Dubbing (the music and sound
 * effects stay), Scribe transcribes the dubbed voice with word timestamps, and the picture is composed again with
 * live captions in the new language (so the captions never show the old language over the new voice).
 */
export async function dubFlagship(db: Db, conceptId: string, targetLang: string) {
  const c = (await getConcept(db, conceptId))!;
  const brand = (await getBrand(db, c.brandId))!;
  const bp = c.blueprintId ? await getBlueprint(db, c.blueprintId) : null;
  const video = c.videoAssetId ? await getAsset(db, c.videoAssetId) : null;
  const src = video ? urlToFile(video.url) : null;
  if (!src || !fs.existsSync(src)) throw new Error("render the flagship first");
  const dir = path.resolve(process.env.ASSETS_DIR || "data/assets", "runs", c.runId, c.id, `dub_${targetLang}`);
  fs.mkdirSync(dir, { recursive: true });
  const info = await probe(src);
  // one dub per source video (a re-rendered flagship gets a new dub)
  const dubbed = path.join(dir, `dubbed_${video!.id}.mp4`);
  if (!fs.existsSync(dubbed)) {
    const d = await dubVideo(db, {
      file: src,
      sourceLang: c.language,
      targetLang,
      durationSec: info.durationSec,
      out: dubbed,
      runId: c.runId,
    });
    if (!d.file) throw new Error("elevenlabs dubbing is not live");
  }
  // the dubbed track (voice + the original music/SFX), stereo 48 kHz
  const audio = path.join(dir, "dubbed.wav");
  await ffmpeg(["-y", "-i", dubbed, "-vn", "-ac", "2", "-ar", "48000", audio]);
  const stt = await scribe(db, {
    file: audio,
    languageCode: targetLang,
    durationSec: info.durationSec,
    runId: c.runId,
  });
  if (!stt.words.length) throw new Error("scribe returned no words");

  // the hook title in the new language (same meaning, same length)
  let title: CaptionTrack["title"];
  let t = 0;
  const starts = c.shots.map((s) => {
    const x = t;
    t += s.durationSec;
    return x;
  });
  const style = bp?.captionStyle ?? HORMOZI;
  if (c.shots[0]?.onScreenText && style.hookTitle) {
    const tr = await structured(
      { db, runId: c.runId, phase: "production" },
      {
        route: "production",
        system: `Translate a short on-screen ad title into ${targetLang}. Same meaning, same length or shorter, natural for a native speaker, no new claims.`,
        user: c.shots[0].onScreenText,
        schema: z.object({ text: z.string() }),
        note: `dub title ${c.id} ${targetLang}`,
        maxTokens: 400,
        demo: () => ({ text: c.shots[0]!.onScreenText! }),
      },
    );
    title = { text: tr.value.text, t0: 0, t1: c.shots[0].durationSec };
  }
  const captions: CaptionTrack = {
    style: { ...style, sizePct: Math.max(7, style.sizePct), wordsPerCaption: Math.min(3, style.wordsPerCaption) },
    words: markEmphasis(stt.words, [brand.name]),
    regions: c.shots.map((s, i) => ({
      t0: starts[i]!,
      t1: starts[i]! + s.durationSec,
      region: s.captionRegion ?? style.position,
    })),
    title,
  };
  const shots = [];
  for (const s of c.shots) {
    const kf = s.keyframeAssetId ? await getAsset(db, s.keyframeAssetId) : null;
    const clip = s.clipAssetId ? await getAsset(db, s.clipAssetId) : null;
    shots.push({ src: kf!.url, clipSrc: clip?.url, durationSec: s.durationSec, captionRegion: s.captionRegion });
  }
  const out = path.join(dir, `flagship_${targetLang}_${Date.now().toString(36)}.mp4`);
  const r = await composeAd916(
    {
      shots,
      voiceoverSrc: fileToUrl(audio),
      brandName: brand.name,
      colors: brand.dossier.visual.colors,
      logoSrc: brand.dossier.visual.logoUrl,
      cta: c.cta,
      endCardSec: c.format === "static" ? 0.5 : 2,
      motionQuality: "final",
      captions,
    },
    out,
    `${out}.parts`,
  );
  const asset: Asset = {
    id: newId("asset"),
    brandId: c.brandId,
    conceptId: c.id,
    kind: "video",
    url: fileToUrl(r.file),
    provider: "elevenlabs",
    model: `ffmpeg-ad916-final-dub-${targetLang}`,
    costUsd: 0,
    width: r.width,
    height: r.height,
    durationSec: Math.round(r.durationSec * 100) / 100,
    demo: false,
    createdAt: nowIso(),
  };
  await upsertAsset(db, asset);
  await extractFrame(r.file, 1.2, `${r.file}.poster.jpg`, 720).catch(() => undefined);
  // 720p copy for the repo (docs/renders/<slug>-flagship-<lang>.mp4)
  const repoCopy = path.join(process.cwd(), "docs/renders", `${brand.slug}-flagship-${targetLang}.mp4`);
  await ffmpeg([
    "-y",
    "-i",
    r.file,
    "-vf",
    "scale=720:-2",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "26",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    repoCopy,
  ]);
  return { asset, repoCopy, words: stt.words.length, transcript: stt.text };
}
