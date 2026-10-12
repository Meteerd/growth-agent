/**
 * pnpm live-pass <slug>: one real research pass (intake, research, reverse_engineer) with every provider live
 * (Apify, Spiral and Manus forced for this run only), within the caps, recorded to
 * src/contracts/fixtures/live/runs/<slug>.json as the brand's default dataset.
 */
import { loadEnv } from "./env";

loadEnv();
const slug = process.argv[2];
if (!slug) {
  console.error("usage: pnpm live-pass <slug>");
  process.exit(1);
}
process.env.NEXUS_FORCE_LIVE = process.argv.includes("--no-manus") ? "apify,spiral" : "apify,spiral,manus";
process.env.RESEARCH_ITEMS_PER_SOURCE ??= "25";
process.env.BLUEPRINTS_PER_RUN ??= "3";
process.env.MANUS_WAIT_SEC ??= "720";

const { getDb } = await import("@/engine/db/client");
const { ensureSeeded } = await import("@/engine/seed");
const repo = await import("@/engine/repo");
const { createRun } = await import("@/engine/runs");
const { runPipeline } = await import("@/engine/agent/pipeline");
const { exportRecorded } = await import("@/engine/live/recorded");
const db = await getDb();
await ensureSeeded(db);
const brand = await repo.getBrand(db, slug);
if (!brand) throw new Error(`no brand ${slug}`);
const run = await createRun(db, brand.id, "research_only");
console.log(`live pass ${slug}: run ${run.id}`);
const t0 = Date.now();
let lastSeq = 0;
const ticker = setInterval(async () => {
  const evs = await repo.listEvents(db, run.id, lastSeq);
  for (const e of evs) console.log(`  [${e.phase}] ${e.type}: ${e.title.slice(0, 110)}`);
  if (evs.length) lastSeq = evs.at(-1)!.id;
}, 3000);
try {
  await runPipeline(db, run.id, new AbortController().signal);
} catch (e) {
  console.error("live pass failed:", e instanceof Error ? e.message : e);
  const { setStatus } = await import("@/engine/runs");
  await setStatus(db, run.id, "failed", `Live pass failed: ${e instanceof Error ? e.message : e}`).catch(
    () => undefined,
  );
}
clearInterval(ticker);
const spend = await repo.listSpend(db, run.id);
const byProvider: Record<string, number> = {};
for (const s of spend) byProvider[s.provider] = Math.round(((byProvider[s.provider] ?? 0) + s.usd) * 10000) / 10000;
const file = await exportRecorded(db, run.id, byProvider);
const ev = await repo.listEvidence(db, run.id);
const bps = await repo.listBlueprints(db, run.id);
const bySource: Record<string, number> = {};
for (const e of ev) bySource[e.source] = (bySource[e.source] ?? 0) + 1;
console.log(
  JSON.stringify(
    {
      slug,
      runId: run.id,
      status: (await repo.getRun(db, run.id))?.status,
      minutes: Math.round((Date.now() - t0) / 600) / 100,
      evidence: ev.length,
      live: ev.filter((e) => !e.demo).length,
      bySource,
      blueprints: bps.map((b) => `${b.shots.length} shots ${b.structure} from ${b.evidenceId}`),
      spend: byProvider,
      file,
    },
    null,
    2,
  ),
);

// some SDK sockets keep the event loop alive after the work is done
process.exit(0);
