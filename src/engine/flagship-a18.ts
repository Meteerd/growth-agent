import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import type { Asset, Concept, Review } from "@/contracts";
import { type BetaContentBlockParam, structured } from "./agent/claude";
import { makeCtx } from "./agent/context";
import { priorScores, reviewRender } from "./agent/phases/review";
import type { Db } from "./db/client";
import { contactSheet, keyframeFor } from "./flagship";
import { HttpError } from "./http";
import { newId, nowIso } from "./ids";
import { extractFrame } from "./media/ffmpeg";
import {
  appendEvent,
  getAsset,
  getBlueprint,
  getBrand,
  getConcept,
  getRun,
  upsertAsset,
  upsertConcept,
  upsertReview,
} from "./repo";
import { renderConcept } from "./services/concepts";
import { fileToUrl, urlToFile } from "./video/files";
import { recordSite } from "./video/screen";

/**
 * A18 flagship pass: ElevenLabs soundtrack (cast voice, music bed, SFX, live captions in the winner's text style),
 * a real fal clip for every shot, then Claude (frames) and Gemini (whole video with sound) review it; weak shots
 * get new motion (or a new frame for AI tells) and the cut is rendered again. The best-scoring cut is kept.
 */
const Regions = z.object({
  shots: z.array(z.object({ idx: z.number(), region: z.enum(["upper", "middle", "lower"]), why: z.string() })),
});

/**
 * Where the captions go in each shot: Claude looks at a frame of every shot and picks the third (upper, middle,
 * lower) that keeps faces, the dog, hands and the product clear, preferring the winner's position when it is free.
 */
export async function chooseCaptionRegions(db: Db, c: Concept, preferred: "upper" | "middle" | "lower") {
  const content: BetaContentBlockParam[] = [
    {
      type: "text",
      text: `For each shot of this vertical 9:16 ad, pick where the live captions (a block about 250 px tall in a 1920 px frame, centred horizontally) should sit: "upper" = 22-38% of the height from the top, "middle" = 44-60%, "lower" = 62-78% (above the bottom 20% platform UI). Check the whole band, not just its centre: no part of a head, ear or face may be inside the chosen band. The caption must never cover a face (human or animal), eyes, hands doing the action, the product or a phone screen. Prefer "${preferred}" (the winner's position) when it is clear. One answer per shot.`,
    },
  ];
  for (const s of c.shots) {
    const clip = s.clipAssetId ? await getAsset(db, s.clipAssetId) : null;
    const kf = s.keyframeAssetId ? await getAsset(db, s.keyframeAssetId) : null;
    const src = clip ? urlToFile(clip.url) : kf ? urlToFile(kf.url) : null;
    if (!src || !fs.existsSync(src)) continue;
    const out = path.resolve(process.env.ASSETS_DIR || "data/assets", "tmp", `region_${c.id}_${s.idx}.jpg`);
    const img = clip ? await extractFrame(src, 1.0, out, 360) : src;
    const buf = await sharp(img).resize(360, 640, { fit: "cover" }).jpeg({ quality: 75 }).toBuffer();
    content.push({ type: "text", text: `Shot ${s.idx}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } });
  }
  const r = await structured(
    { db, runId: c.runId, phase: "production" },
    {
      route: "vision",
      system: "You place captions on short vertical ads so they never cover faces or the subject.",
      user: content,
      schema: Regions,
      note: `caption regions ${c.id}`,
      maxTokens: 2000,
      demo: () => ({ shots: c.shots.map((s) => ({ idx: s.idx, region: preferred, why: "demo" })) }),
    },
  );
  // a region the operator pinned stays
  const next = c.shots.map((s) =>
    s.captionRegionLocked
      ? s
      : { ...s, captionRegion: r.value.shots.find((x) => x.idx === s.idx)?.region ?? s.captionRegion },
  );
  await upsertConcept(db, { ...c, shots: next });
  return r.value.shots;
}

export interface A18Options {
  mode: "voice_led" | "picture_locked";
  /** the CTA shot becomes a real screen recording of the brand's site on a phone viewport */
  screenCta?: { url?: string; scrollPx?: number; startY?: number };
  animateAll: boolean;
  rounds: number;
  sheetPath?: string;
}

const FRAME_ISSUE =
  /warp|morph|extra (finger|limb|paw)|garbled|plastic|ai tell|face|anatomy|deform|text on|unreadable screen/i;

export async function buildA18(db: Db, conceptId: string, o: A18Options) {
  let c = await getConcept(db, conceptId);
  if (!c) throw new HttpError(404, "not_found", "Concept not found");
  const brand = (await getBrand(db, c.brandId))!;
  const bp = c.blueprintId ? await getBlueprint(db, c.blueprintId) : null;
  const run = (await getRun(db, c.runId))!;
  const ctx = (await makeCtx(db, run.id, new AbortController().signal)).forPhase("review");
  const reviews: Review[] = [];
  let best: { asset: Asset; review: Review; shots: Concept["shots"] } | null = null;
  let last: { review: Review; shots: Concept["shots"] } | undefined;
  if (o.screenCta) {
    const last = c.shots.at(-1)!;
    const url = o.screenCta.url ?? brand.url;
    const out = path.resolve(
      process.env.ASSETS_DIR || "data/assets",
      "runs",
      c.runId,
      c.id,
      `screen_cta_${Date.now().toString(36)}.mp4`,
    );
    // long enough for a voice-led re-time of the line
    await recordSite(url, out, {
      seconds: Math.max(5, last.durationSec + 1.5),
      scrollPx: o.screenCta.scrollPx ?? 260,
      startY: o.screenCta.startY,
      language: c.language,
    });
    const clip: Asset = {
      id: newId("asset"),
      brandId: c.brandId,
      conceptId: c.id,
      kind: "clip",
      url: fileToUrl(out),
      provider: "local",
      model: `playwright-screen ${url}`,
      costUsd: 0,
      width: 1080,
      height: 1920,
      durationSec: Math.max(5, last.durationSec + 1.5),
      demo: false,
      createdAt: nowIso(),
      shotIdx: last.idx,
    };
    await upsertAsset(db, clip);
    c = {
      ...c,
      shots: c.shots.map((s) => (s.idx === last.idx ? { ...s, clipAssetId: clip.id, style: "screen" as const } : s)),
    };
    await upsertConcept(db, c);
    await appendEvent(db, {
      runId: c.runId,
      phase: "production",
      type: "asset",
      title: `CTA shot: real screen recording of ${url}`,
      refId: clip.id,
      data: { conceptId: c.id, shotIdx: last.idx, url: clip.url, kind: "clip" },
    });
  }
  for (let round = 1; round <= o.rounds; round++) {
    // captions keep faces and the subject clear (frames change when shots are regenerated)
    const regions = await chooseCaptionRegions(db, c, bp?.captionStyle?.position ?? "middle").catch(() => null);
    if (regions) c = (await getConcept(db, c.id))!;
    let asset = (
      await renderConcept(db, c.id, "final", {
        label: `flagship_a18_r${round}`,
        soundtrack: o.mode,
        animateAll: o.animateAll,
      })
    ).asset;
    asset = { ...asset, model: `${asset.model}-flagship` };
    await upsertAsset(db, asset);
    c = (await getConcept(db, c.id))!;
    const rv = await reviewRender(
      ctx,
      c,
      bp,
      asset.id,
      round,
      [],
      priorScores(last?.review, last?.shots ?? [], c.shots),
    );
    rv.round = round;
    const weak = rv.perShot.filter((p) => p.score < 80);
    rv.decision = (weak.length || rv.overall < 80) && round < o.rounds ? "regenerate" : "accept";
    if (rv.decision === "regenerate") rv.regeneratedShots = weak.map((w) => w.idx);
    await upsertReview(db, rv);
    reviews.push(rv);
    await appendEvent(db, {
      runId: c.runId,
      phase: "review",
      type: "review",
      title: `Flagship A18 round ${round}: ${rv.overall}/100, ${rv.decision}`,
      refId: rv.id,
      detail: rv.notes,
      data: { conceptId: c.id, round, perShot: rv.perShot },
    });
    const minShot = (r: Review) => Math.min(...r.perShot.map((p) => p.score));
    if (
      !best ||
      rv.overall > best.review.overall ||
      (rv.overall === best.review.overall && minShot(rv) > minShot(best.review))
    )
      best = { asset, review: rv, shots: c.shots.map((s) => ({ ...s })) };
    last = { review: rv, shots: c.shots };
    if (rv.decision === "accept") break;
    // weak shots: new motion; AI tells on a generated frame get a new frame too
    const next: Concept["shots"] = [...c.shots];
    for (const w of weak.sort((a, b) => a.score - b.score).slice(0, 4)) {
      const s = next[w.idx]!;
      const fix = w.issues
        .slice(0, 2)
        .join(" ")
        .replace(/^Gemini: /, "");
      const updated = {
        ...s,
        clipAssetId: undefined,
        motion: `${(s.motion ?? "subtle natural handheld motion").split(" Fix:")[0]} Fix: ${fix}`.slice(0, 600),
      };
      next[w.idx] =
        s.source === "generated" && FRAME_ISSUE.test(fix)
          ? {
              ...updated,
              visualPrompt: `${s.visualPrompt.split(" Fix:")[0]} Fix: ${fix}`.slice(0, 900),
              keyframeAssetId: (
                await keyframeFor(
                  db,
                  brand,
                  c,
                  { ...updated, visualPrompt: `${s.visualPrompt} Fix: ${fix}` },
                  ` (A18 round ${round} fix)`,
                )
              ).id,
            }
          : updated;
    }
    c = { ...c, shots: next };
    await upsertConcept(db, c);
  }
  // keep the best cut as the concept's video
  if (best && best.asset.id !== (await getConcept(db, c.id))!.videoAssetId) {
    c = { ...(await getConcept(db, c.id))!, videoAssetId: best.asset.id, shots: best.shots };
    await upsertConcept(db, c);
  }
  const vf = urlToFile(best!.asset.url)!;
  await extractFrame(vf, 1.2, `${vf}.poster.jpg`, 720).catch(() => undefined);
  let sheet: string | undefined;
  if (o.sheetPath && fs.existsSync(vf)) sheet = await contactSheet(vf, (await getConcept(db, c.id))!, o.sheetPath);
  return { concept: (await getConcept(db, c.id))!, asset: best!.asset, review: best!.review, reviews, sheet };
}
