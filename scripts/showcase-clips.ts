/**
 * pnpm showcase-clips [--only talk|broll]
 * Landing-page video wall (Mete, 12 Oct): short clips (4 to 8 s) in 9:16 and 16:9, 720p, with posters, in
 * public/showcase/. Talking clips: the brand's cast ElevenLabs voice + a fictional photoreal presenter animated
 * with fal Kling AI Avatar (lip sync), live captions from the word timestamps (labelled AI-generated in the list).
 * B-roll: real-motion clips from the flagships. Writes public/showcase/index.json.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";

loadEnv();
process.env.NEXUS_FORCE_LIVE = "fal,elevenlabs,openai";
const { getDb } = await import("@/engine/db/client");
const repo = await import("@/engine/repo");
const { ffmpeg, probe, extractFrame } = await import("@/engine/media/ffmpeg");
const { ttsWithTimestamps } = await import("@/engine/providers/elevenlabs");
const { brandVoice } = await import("@/engine/audio/voices");
const { generateImage } = await import("@/engine/providers/openai");
const { callProvider } = await import("@/engine/providers/call");
const { fetchRetry, okJson } = await import("@/engine/providers/http");
const { renderCaptionFrames, HORMOZI, markEmphasis } = await import("@/engine/video/captions");
const { urlToFile } = await import("@/engine/video/files");
const sharp = (await import("sharp")).default;

const OUT = path.resolve("public/showcase");
const WORK = path.resolve("data/assets/showcase-work");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });
const db = await getDb();
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;

interface Item {
  id: string;
  brand: string;
  kind: "talking" | "broll";
  language?: string;
  label: string;
  aiPresenter?: boolean;
  files: { vertical: string; landscape: string; poster: string; posterLandscape: string };
  durationSec: number;
}
const indexFile = path.join(OUT, "index.json");
const index: Item[] = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : [];
const save = (it: Item) => {
  const i = index.findIndex((x) => x.id === it.id);
  if (i >= 0) index[i] = it;
  else index.push(it);
  fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
  console.log("landed", it.id, it.durationSec, "s");
};

/** 9:16 and 16:9 720p versions (16:9 = the 9:16 frame over a blurred fill), small files, + posters. */
async function exportBoth(src: string, id: string, seconds: number, keepAudio: boolean) {
  const v = path.join(OUT, `${id}-916.mp4`);
  const l = path.join(OUT, `${id}-169.mp4`);
  const a = keepAudio ? ["-c:a", "aac", "-b:a", "96k"] : ["-an"];
  await ffmpeg([
    "-y",
    "-i",
    src,
    "-t",
    String(seconds),
    "-vf",
    "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "27",
    ...a,
    "-movflags",
    "+faststart",
    v,
  ]);
  await ffmpeg([
    "-y",
    "-i",
    src,
    "-t",
    String(seconds),
    "-filter_complex",
    "[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,boxblur=20:2,eq=brightness=-0.12[bg];[0:v]scale=-2:720[fg];[bg][fg]overlay=(W-w)/2:0,fps=30,format=yuv420p[v]",
    "-map",
    "[v]",
    ...(keepAudio ? ["-map", "0:a?"] : []),
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "27",
    ...a,
    "-movflags",
    "+faststart",
    l,
  ]);
  const p = path.join(OUT, `${id}-916.jpg`);
  const pl = path.join(OUT, `${id}-169.jpg`);
  await extractFrame(v, Math.min(1.2, seconds / 2), p, 720);
  await extractFrame(l, Math.min(1.2, seconds / 2), pl, 1280);
  const rel = (f: string) => `/showcase/${path.basename(f)}`;
  return { vertical: rel(v), landscape: rel(l), poster: rel(p), posterLandscape: rel(pl) };
}

// ---------------------------------------------------------------- b-roll from the flagships
const BROLL: { id: string; concept: string; shot: number; label: string }[] = [
  { id: "hound-door", concept: "concept_1d68be0a_1", shot: 0, label: "Hound: beagle waiting at the door" },
  { id: "hound-chew", concept: "concept_1d68be0a_1", shot: 3, label: "Hound: practice alone time with a chew toy" },
  { id: "hound-keys", concept: "concept_1d68be0a_1", shot: 2, label: "Hound: keys in hand, dog watching" },
  { id: "aclinic-home", concept: "concept_1e6575ad_1", shot: 0, label: "a.clinic: weight care from home" },
  { id: "aclinic-steps", concept: "concept_1e6575ad_1", shot: 2, label: "a.clinic: questionnaire and video consult" },
  { id: "dynova-lab", concept: "concept_91d09027_1", shot: 2, label: "Dynova: sample analysed in the lab" },
  { id: "dynova-kit", concept: "concept_91d09027_1", shot: 4, label: "Dynova: routine from your own data" },
  { id: "evreon-paper", concept: "concept_f352d515_1", shot: 2, label: "Evreon: referrals still waiting to be read" },
];
if (only !== "talk")
  for (const b of BROLL) {
    const c = await repo.getConcept(db, b.concept);
    const s = c?.shots[b.shot];
    const clip = s?.clipAssetId ? await repo.getAsset(db, s.clipAssetId) : null;
    let f = clip ? urlToFile(clip.url) : null;
    if (f && fs.existsSync(`${f}.stab.mp4`)) f = `${f}.stab.mp4`;
    if (!f || !fs.existsSync(f) || clip?.model?.startsWith("playwright")) {
      console.log("skip (no real clip yet)", b.id);
      continue;
    }
    const sec = Math.min(6, Math.max(4, (await probe(f)).durationSec - 0.2));
    const files = await exportBoth(f, b.id, sec, false);
    save({ id: b.id, brand: c!.brandId.replace("brand_", ""), kind: "broll", label: b.label, files, durationSec: sec });
  }

// ---------------------------------------------------------------- talking presenters (lip sync)
const TALK: { id: string; slug: string; line: string; presenter: string; label: string }[] = [
  {
    id: "hound-talk",
    slug: "hound",
    line: "Tiny absences your dog can handle, then build up slowly. That's the whole trick.",
    presenter:
      "a friendly British woman in her early 30s sitting on her living room floor next to a calm beagle, talking to the phone camera",
    label: "Hound (EN-GB): dog owner talking to camera",
  },
  {
    id: "aclinic-talk",
    slug: "aclinic",
    line: "Celú cenu vidíš ešte pred platbou a zrušiť môžeš kedykoľvek.",
    presenter: "a calm Slovak woman in her late 30s at a bright kitchen table at home, talking to the phone camera",
    label: "a.clinic (SK): talking to camera",
  },
  {
    id: "dynova-talk",
    slug: "dynova",
    line: "Rapor teşhis koymaz; genetik eğilimlerini bilgi olarak gösterir.",
    presenter: "a warm Turkish woman in her early 30s in a bright modern apartment, talking to the phone camera",
    label: "Dynova (TR): talking to camera",
  },
  {
    id: "evreon-talk",
    slug: "evreon",
    line: "Referrals, discharge letters, results from abroad. Someone still has to read and file them.",
    presenter:
      "a British clinic practice manager in his 40s at a desk with paper folders in a small GP practice office, talking to the camera",
    label: "Evreon (EN-GB): practice manager talking to camera",
  },
];
const AVATAR = process.env.FAL_AVATAR_MODEL || "fal-ai/kling-video/ai-avatar/v2/standard";
if (only !== "broll")
  for (const t of TALK) {
    try {
      const brand = (await repo.listBrands(db)).find((b) => b.slug === t.slug)!;
      const lang = (brand.languages[0] ?? "en").slice(0, 2);
      const voice = brandVoice(t.slug, lang)!;
      const tts = await ttsWithTimestamps(db, {
        voiceId: voice.voiceId,
        text: t.line,
        modelId: voice.modelId,
        settings: voice.settings,
        note: `showcase ${t.id}`,
      });
      if (!tts.mp3) throw new Error("no voice");
      const mp3 = path.join(WORK, `${t.id}.mp3`);
      fs.writeFileSync(mp3, tts.mp3);
      const img = await generateImage(
        db,
        `Photoreal vertical phone video frame: ${t.presenter}. Shot on an iPhone front camera, natural window light, candid, real home, true-to-life skin, mouth closed and relaxed, looking into the lens, head and shoulders, centred, no text, no logos.`,
        { quality: "high", demo: async () => Buffer.alloc(0) },
      );
      const png = path.join(WORK, `${t.id}.png`);
      await sharp(img.png).resize(720, 1280, { fit: "cover" }).png().toFile(png);
      const out = path.join(WORK, `${t.id}_avatar.mp4`);
      const sec = tts.durationSec + 0.4;
      await callProvider(db, {
        provider: "fal",
        note: `ai avatar ${t.id}`,
        estimateUsd: 0.12 * Math.ceil(sec),
        demo: () => null,
        live: async () => {
          const h = { Authorization: `Key ${process.env.FAL_KEY}`, "content-type": "application/json" };
          const sub = await okJson<{ status_url: string; response_url: string }>(
            await fetchRetry(`https://queue.fal.run/${AVATAR}`, {
              method: "POST",
              headers: h,
              body: JSON.stringify({
                image_url: `data:image/jpeg;base64,${(await sharp(png).jpeg({ quality: 90 }).toBuffer()).toString("base64")}`,
                audio_url: `data:audio/mpeg;base64,${fs.readFileSync(mp3).toString("base64")}`,
                prompt: "natural, warm, small natural head movements, real phone video",
              }),
              timeoutMs: 60_000,
            }),
            "fal avatar submit",
          );
          for (const until = Date.now() + 12 * 60_000; ; ) {
            if (Date.now() > until) throw new Error("avatar timed out");
            await new Promise((r) => setTimeout(r, 5000));
            const st = await okJson<{ status: string }>(await fetchRetry(sub.status_url, { headers: h }), "fal status");
            if (st.status === "COMPLETED") break;
            if (st.status === "FAILED" || st.status === "ERROR") throw new Error(`fal avatar ${st.status}`);
          }
          const res = await okJson<{ video?: { url?: string } }>(
            await fetchRetry(sub.response_url, { headers: h }),
            "fal result",
          );
          const vid = await fetchRetry(res.video!.url!, { timeoutMs: 120_000 });
          fs.writeFileSync(out, Buffer.from(await vid.arrayBuffer()));
          return { result: out, usd: 0.12 * Math.ceil(sec), units: `${sec.toFixed(1)}s avatar` };
        },
      });
      if (!fs.existsSync(out)) throw new Error("avatar not live");
      // live captions from the voice's word timestamps over the lip-synced video
      const dur = (await probe(out)).durationSec;
      const pattern = await renderCaptionFrames(
        {
          style: { ...HORMOZI, position: "lower", sizePct: 8 },
          words: markEmphasis(tts.words, [brand.name]),
          regions: [],
        },
        dur,
        path.join(WORK, `${t.id}_caps`),
      );
      const cap = path.join(WORK, `${t.id}_final.mp4`);
      await ffmpeg([
        "-y",
        "-i",
        out,
        "-framerate",
        "30",
        "-i",
        pattern,
        "-filter_complex",
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30[b];[1:v]format=rgba[c];[b][c]overlay=0:0:eof_action=pass,format=yuv420p[v]",
        "-map",
        "[v]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-t",
        String(dur),
        cap,
      ]);
      const files = await exportBoth(cap, t.id, Math.min(8, dur), true);
      save({
        id: t.id,
        brand: t.slug,
        kind: "talking",
        language: lang,
        label: `${t.label} (AI-generated presenter, lip-synced)`,
        aiPresenter: true,
        files,
        durationSec: Math.min(8, dur),
      });
    } catch (e) {
      console.log("talk failed", t.id, e instanceof Error ? e.message : e);
    }
  }
process.exit(0);
