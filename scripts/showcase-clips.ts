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
const { ttsWithTimestamps, scribe } = await import("@/engine/providers/elevenlabs");
const { brandVoice } = await import("@/engine/audio/voices");
const { generateImage } = await import("@/engine/providers/openai");
const { callProvider } = await import("@/engine/providers/call");
const { fetchRetry, okJson } = await import("@/engine/providers/http");
const { renderCaptionFrames, premiumStyle, markEmphasis } = await import("@/engine/video/captions");
const { watch } = await import("@/engine/providers/gemini");
const { z } = await import("zod");
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
    line: "If your dog panics when you leave, don't just let them cry it out. Practise tiny absences they can handle, and build up slowly, at their pace.",
    presenter:
      "a friendly young British woman in her late 20s sitting on her living room floor next to a calm beagle, talking to her phone's front camera",
    label: "Hound (EN-GB): dog owner talking to camera",
  },
  {
    id: "aclinic-talk",
    slug: "aclinic",
    line: "Weight care without the waiting room. A short health questionnaire, then a video consultation with a licensed doctor, and you see the full price before you pay.",
    presenter:
      "a calm, warm woman in her late 30s at a bright kitchen table at home, talking to her phone's front camera",
    label: "a.clinic (EN): talking to camera",
  },
  {
    id: "dynova-talk",
    slug: "dynova",
    line: "General advice is written for the average person. Your Dynova report comes from your own sample. It doesn't diagnose anything, it shows your tendencies.",
    presenter:
      "a warm Turkish woman in her early 30s with dark hair in a bright modern apartment, talking to her phone's front camera",
    label: "Dynova (EN): talking to camera",
  },
];

/** ElevenLabs talking head (Creatify Aurora via /v1/flows/video): the lips are driven by the given speech audio. */
async function auroraTalk(png: string, mp3: string, out: string, sec: number) {
  return callProvider(db, {
    provider: "elevenlabs",
    note: `talking head (creatify-aurora) ${path.basename(out)}`,
    estimateUsd: 0.1 * Math.ceil(sec),
    demo: () => null as string | null,
    live: async () => {
      const h = { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "content-type": "application/json" };
      const sub = await okJson<{ id: string }>(
        await fetchRetry("https://api.elevenlabs.io/v1/flows/video", {
          method: "POST",
          headers: h,
          body: JSON.stringify({
            model_id: "creatify-aurora",
            image: {
              type: "inline_base64",
              content_base64: fs.readFileSync(png).toString("base64"),
              mime_type: "image/png",
            },
            audio: {
              type: "inline_base64",
              content_base64: fs.readFileSync(mp3).toString("base64"),
              mime_type: "audio/mpeg",
            },
            resolution: "720p",
          }),
          timeoutMs: 120_000,
        }),
        "aurora submit",
      );
      for (const until = Date.now() + 10 * 60_000; ; ) {
        if (Date.now() > until) throw new Error("aurora timed out");
        await new Promise((r) => setTimeout(r, 5000));
        const st = await okJson<{ status: string; content_url?: string; error?: string }>(
          await fetchRetry(`https://api.elevenlabs.io/v1/flows/video/${sub.id}`, { headers: h }),
          "aurora status",
        );
        if (st.status === "completed" && st.content_url) {
          const v = await fetchRetry(st.content_url, { timeoutMs: 120_000 });
          fs.writeFileSync(out, Buffer.from(await v.arrayBuffer()));
          return { result: out, usd: 0.1 * Math.ceil(sec), units: `${sec.toFixed(1)}s aurora` };
        }
        if (st.status === "failed" || st.status === "error") throw new Error(`aurora ${st.error ?? st.status}`);
      }
    },
  });
}

/** fal Kling AI Avatar v2 Pro (fallback): lips driven by the same speech audio. */
async function klingTalk(png: string, mp3: string, out: string, sec: number) {
  return callProvider(db, {
    provider: "fal",
    note: `ai avatar pro ${path.basename(out)}`,
    estimateUsd: 0.2 * Math.ceil(sec),
    demo: () => null as string | null,
    live: async () => {
      const h = { Authorization: `Key ${process.env.FAL_KEY}`, "content-type": "application/json" };
      const sub = await okJson<{ status_url: string; response_url: string }>(
        await fetchRetry("https://queue.fal.run/fal-ai/kling-video/ai-avatar/v2/pro", {
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
      return { result: out, usd: 0.2 * Math.ceil(sec), units: `${sec.toFixed(1)}s avatar pro` };
    },
  });
}

const TalkCheck = z.object({
  lipSync: z.number(),
  personaMatchesVoice: z.boolean(),
  spokenMatchesCaptions: z.boolean(),
  natural: z.number(),
  issues: z.array(z.string()),
});

if (only !== "broll")
  for (const t of TALK.filter((x) => !process.argv.includes("--talk") || process.argv.includes(x.id))) {
    try {
      const brand = (await repo.listBrands(db)).find((b) => b.slug === t.slug)!;
      const voice = brandVoice(t.slug, "en") ?? brandVoice(t.slug, (brand.languages[0] ?? "en").slice(0, 2))!;
      // --recaption: reuse the lip-synced video and its exact audio; words from Scribe on that same audio
      const reMp3 = path.join(WORK, `${t.id}_en.mp3`);
      const reVid = [path.join(WORK, `${t.id}_aurora.mp4`), path.join(WORK, `${t.id}_klingpro.mp4`)].find((f) =>
        fs.existsSync(f),
      );
      if (process.argv.includes("--recaption") && fs.existsSync(reMp3) && reVid) {
        const dur0 = (await probe(reVid)).durationSec;
        const stt = await scribe(db, { file: reMp3, languageCode: "en", durationSec: dur0 });
        const pattern = await renderCaptionFrames(
          {
            style: premiumStyle(undefined, brand.dossier.visual.colors[0] ?? "#FFD60A"),
            words: markEmphasis(stt.words, [brand.name]),
            regions: [{ t0: 0, t1: dur0 + 1, region: "lower" }],
          },
          dur0,
          path.join(WORK, `${t.id}_caps`),
        );
        const cap = path.join(WORK, `${t.id}_final.mp4`);
        await ffmpeg([
          "-y",
          "-i",
          reVid,
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
          String(dur0),
          cap,
        ]);
        const files = await exportBoth(cap, t.id, Math.min(10, dur0), true);
        const prev = index.find((x) => x.id === t.id);
        save({
          ...(prev ?? { id: t.id, brand: t.slug, kind: "talking", language: "en", label: t.label, aiPresenter: true }),
          files,
          durationSec: Math.min(10, dur0),
        } as Item);
        continue;
      }
      // 1. audio first: the brand's voice speaks the script, with word timestamps
      const tts = await ttsWithTimestamps(db, {
        voiceId: voice.voiceId,
        text: t.line,
        modelId: voice.modelId,
        settings: voice.settings,
        note: `showcase ${t.id}`,
      });
      if (!tts.mp3) throw new Error("no voice");
      const mp3 = path.join(WORK, `${t.id}_en.mp3`);
      fs.writeFileSync(mp3, tts.mp3);
      // 2. a presenter that matches the voice (persona), then the lips are driven FROM that audio
      const img = await generateImage(
        db,
        `Photoreal vertical phone video frame: ${t.presenter}. Shot on an iPhone front camera, natural window light, candid, real home, true-to-life skin, mouth closed and relaxed, looking into the lens, head and shoulders, centred, no text, no logos.`,
        { quality: "high", demo: async () => Buffer.alloc(0) },
      );
      const png = path.join(WORK, `${t.id}_en.png`);
      await sharp(img.png).resize(720, 1280, { fit: "cover" }).png().toFile(png);
      const sec = tts.durationSec + 0.4;
      let tool = "elevenlabs creatify-aurora";
      let out = path.join(WORK, `${t.id}_aurora.mp4`);
      const a = await auroraTalk(png, mp3, out, sec).catch((e) => {
        console.log("aurora failed", t.id, String(e).slice(0, 200));
        return null;
      });
      if (!a?.value || !fs.existsSync(out)) {
        tool = "fal kling ai-avatar v2 pro";
        out = path.join(WORK, `${t.id}_klingpro.mp4`);
        await klingTalk(png, mp3, out, sec);
      }
      // 3. captions = the spoken words, timed from the ElevenLabs word timestamps
      const dur = (await probe(out)).durationSec;
      const pattern = await renderCaptionFrames(
        {
          style: premiumStyle(undefined, brand.dossier.visual.colors[0] ?? "#FFD60A"),
          words: markEmphasis(tts.words, [brand.name]),
          regions: [{ t0: 0, t1: dur + 1, region: "lower" }],
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
      // 4. Gemini watches it with sound: lip sync, persona = voice, captions = words
      const w = await watch(db, {
        file: cap,
        schema: TalkCheck,
        fps: 4,
        note: `talking-head check ${t.id}`,
        prompt: `Watch this short talking-head clip WITH sound. Script: "${t.line}". Voice: ${voice.name} (${voice.persona}). Score lipSync 0-100 (do the lips match the spoken words exactly, no drift), natural 0-100 (looks like a real person filming herself), personaMatchesVoice (gender, age, accent and look fit the voice), spokenMatchesCaptions (captions show the spoken words). issues: what is wrong.`,
        demo: () => ({
          lipSync: 0,
          personaMatchesVoice: true,
          spokenMatchesCaptions: true,
          natural: 0,
          issues: ["demo"],
        }),
      }).catch(() => null);
      console.log("check", t.id, tool, JSON.stringify(w?.value));
      if (w?.value && (w.value.lipSync < 60 || !w.value.personaMatchesVoice))
        console.log("REJECTED by the watcher:", t.id);
      const files = await exportBoth(cap, t.id, Math.min(10, dur), true);
      save({
        id: t.id,
        brand: t.slug,
        kind: "talking",
        language: "en",
        label: `${t.label} (AI-generated presenter, lip-synced by ${tool})`,
        aiPresenter: true,
        files,
        durationSec: Math.min(10, dur),
      });
    } catch (e) {
      console.log("talk failed", t.id, e instanceof Error ? e.message : e);
    }
  }
process.exit(0);
