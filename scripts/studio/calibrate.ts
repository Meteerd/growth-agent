/**
 * Score competitors' proven winners with the same reviewer that scores our ads.
 *   tsx scripts/studio/calibrate.ts <brand> [n=6]
 */
import { loadEnv } from "../env";

loadEnv();
const [slug, nRaw] = process.argv.slice(2);
const { getDb } = await import("@/engine/db/client");
const { mustBrand } = await import("@/engine/studio/config");
const { listRefs, listAds } = await import("@/engine/studio/store");
const { reviewFiles } = await import("@/engine/studio/generate");
const { urlToFile } = await import("@/engine/video/files");
const db = await getDb();
const brand = await mustBrand(db, slug!);
const n = Number(nRaw ?? 6);
const ctx = {
  db,
  job: {} as never,
  signal: new AbortController().signal,
  step: async () => {},
  log: async () => {},
  cost: async () => {},
  check: () => {},
};
const refs = (await listRefs(db, brand.id))
  .filter((r) => r.mediaType !== "video_cover" && r.body.analysis && !r.body.analysis.irrelevant)
  .sort(
    (a, b) => (b.body.daysRunning ?? 0) * (b.body.variants ?? 1) - (a.body.daysRunning ?? 0) * (a.body.variants ?? 1),
  )
  .slice(0, n);
const scores: number[] = [];
for (const r of refs) {
  const files = r.body.images
    .map((u) => urlToFile(u))
    .filter((f): f is string => !!f)
    .slice(0, 4);
  const rv = await reviewFiles(ctx, brand, files, {
    title: r.body.analysis?.headline ?? r.advertiser,
    format: r.body.analysis?.format ?? "competitor",
    copy: { primaryText: r.body.body ?? "", headline: r.body.title ?? "", description: "", cta: r.body.cta ?? "" },
    advertiser: r.advertiser,
  });
  scores.push(rv.overall);
  console.log(
    `${rv.overall}  ${r.advertiser} | ${r.body.daysRunning}d x${r.body.variants ?? 1} | stop ${rv.stopPower} craft ${rv.craft} | ${rv.issues[0]?.slice(0, 110) ?? ""}`,
  );
}
const ours = (await listAds(db, { brandId: brand.id })).filter((a) => a.score).map((a) => a.score!);
const avg = (x: number[]) => Math.round((x.reduce((a, b) => a + b, 0) / Math.max(1, x.length)) * 10) / 10;
console.log(
  `\nCompetitor winners: avg ${avg(scores)} (max ${Math.max(...scores)}) | ours: avg ${avg(ours)} (max ${Math.max(...ours)}, n=${ours.length})`,
);
process.exit(0);
