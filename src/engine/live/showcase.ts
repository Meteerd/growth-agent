import fs from "node:fs";
import path from "node:path";
import type { Asset, ComplianceCheck, DemoRunBundle, Review } from "@/contracts";
import type { Db } from "../db/client";
import { ffmpeg } from "../media/ffmpeg";
import { connectorBrand } from "../providers/business";
import {
  getAsset,
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
  upsertConcept,
  upsertPack,
  upsertReview,
} from "../repo";
import { scrub } from "../smoke/record";
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
  // a private brand (its own business data is connected) never goes into the public repo or showcase build,
  // unless Mete confirmed the owner approved (PUBLIC_OK_BRANDS)
  const ok = (process.env.PUBLIC_OK_BRANDS ?? "").split(",").map((x) => x.trim().toLowerCase());
  if (brand.slug === connectorBrand() && !ok.includes(brand.slug))
    throw new Error(`${brand.name} is private (CONNECTOR_BRAND): not exported to the public showcase`);
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
  fs.writeFileSync(f, `${JSON.stringify(scrub(bundle))}\n`);
  return f;
}

export function loadShowcase(slug: string): DemoRunBundle | null {
  const f = path.join(showcaseDir(), `${slug}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as DemoRunBundle) : null;
}

/**
 * Seed: import a showcase run (idempotent) and put its flagship video where the asset route serves it. A database
 * that imported an older export of the same run still gets the newer flagship: missing assets are added and the
 * concepts, packs and reviews that point at them are refreshed; a video file that changed is copied again.
 */
export async function importShowcase(db: Db, b: DemoRunBundle): Promise<boolean> {
  const fresh = !(await getRun(db, b.run.id));
  if (fresh) await importBundle(db, b);
  const missing = fresh
    ? b.assets
    : (await Promise.all(b.assets.map(async (a) => ((await getAsset(db, a.id)) ? null : a)))).filter(
        (a): a is Asset => !!a,
      );
  for (const a of b.assets) {
    const src = path.join(renderDir(), path.basename(a.url));
    const dst = urlToFile(a.url);
    if (dst && fs.existsSync(src) && (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(src).size)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }
  for (const a of missing) await upsertAsset(db, a);
  if (fresh || !missing.length) return fresh;
  // an older import of this run: bring the rows that use the new flagship up to date
  const ids = new Set(missing.map((a) => a.id));
  const concepts = b.concepts.filter((c) => c.videoAssetId && ids.has(c.videoAssetId));
  for (const c of concepts) await upsertConcept(db, c);
  const cids = new Set(concepts.map((c) => c.id));
  for (const p of b.packs.filter((x) => cids.has(x.conceptId))) await upsertPack(db, p);
  for (const r of b.reviews.filter((x) => cids.has(x.conceptId))) await upsertReview(db, r);
  return true;
}
