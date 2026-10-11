import fs from "node:fs";
import path from "node:path";
import type { Asset, ComplianceCheck, DemoRunBundle, Review } from "@/contracts";
import type { Db } from "../db/client";
import { ffmpeg } from "../media/ffmpeg";
import {
  getBlueprint,
  getBrand,
  getLatestPlan,
  getRun,
  importBundle,
  listAssets,
  listBlueprints,
  listCompliance,
  listConcepts,
  listEvents,
  listEvidence,
  listPacksByRun,
  listQuestions,
  listReviews,
  upsertAsset,
} from "../repo";
import { urlToFile } from "../video/files";

/**
 * Showcase runs (real research + live Claude/OpenAI/fal output) exported into the repo so any machine shows them:
 * the run's data as JSON in src/contracts/fixtures/live/showcase/<slug>.json and the flagship video (720p) in
 * docs/renders/<slug>-flagship.mp4. Seed imports them and copies the video back under data/assets.
 */
export const showcaseDir = () =>
  process.env.SHOWCASE_DIR || path.join(process.cwd(), "src/contracts/fixtures/live/showcase");
const renderDir = () => process.env.RENDER_DIR || path.join(process.cwd(), "docs/renders");

export async function exportShowcase(db: Db, runId: string): Promise<string> {
  const run = await getRun(db, runId);
  if (!run) throw new Error("run not found");
  const brand = (await getBrand(db, run.brandId))!;
  const concepts = await listConcepts(db, runId);
  const assets: Asset[] = [];
  const reviews: Review[] = [];
  const compliance: ComplianceCheck[] = [];
  for (const c of concepts) {
    const vid = c.videoAssetId ? (await listAssets(db, c.id)).find((a) => a.id === c.videoAssetId) : undefined;
    if (vid && vid.model?.includes("flagship")) {
      const src = urlToFile(vid.url)!;
      fs.mkdirSync(renderDir(), { recursive: true });
      const out = path.join(renderDir(), `${brand.slug}-flagship.mp4`);
      await ffmpeg([
        "-y",
        "-i",
        src,
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
        "96k",
        "-movflags",
        "+faststart",
        out,
      ]);
      assets.push({ ...vid, url: `/api/assets/showcase/${brand.slug}-flagship.mp4`, width: 720, height: 1280 });
    }
    reviews.push(...(await listReviews(db, c.id)));
    compliance.push(...(await listCompliance(db, c.id)));
  }
  const bps = await listBlueprints(db, runId);
  const bundle: DemoRunBundle = {
    brand,
    run: { ...run, demo: false, dataset: "live_recorded", capturedAt: run.startedAt ?? run.createdAt },
    connections: [],
    evidence: (await listEvidence(db, runId)).filter((e) => !e.demo),
    blueprints: bps,
    questions: await listQuestions(db, runId),
    plan: (await getLatestPlan(db, runId))!,
    concepts: concepts
      .map((c) =>
        c.videoAssetId && !assets.some((a) => a.id === c.videoAssetId) ? { ...c, videoAssetId: undefined } : c,
      )
      .map((c) => ({
        ...c,
        shots: c.shots.map((s) => ({ ...s, keyframeAssetId: undefined, clipAssetId: undefined })),
      })),
    compliance,
    packs: (await listPacksByRun(db, runId)).map((p) =>
      p.videoAssetId && !assets.some((a) => a.id === p.videoAssetId) ? { ...p, videoAssetId: undefined } : p,
    ),
    assets,
    reviews,
    events: await listEvents(db, runId),
  };
  fs.mkdirSync(showcaseDir(), { recursive: true });
  const f = path.join(showcaseDir(), `${brand.slug}.json`);
  fs.writeFileSync(f, `${JSON.stringify(bundle)}\n`);
  return f;
}

export function loadShowcase(slug: string): DemoRunBundle | null {
  const f = path.join(showcaseDir(), `${slug}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as DemoRunBundle) : null;
}

/** Seed: import a showcase run (idempotent) and put its flagship video where the asset route serves it. */
export async function importShowcase(db: Db, b: DemoRunBundle): Promise<boolean> {
  if (await getRun(db, b.run.id)) return false;
  await importBundle(db, b);
  for (const a of b.assets) {
    const src = path.join(renderDir(), path.basename(a.url));
    const dst = urlToFile(a.url);
    if (dst && fs.existsSync(src) && !fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
    await upsertAsset(db, a);
  }
  return true;
}
