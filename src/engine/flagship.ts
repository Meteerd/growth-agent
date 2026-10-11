import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import type { Asset, Blueprint, Brand, Concept, Review } from "@/contracts";
import { type BetaContentBlockParam, loadPrompt, structured } from "./agent/claude";
import { makeCtx } from "./agent/context";
import { reviewRender } from "./agent/phases/review";
import type { Db } from "./db/client";
import { HttpError } from "./http";
import { newId, nowIso } from "./ids";
import { extractFrame, probe } from "./media/ffmpeg";
import { generateImage } from "./providers/openai";
import {
  appendEvent,
  getAsset,
  getBlueprint,
  getBrand,
  getConcept,
  getRun,
  listReviews,
  upsertAsset,
  upsertConcept,
  upsertReview,
} from "./repo";
import { rulePackText } from "./rules";
import { renderConcept } from "./services/concepts";
import { brandAssetsDir, fileToUrl, urlToFile } from "./video/files";
import { demoKeyframe, writeAsset } from "./video/keyframes";

/**
 * A17: the flagship remake. Each shot starts from the brand's real image when one fits, otherwise from a frame
 * generated in the winner's style (photoreal phone footage for real-footage winners); fal animates every shot
 * with the blueprint's camera move; Claude watches the cut against a stricter rubric (native footage, no AI tells)
 * and the failing shots are regenerated (max 2 rounds).
 */

export const ShotPlan = z.object({
  shots: z.array(
    z.object({
      idx: z.number(),
      source: z.enum(["brand_image", "generated"]),
      imageRef: z.string().optional(),
      style: z.enum(["photoreal", "illustration", "screen"]),
      imagePrompt: z.string(),
      motion: z.string(),
      why: z.string(),
    }),
  ),
});

const IMG = /\.(png|jpe?g|webp)$/i;

export function brandImages(slug: string): string[] {
  const dir = path.join(brandAssetsDir(), slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => IMG.test(f) && !/logo|mark|icon|founder/i.test(f))
    .sort();
}

export async function planShots(
  db: Db,
  brand: Brand,
  c: Concept,
  bp: Blueprint | null,
): Promise<z.infer<typeof ShotPlan>> {
  const files = brandImages(brand.slug);
  const content: BetaContentBlockParam[] = [
    {
      type: "text",
      text: JSON.stringify({
        blueprint: bp ? { structure: bp.structure, hook: bp.hook, shots: bp.shots } : null,
        remake: {
          title: c.title,
          language: c.language,
          shots: c.shots.map((s) => ({
            idx: s.idx,
            durationSec: s.durationSec,
            onScreenText: s.onScreenText,
            voiceover: s.voiceover,
            visualBrief: s.visualPrompt,
          })),
        },
        brandImages: files,
      }),
    },
  ];
  for (const [i, f] of files.entries()) {
    const thumb = await sharp(path.join(brandAssetsDir(), brand.slug, f))
      .resize(256, 256, { fit: "inside" })
      .jpeg({ quality: 70 })
      .toBuffer();
    content.push({ type: "text", text: `Brand image ${i + 1}: ${f}` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: thumb.toString("base64") },
    });
  }
  const r = await structured(
    { db, runId: c.runId, phase: "production" },
    {
      route: "vision",
      system: loadPrompt("shot_sourcing", { rulePack: rulePackText(brand.rulePack) }),
      user: content,
      schema: ShotPlan,
      note: `flagship: shot sourcing for ${c.id}`,
      maxTokens: 8000,
      demo: () => ({
        shots: c.shots.map((s) => ({
          idx: s.idx,
          source: "generated" as const,
          style: "photoreal" as const,
          imagePrompt: s.visualPrompt,
          motion: "handheld phone push-in, natural movement",
          why: "demo",
        })),
      }),
    },
  );
  // only keep brand images that really exist; a brand_image shot without one becomes a generated frame
  return {
    shots: r.value.shots.map((x) => {
      const ok = !!x.imageRef && files.includes(x.imageRef);
      if (x.source === "brand_image" && !ok) return { ...x, source: "generated" as const, imageRef: undefined };
      return ok ? x : { ...x, imageRef: undefined };
    }),
  };
}

const PHOTOREAL =
  "Photoreal vertical phone video frame, shot on an iPhone, natural window light, real lived-in home, candid framing, slight motion blur and grain, true-to-life colors, no text, no logos, no watermark, not glossy, not CGI.";

async function keyframeFor(
  db: Db,
  brand: Brand,
  c: Concept,
  s: Concept["shots"][number],
  note: string,
): Promise<Asset> {
  let png: Buffer;
  let provider: Asset["provider"] = "local";
  let model = "brand-image";
  let usd = 0;
  let demo = false;
  if (s.source === "brand_image" && s.imageRef) {
    // brand art is often transparent (black in video): flatten onto the brand's light color, then fill 9:16
    // without cropping the subject away (contain on the same background for square or wide art)
    const bg = brand.dossier.visual.colors.at(-1) ?? "#FFFFFF";
    const src = path.join(brandAssetsDir(), brand.slug, s.imageRef);
    const meta = await sharp(src).metadata();
    const portrait = (meta.height ?? 1) / (meta.width ?? 1) > 1.3;
    png = await sharp(src)
      .flatten({ background: bg })
      .resize(1080, 1920, { fit: portrait ? "cover" : "contain", position: "attention", background: bg })
      .png()
      .toBuffer();
  } else {
    const prompt =
      s.style === "photoreal"
        ? `${s.visualPrompt}. ${PHOTOREAL}`
        : `${s.visualPrompt}. Style: ${brand.dossier.visual.styleNotes ?? ""} Vertical 9:16, no text.`;
    // a generated frame that shows the brand's real art (on a phone, a poster) gets that image as a reference
    let refs: string[] | undefined;
    if (s.imageRef) {
      const ref = path.join(brandAssetsDir(), brand.slug, s.imageRef);
      if (fs.existsSync(ref)) {
        const flat = path.resolve(
          process.env.ASSETS_DIR || "data/assets",
          "tmp",
          `${brand.slug}_${path.parse(s.imageRef).name}.png`,
        );
        fs.mkdirSync(path.dirname(flat), { recursive: true });
        await sharp(ref)
          .flatten({ background: brand.dossier.visual.colors.at(-1) ?? "#FFFFFF" })
          .png()
          .toFile(flat);
        refs = [flat];
      }
    }
    const gen = (withRefs: boolean) =>
      generateImage(
        db,
        withRefs && refs ? `${prompt} The screen or print shows exactly the attached brand image.` : prompt,
        {
          runId: c.runId,
          quality: "high",
          refs: withRefs ? refs : undefined,
          demo: () => demoKeyframe(brand, s),
        },
      );
    // an edit with a reference can be refused; fall back to a plain generation rather than failing the cut
    const img = await gen(true).catch(async (e) => {
      if (!refs) throw e;
      await appendEvent(db, {
        runId: c.runId,
        phase: "production",
        type: "warning",
        title: `Reference edit failed for shot ${s.idx + 1}; generating without it`,
        detail: e instanceof Error ? e.message : String(e),
      });
      return gen(false);
    });
    png = img.png;
    provider = img.mode === "live" ? "openai" : "local";
    model = img.model;
    usd = img.usd;
    demo = img.mode === "demo";
  }
  const file = writeAsset(path.join("runs", c.runId, c.id, `flag_kf_${s.idx}_${Date.now().toString(36)}.png`), png);
  const asset: Asset = {
    id: newId("asset"),
    brandId: c.brandId,
    conceptId: c.id,
    kind: "keyframe",
    url: fileToUrl(file),
    provider,
    model,
    costUsd: usd,
    width: 1080,
    height: 1920,
    demo,
    createdAt: nowIso(),
    shotIdx: s.idx,
  };
  await upsertAsset(db, asset);
  await appendEvent(db, {
    runId: c.runId,
    phase: "production",
    type: "asset",
    title: `Flagship frame ${s.idx + 1}: ${s.source === "brand_image" ? `brand image ${s.imageRef}` : `generated (${s.style})`}${note}`,
    refId: asset.id,
    costUsd: usd || undefined,
    data: { conceptId: c.id, shotIdx: s.idx, url: asset.url },
  });
  return asset;
}

export async function contactSheet(videoFile: string, c: Concept, out: string): Promise<string> {
  const info = await probe(videoFile);
  const tiles: Buffer[] = [];
  let t = 0;
  const tmp = `${out}.frames`;
  for (const s of c.shots) {
    const f = await extractFrame(
      videoFile,
      Math.min(info.durationSec - 0.1, t + s.durationSec / 2),
      path.join(tmp, `${s.idx}.jpg`),
      270,
    );
    tiles.push(await sharp(f).resize(270, 480, { fit: "cover" }).jpeg().toBuffer());
    t += s.durationSec;
  }
  const w = 270 * tiles.length + 10 * (tiles.length - 1);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width: w, height: 480, channels: 3, background: "#111111" } })
    .composite(tiles.map((input, i) => ({ input, left: i * 280, top: 0 })))
    .jpeg({ quality: 82 })
    .toFile(out);
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}

export interface FlagshipResult {
  concept: Concept;
  asset: Asset;
  reviews: Review[];
  sheet?: string;
}

export async function buildFlagship(
  db: Db,
  conceptId: string,
  o: { sheetPath?: string; rounds?: number } = {},
): Promise<FlagshipResult> {
  let c = await getConcept(db, conceptId);
  if (!c) throw new HttpError(404, "not_found", "Concept not found");
  if (c.compliance === "fail") throw new HttpError(409, "compliance_failed", "Concept failed compliance");
  const brand = (await getBrand(db, c.brandId))!;
  const bp = c.blueprintId ? await getBlueprint(db, c.blueprintId) : null;
  const run = (await getRun(db, c.runId))!;

  // 1. sourcing plan
  const plan = await planShots(db, brand, c, bp);
  c = {
    ...c,
    shots: c.shots.map((s) => {
      const p = plan.shots.find((x) => x.idx === s.idx);
      if (!p) return s;
      return {
        ...s,
        source: p.source,
        imageRef: p.imageRef,
        style: p.style,
        motion: p.motion,
        visualPrompt: p.source === "generated" ? p.imagePrompt : s.visualPrompt,
        keyframeAssetId: undefined,
        clipAssetId: undefined,
        approved: false,
      };
    }),
  };
  await upsertConcept(db, c);
  await appendEvent(db, {
    runId: c.runId,
    phase: "production",
    type: "thinking",
    title: `Flagship plan: ${plan.shots.filter((x) => x.source === "brand_image").length} brand images, ${plan.shots.filter((x) => x.source === "generated").length} new frames`,
    detail: plan.shots
      .map((x) => `${x.idx + 1}: ${x.source}${x.imageRef ? ` ${x.imageRef}` : ""} (${x.style}) ${x.why}`)
      .join(" | "),
  });

  // 2. frames
  const shots = [...c.shots];
  const queue = [...shots];
  const cur = c;
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, async () => {
      for (let s = queue.shift(); s; s = queue.shift())
        shots[s.idx] = { ...s, keyframeAssetId: (await keyframeFor(db, brand, cur, s, "")).id };
    }),
  );
  c = { ...c, shots, status: "keyframes" };
  await upsertConcept(db, c);

  // 3. render with motion, watch, fix (max rounds)
  const base = await makeCtx(db, run.id, new AbortController().signal);
  const ctx = base.forPhase("review");
  const reviews: Review[] = [];
  let asset: Asset | null = null;
  const rounds = o.rounds ?? 2;
  for (let round = 1; round <= rounds; round++) {
    asset = (await renderConcept(db, c.id, "final", { label: `flagship_r${round}` })).asset;
    asset = { ...asset, model: `${asset.model}-flagship` };
    await upsertAsset(db, asset);
    c = (await getConcept(db, c.id))!;
    const rv = await reviewRender(ctx, c, bp, asset.id, round, []);
    const weak = rv.perShot.filter((p) => p.score < 80);
    rv.decision = weak.length && round < rounds ? "regenerate" : "accept";
    if (rv.decision === "regenerate") rv.regeneratedShots = weak.map((w) => w.idx);
    await upsertReview(db, rv);
    reviews.push(rv);
    await appendEvent(db, {
      runId: c.runId,
      phase: "review",
      type: "review",
      title: `Flagship round ${round}: ${rv.overall}/100, ${rv.decision}`,
      refId: rv.id,
      detail: rv.notes,
      data: { conceptId: c.id, round, perShot: rv.perShot },
    });
    if (rv.decision === "accept") break;
    // regenerate weak shots: new frame for generated shots, new motion for brand images
    const next: Concept["shots"] = [...c.shots];
    for (const w of weak.sort((a, b) => a.score - b.score).slice(0, 3)) {
      const s = next[w.idx];
      const fix = w.issues[0] ? ` Fix: ${w.issues[0]}` : "";
      const updated = {
        ...s,
        clipAssetId: undefined,
        motion: `${s.motion ?? ""}${fix}`.trim(),
        visualPrompt: s.source === "generated" ? `${s.visualPrompt}${fix}` : s.visualPrompt,
      };
      next[w.idx] =
        s.source === "generated"
          ? { ...updated, keyframeAssetId: (await keyframeFor(db, brand, c, updated, ` (round ${round} fix)`)).id }
          : updated;
    }
    c = { ...c, shots: next };
    await upsertConcept(db, c);
  }
  if (asset) {
    const vf = urlToFile(asset.url)!;
    await extractFrame(vf, 1.2, `${vf}.poster.jpg`, 720).catch(() => undefined);
  }
  let sheet: string | undefined;
  if (asset && o.sheetPath) sheet = await contactSheet(urlToFile(asset.url)!, c, o.sheetPath);
  return { concept: (await getConcept(db, c.id))!, asset: asset!, reviews, sheet };
}

/**
 * Repair pass on a finished flagship: re-animate only the shots the last review scored under 80 (with the
 * reviewer's fix in the motion prompt; screen shots become stills), render, review, and keep the best version of
 * every shot: a shot that got worse goes back to its previous clip (re-composed at no extra cost) and the final cut
 * is reviewed once more.
 */
export async function repairFlagship(db: Db, conceptId: string): Promise<FlagshipResult> {
  let c = (await getConcept(db, conceptId))!;
  const bp = c.blueprintId ? await getBlueprint(db, c.blueprintId) : null;
  const run = (await getRun(db, c.runId))!;
  const ctx = (await makeCtx(db, run.id, new AbortController().signal)).forPhase("review");
  const prev = (await listReviews(db, c.id)).at(-1);
  if (!prev) throw new HttpError(409, "no_review", "Build the flagship first");
  const weak = prev.perShot
    .filter((p) => p.score < 80)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const before = c.shots.map((s) => ({ ...s }));
  c = {
    ...c,
    shots: c.shots.map((s) => {
      const w = weak.find((x) => x.idx === s.idx);
      if (!w) return s;
      if (s.style === "screen" || (s.source === "generated" && s.imageRef)) return { ...s, clipAssetId: undefined };
      return {
        ...s,
        clipAssetId: undefined,
        motion: `${s.motion ?? "subtle natural motion"}. Fix: ${w.issues[0] ?? "keep every shape stable"}. Keep anatomy and objects identical across the shot; minimal motion.`,
      };
    }),
  };
  await upsertConcept(db, c);
  const reviews: Review[] = [];
  const render = async (label: string) => {
    let a = (await renderConcept(db, c.id, "final", { label })).asset;
    a = { ...a, model: `${a.model}-flagship` };
    await upsertAsset(db, a);
    return a;
  };
  let asset = await render(`flagship_r${prev.round + 1}`);
  c = (await getConcept(db, c.id))!;
  let rv = await reviewRender(ctx, c, bp, asset.id, prev.round + 1, []);
  // keep the best version of every changed shot
  const reverted: number[] = [];
  for (const w of weak) {
    const now = rv.perShot.find((p) => p.idx === w.idx)?.score ?? 0;
    if (now < w.score) reverted.push(w.idx);
  }
  if (reverted.length) {
    c = { ...c, shots: c.shots.map((s) => (reverted.includes(s.idx) ? { ...before[s.idx] } : s)) };
    await upsertConcept(db, c);
    asset = await render(`flagship_r${prev.round + 1}_best`);
    c = (await getConcept(db, c.id))!;
    rv = await reviewRender(ctx, c, bp, asset.id, prev.round + 1, []);
  }
  rv.decision = "accept";
  rv.regeneratedShots = weak.map((w) => w.idx).filter((i) => !reverted.includes(i));
  rv.notes = `${rv.notes}${reverted.length ? ` (kept the earlier version of shot(s) ${reverted.map((i) => i + 1).join(", ")}, which scored better)` : ""}`;
  await upsertReview(db, rv);
  reviews.push(rv);
  await appendEvent(db, {
    runId: c.runId,
    phase: "review",
    type: "review",
    title: `Flagship repair: ${rv.overall}/100`,
    refId: rv.id,
    detail: rv.notes,
    data: { conceptId: c.id, round: rv.round, perShot: rv.perShot },
  });
  const vf = urlToFile(asset.url)!;
  await extractFrame(vf, 1.2, `${vf}.poster.jpg`, 720).catch(() => undefined);
  return { concept: c, asset, reviews };
}
