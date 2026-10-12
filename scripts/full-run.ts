/**
 * pnpm full-run <slug> [--fal]
 * A full run on top of the brand's recorded research (or its demo run). The consultation questions are SKIPPED,
 * so the agent proceeds on its own stated assumptions (nobody answers on the operator's behalf). With --fal the
 * remake concept is then rendered at the final tier (fal clips) within the fal cap.
 */
import { loadEnv } from "./env";

loadEnv();
const slug = process.argv[2];
const withFal = process.argv.includes("--fal");
if (!slug) {
  console.error("usage: pnpm full-run <slug> [--fal]");
  process.exit(1);
}
if (withFal) process.env.NEXUS_FORCE_LIVE = "fal";
const { getDb } = await import("@/engine/db/client");
const { ensureSeeded } = await import("@/engine/seed");
const repo = await import("@/engine/repo");
const { createRun } = await import("@/engine/runs");
const { runPipeline } = await import("@/engine/agent/pipeline");
const { reuseResearch } = await import("@/engine/live/recorded");
const { submitAnswers } = await import("@/engine/agent/phases/consult");
const { renderConcept } = await import("@/engine/services/concepts");
const db = await getDb();
await ensureSeeded(db);
const brand = (await repo.getBrand(db, slug))!;
const runs = await repo.listRuns(db, brand.id);
const from = runs.find((r) => r.dataset === "live_recorded")?.id ?? `run_${slug}_demo`;
const run = await createRun(db, brand.id, "full");
await reuseResearch(db, from, run.id);
console.log(`full run ${run.id} on research from ${from}`);
const t0 = Date.now();
let seen = 0;
const tick = setInterval(async () => {
  const evs = await repo.listEvents(db, run.id, seen);
  for (const e of evs)
    if (!["evidence", "cost"].includes(e.type)) console.log(`  [${e.phase}] ${e.type}: ${e.title.slice(0, 120)}`);
  if (evs.length) seen = evs.at(-1)!.id;
}, 2000);
const signal = new AbortController().signal;
await runPipeline(db, run.id, signal);
if ((await repo.getRun(db, run.id))?.status === "waiting_input") {
  const qs = await repo.listQuestions(db, run.id);
  await submitAnswers(
    db,
    run.id,
    qs.map((q) => ({ questionId: q.id, skip: true })),
  );
  await runPipeline(db, run.id, signal);
}
let falAsset: unknown = null;
if (withFal) {
  const remake = (await repo.listConcepts(db, run.id)).find(
    (c) => c.blueprintId && c.compliance !== "fail" && c.shots.length > 1,
  );
  if (remake) falAsset = (await renderConcept(db, remake.id, "final", { label: "final_fal" })).asset;
}
await new Promise((r) => setTimeout(r, 2500));
clearInterval(tick);
const spend = await repo.listSpend(db, run.id);
const by: Record<string, number> = {};
for (const s of spend) by[s.provider] = Math.round(((by[s.provider] ?? 0) + s.usd) * 10000) / 10000;
const concepts = await repo.listConcepts(db, run.id);
console.log(
  JSON.stringify(
    {
      runId: run.id,
      status: (await repo.getRun(db, run.id))?.status,
      minutes: Math.round((Date.now() - t0) / 600) / 100,
      plan: (await repo.getLatestPlan(db, run.id))?.channels.map((c) => `${c.channel} ${c.score}`),
      concepts: concepts.map((c) => `${c.channel}/${c.format} ${c.compliance} ${c.status}: ${c.title}`),
      falAsset,
      spend: by,
    },
    null,
    2,
  ),
);

// some SDK sockets keep the event loop alive after the work is done
process.exit(0);
