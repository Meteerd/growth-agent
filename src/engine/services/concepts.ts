import fs from "node:fs";
import path from "node:path";
import type { Asset, Concept, RenderTier, RunEvent } from "@/contracts";
import type { Db } from "../db/client";
import { HttpError } from "../http";
import { newId, nowIso } from "../ids";
import { animateShot } from "../providers/motion";
import { generateImage, speak } from "../providers/openai";
import { renderEstimate } from "../providers/prices";
import {
  appendEvent,
  getAsset,
  getBrand,
  getConcept,
  listAssets,
  listPacksByRun,
  upsertAsset,
  upsertConcept,
  upsertPack,
} from "../repo";
import { fileToUrl, urlToFile } from "../video/files";
import { demoKeyframe, SAFE_AREA, toFrame916, writeAsset } from "../video/keyframes";
import { renderAd } from "../video/render";

type Emit = (
  type: RunEvent["type"],
  title: string,
  extra?: Partial<Pick<RunEvent, "detail" | "refId" | "costUsd" | "data">>,
) => Promise<unknown>;

const isVideo = (c: Concept) => !["text_post"].includes(c.format) && c.shots.length > 0;

function emitter(db: Db, c: Concept, phase: RunEvent["phase"], emit?: Emit): Emit {
  return emit ?? ((type, title, extra = {}) => appendEvent(db, { runId: c.runId, phase, type, title, ...extra }));
}

/** Generate (or regenerate) keyframes: OpenAI image when live, otherwise an on-brand demo frame. */
export async function generateKeyframes(
  db: Db,
  conceptId: string,
  o: { shotIdx?: number; runId?: string; emit?: Emit; reason?: string } = {},
): Promise<Concept> {
  const c = await getConcept(db, conceptId);
  if (!c) throw new HttpError(404, "not_found", "Concept not found");
  if (c.compliance === "fail")
    throw new HttpError(409, "compliance_failed", "Concept failed compliance; fix it before generating keyframes");
  const brand = await getBrand(db, c.brandId);
  if (!brand) throw new HttpError(404, "not_found", "Brand not found");
  const emit = emitter(db, c, "production", o.emit);
  const shots = [...c.shots];
  const targets = o.shotIdx !== undefined ? shots.filter((s) => s.idx === o.shotIdx) : shots;
  if (o.shotIdx !== undefined && !targets.length) throw new HttpError(400, "bad_shot", `No shot ${o.shotIdx}`);
  // up to 3 images at once (each live image takes ~30 s)
  const one = async (s: (typeof targets)[number]) => {
    const style = brand.dossier.visual.styleNotes ? ` Style: ${brand.dossier.visual.styleNotes}` : "";
    const prompt = `${s.visualPrompt}.${style} Vertical 9:16, no text, no logos, no watermarks. ${SAFE_AREA}`;
    const img = await generateImage(db, prompt, { runId: c.runId, demo: () => demoKeyframe(brand, s) });
    const n = `${Date.now().toString(36)}${s.idx}`;
    const file = writeAsset(path.join("runs", c.runId, c.id, `kf_${s.idx}_${n}.png`), await toFrame916(img.png));
    const asset: Asset = {
      id: newId("asset"),
      brandId: c.brandId,
      conceptId: c.id,
      kind: "keyframe",
      url: fileToUrl(file),
      provider: img.mode === "live" ? "openai" : "local",
      model: img.model,
      costUsd: img.usd,
      width: 1080,
      height: 1920,
      demo: img.mode === "demo",
      createdAt: nowIso(),
      shotIdx: s.idx,
    };
    await upsertAsset(db, asset);
    shots[s.idx] = { ...s, keyframeAssetId: asset.id, approved: false };
    await emit(
      "asset",
      `Keyframe ${s.idx + 1}/${shots.length}${img.mode === "demo" ? " (demo)" : ""}${o.reason ? `: ${o.reason}` : ""}`,
      {
        refId: asset.id,
        costUsd: img.usd || undefined,
        data: { conceptId: c.id, shotIdx: s.idx, url: asset.url },
      },
    );
  };
  const queue = [...targets];
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) await one(s);
    }),
  );
  const next: Concept = {
    ...c,
    shots,
    status:
      c.status === "draft" || c.status === "failed" ? "keyframes" : c.status === "rendered" ? "keyframes" : c.status,
  };
  await upsertConcept(db, next);
  return next;
}

export async function approveShots(db: Db, conceptId: string, shotIdx: number[]): Promise<Concept> {
  const c = await getConcept(db, conceptId);
  if (!c) throw new HttpError(404, "not_found", "Concept not found");
  const set = new Set(shotIdx);
  const shots = c.shots.map((s) => (set.has(s.idx) ? { ...s, approved: true } : s));
  const all = shots.every((s) => s.approved);
  const next: Concept = { ...c, shots, status: all && c.status === "keyframes" ? "approved" : c.status };
  await upsertConcept(db, next);
  return next;
}

/** Cost before render: missing keyframes + image-to-video seconds (final tier only uses fal) + voiceover. */
export function estimateRender(c: Concept, tier: RenderTier) {
  const missing = c.shots.filter((s) => !s.keyframeAssetId).length;
  const est = renderEstimate(
    c.shots,
    tier,
    c.shots.some((s) => s.voiceover),
  );
  const kfLine = est.lines[0];
  const perKf = c.shots.length ? kfLine.usd / c.shots.length : 0;
  const lines = [
    { ...kfLine, item: `${missing} new keyframes`, usd: Math.round(perKf * missing * 100) / 100 },
    tier === "final"
      ? est.lines[1]
      : { ...est.lines[1], item: `${est.lines[1].item}: not used in draft (Ken Burns on keyframes)`, usd: 0 },
    est.lines[2],
  ];
  return { totalUsd: Math.round(lines.reduce((a, l) => a + l.usd, 0) * 100) / 100, lines };
}

/** Render a concept to MP4 (keyframes + motion + captions + voiceover + end card). */
export async function renderConcept(
  db: Db,
  conceptId: string,
  tier: RenderTier,
  o: { emit?: Emit; label?: string; phase?: RunEvent["phase"] } = {},
): Promise<{ concept: Concept; asset: Asset }> {
  let c = await getConcept(db, conceptId);
  if (!c) throw new HttpError(404, "not_found", "Concept not found");
  if (c.compliance === "fail")
    throw new HttpError(409, "compliance_failed", "Rendering is blocked: the concept failed compliance");
  if (!isVideo(c)) throw new HttpError(400, "not_video", "This concept has no shots to render");
  const brand = (await getBrand(db, c.brandId))!;
  const emit = emitter(db, c, o.phase ?? "production", o.emit);
  // a frame or clip whose file is not on this machine (e.g. an imported showcase run) counts as missing
  const onDisk = async (id?: string) => {
    const a = id ? await getAsset(db, id) : null;
    const f = a ? urlToFile(a.url) : null;
    return !!f && fs.existsSync(f);
  };
  const healed = await Promise.all(
    c.shots.map(async (s) => ({
      ...s,
      keyframeAssetId: (await onDisk(s.keyframeAssetId)) ? s.keyframeAssetId : undefined,
      clipAssetId: (await onDisk(s.clipAssetId)) ? s.clipAssetId : undefined,
    })),
  );
  const lost = healed.filter((s, i) => s.keyframeAssetId !== c!.shots[i]!.keyframeAssetId).length;
  const lostClips = healed.filter((s, i) => s.clipAssetId !== c!.shots[i]!.clipAssetId).length;
  if (lost || lostClips) {
    c = { ...c, shots: healed };
    await upsertConcept(db, c);
    await emit("warning", `${lost} frame(s) and ${lostClips} clip(s) are not on this machine: rebuilding them`, {
      refId: c.id,
    });
  }
  // only the shots without a frame get one (never overwrite frames that exist)
  for (const s of c.shots.filter((x) => !x.keyframeAssetId))
    c = await generateKeyframes(db, c.id, { emit, shotIdx: s.idx });
  await upsertConcept(db, { ...c, status: "rendering" });
  await emit("log", `Rendering ${c.title} (${tier})`, { refId: c.id });
  try {
    const n = Date.now().toString(36);
    const dir = path.join("runs", c.runId, c.id);
    // voiceover
    const voText = c.shots
      .map((s) => s.voiceover)
      .filter(Boolean)
      .join(" ");
    let voiceoverSrc: string | undefined;
    if (voText) {
      const vo = await speak(db, voText, { runId: c.runId, demo: async () => null });
      if (vo.mp3) {
        const f = writeAsset(path.join(dir, `vo_${n}.mp3`), vo.mp3);
        voiceoverSrc = fileToUrl(f);
        await upsertAsset(db, {
          id: newId("asset"),
          brandId: c.brandId,
          conceptId: c.id,
          kind: "voice",
          url: voiceoverSrc,
          provider: "openai",
          model: "tts",
          costUsd: vo.usd,
          demo: false,
          createdAt: nowIso(),
        });
      }
    }
    // final tier: animate each keyframe with fal (live only; demo keeps Ken Burns on the stills)
    if (tier === "final") {
      const updated = [...c.shots];
      const cur = c;
      const animate = async (s: (typeof cur.shots)[number]) => {
        if (s.clipAssetId) return;
        const kf = s.keyframeAssetId ? await getAsset(db, s.keyframeAssetId) : null;
        const kfFile = kf ? urlToFile(kf.url) : null;
        if (!kfFile) return;
        const outClip = path.resolve(process.env.ASSETS_DIR || "data/assets", dir, `clip_${s.idx}_${n}.mp4`);
        fs.mkdirSync(path.dirname(outClip), { recursive: true });
        const r = await animateShot(db, {
          imageFile: kfFile,
          prompt: s.motion
            ? `${s.motion}. Natural, physically plausible motion, real camera feel, no text, no morphing.`
            : `${s.visualPrompt}. Subtle natural motion, gentle camera push-in, no text.`,
          durationSec: s.durationSec,
          out: outClip,
          runId: cur.runId,
          onFallback: async (why) => {
            await emit("warning", `Shot ${s.idx + 1}: fal unavailable, trying Higgsfield`, { detail: why });
          },
        }).catch(async (e) => {
          await emit("warning", `Clip for shot ${s.idx + 1} failed; using the still`, {
            detail: e instanceof Error ? e.message : String(e),
          });
          return null;
        });
        if (!r?.file) return;
        const clip: Asset = {
          id: newId("asset"),
          brandId: cur.brandId,
          conceptId: cur.id,
          kind: "clip",
          url: fileToUrl(r.file),
          provider: r.provider,
          model: r.model,
          costUsd: r.usd,
          width: 1080,
          height: 1920,
          durationSec: s.durationSec,
          demo: false,
          createdAt: nowIso(),
          shotIdx: s.idx,
        };
        await upsertAsset(db, clip);
        updated[s.idx] = { ...s, clipAssetId: clip.id };
        await emit("asset", `Clip ${s.idx + 1}/${cur.shots.length} animated (${r.provider})`, {
          refId: clip.id,
          costUsd: r.usd,
          data: { conceptId: cur.id, shotIdx: s.idx, url: clip.url, kind: "clip" },
        });
      };
      // 3 clips at a time (each takes ~70 s at fal)
      // screens and inserts stay stills: animating a phone screen makes its content morph
      const todo = cur.shots.filter(
        (s) => !s.clipAssetId && s.style !== "screen" && !(s.source === "generated" && s.imageRef),
      );
      await Promise.all(
        Array.from({ length: Math.min(3, todo.length) }, async () => {
          for (let s = todo.shift(); s; s = todo.shift()) await animate(s);
        }),
      );
      c = { ...c, shots: updated };
      await upsertConcept(db, { ...c, status: "rendering" });
    }
    const shots = [];
    for (const s of c.shots) {
      const a = s.keyframeAssetId ? await getAsset(db, s.keyframeAssetId) : null;
      if (!a || !urlToFile(a.url) || !fs.existsSync(urlToFile(a.url)!))
        throw new Error(`keyframe missing for shot ${s.idx + 1}`);
      const clip = s.clipAssetId ? await getAsset(db, s.clipAssetId) : null;
      shots.push({ src: a.url, clipSrc: clip?.url, durationSec: s.durationSec, text: s.onScreenText });
    }
    const demo =
      shots.length > 0 &&
      (await Promise.all(c.shots.map((s) => getAsset(db, s.keyframeAssetId!)))).some((a) => a?.demo);
    const outFile = path.resolve(process.env.ASSETS_DIR || "data/assets", dir, `${o.label ?? tier}_${n}.mp4`);
    const r = await renderAd(
      {
        shots,
        voiceoverSrc,
        brandName: brand.name,
        colors: brand.dossier.visual.colors,
        logoSrc: brand.dossier.visual.logoUrl,
        cta: c.cta,
        badge: demo ? "Demo render" : undefined,
        endCardSec: c.format === "static" ? 0.5 : 2,
      },
      outFile,
    );
    const asset: Asset = {
      id: newId("asset"),
      brandId: c.brandId,
      conceptId: c.id,
      kind: "video",
      url: fileToUrl(r.file),
      provider: "local",
      model: `${r.renderer}-ad916-${tier}`,
      costUsd: 0,
      width: r.width,
      height: r.height,
      durationSec: Math.round(r.durationSec * 100) / 100,
      demo,
      createdAt: nowIso(),
    };
    await upsertAsset(db, asset);
    const next: Concept = { ...((await getConcept(db, c.id)) ?? c), status: "rendered", videoAssetId: asset.id };
    await upsertConcept(db, next);
    // packs of this concept that are not posted yet carry the newest video
    for (const p of (await listPacksByRun(db, next.runId)).filter(
      (x) => x.conceptId === next.id && x.status === "ready",
    )) {
      await upsertPack(db, { ...p, videoAssetId: asset.id });
    }
    await emit(
      "asset",
      `Video rendered: ${asset.durationSec}s ${asset.width}x${asset.height}${demo ? " (demo)" : ""}`,
      { refId: asset.id, data: { conceptId: c.id, url: asset.url, kind: "video" } },
    );
    return { concept: next, asset };
  } catch (e) {
    await upsertConcept(db, { ...((await getConcept(db, c.id)) ?? c), status: "failed" });
    await emit("error", `Render failed: ${e instanceof Error ? e.message : String(e)}`, { refId: c.id });
    throw e;
  }
}

export async function conceptAssets(db: Db, conceptId: string) {
  return listAssets(db, conceptId);
}
