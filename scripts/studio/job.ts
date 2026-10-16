/**
 * Run a studio job inline and print its result (server-side testing).
 *   tsx scripts/studio/job.ts setup '{"url":"https://a.clinic"}'
 *   tsx scripts/studio/job.ts scan '{"brand":"hound"}'
 *   tsx scripts/studio/job.ts generate '{"brand":"hound","count":4,"carousels":1}'
 */
import { loadEnv } from "../env";

loadEnv();
const [kind, raw] = process.argv.slice(2);
if (!kind) {
  console.error("usage: job <setup|scan|analyze|generate|revise|autopilot> '<json input>'");
  process.exit(1);
}
const input = JSON.parse(raw ?? "{}") as Record<string, unknown>;
const { getDb } = await import("@/engine/db/client");
const { ensureStudioSeeded, mustBrand } = await import("@/engine/studio/config");
const { runJobNow } = await import("@/engine/studio/jobs");
const db = await getDb();
await ensureStudioSeeded(db);
const brandId = typeof input.brand === "string" ? (await mustBrand(db, input.brand)).id : null;
const t0 = Date.now();
const timer = setInterval(async () => {
  const { listJobs } = await import("@/engine/studio/store");
  const j = (await listJobs(db, { limit: 1 }))[0];
  if (j)
    console.log(
      `[${Math.round((Date.now() - t0) / 1000)}s] ${Math.round(j.progress * 100)}% ${j.step ?? ""} ($${j.costUsd.toFixed(3)})`,
    );
}, 15000);
const job = await runJobNow(kind as never, brandId, input);
clearInterval(timer);
console.log(
  JSON.stringify({ status: job.status, error: job.error, costUsd: job.costUsd, output: job.output }, null, 2),
);
console.log(job.log.map((l) => `  ${l.ts.slice(11, 19)} ${l.msg}`).join("\n"));
process.exit(job.status === "done" ? 0 : 1);
