/**
 * pnpm flagship <conceptId> [--sheet docs/renders/<name>.jpg]
 * A17: build the realistic flagship remake for a concept (brand images first, photoreal frames otherwise, fal motion,
 * stricter review, max 2 rounds). fal is forced live for this command only; everything stays within the caps.
 */
import { loadEnv } from "./env";

loadEnv();
const args = process.argv.slice(2);
const conceptId = args[0];
const sheetIdx = args.indexOf("--sheet");
const sheetPath = sheetIdx >= 0 ? args[sheetIdx + 1] : undefined;
process.env.NEXUS_FORCE_LIVE = "fal";
const { getDb } = await import("@/engine/db/client");
const { buildFlagship, contactSheet, repairFlagship } = await import("@/engine/flagship");
const { urlToFile } = await import("@/engine/video/files");
const repo = await import("@/engine/repo");
const db = await getDb();
const t0 = Date.now();
const r = process.argv.includes("--repair")
  ? await repairFlagship(db, conceptId)
  : await buildFlagship(db, conceptId, { sheetPath });
if (process.argv.includes("--repair") && sheetPath)
  r.sheet = await contactSheet(urlToFile(r.asset.url)!, r.concept, sheetPath);
const spend = await repo.listSpend(db, r.concept.runId);
console.log(
  JSON.stringify(
    {
      concept: r.concept.id,
      title: r.concept.title,
      video: r.asset.url,
      durationSec: r.asset.durationSec,
      minutes: Math.round((Date.now() - t0) / 600) / 100,
      shots: r.concept.shots.map((s) => `${s.idx + 1}: ${s.source}${s.imageRef ? ` ${s.imageRef}` : ""} (${s.style})`),
      reviews: r.reviews.map((x) => ({
        round: x.round,
        overall: x.overall,
        decision: x.decision,
        perShot: x.perShot.map((p) => p.score),
      })),
      sheet: r.sheet,
      runSpend: spend.reduce((a, s) => a + s.usd, 0).toFixed(2),
    },
    null,
    2,
  ),
);

// some SDK sockets keep the event loop alive after the work is done
process.exit(0);
