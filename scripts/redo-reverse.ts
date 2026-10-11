/**
 * pnpm redo-reverse <runId> [manusTaskId]
 * Re-runs the reverse_engineer phase of a finished research run (e.g. after a blueprint improvement), and attaches
 * a finished Manus landscape task's result to the run's Manus evidence. Keeps the event log ordered, then
 * re-exports the recorded dataset when the run is live_recorded.
 */
import { loadEnv } from "./env";

loadEnv();
const [runId, manusTaskId] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const manusOnly = process.argv.includes("--manus-only");
if (!runId) {
  console.error("usage: pnpm redo-reverse <runId> [manusTaskId]");
  process.exit(1);
}
const { and, eq, gt } = await import("drizzle-orm");
const { getDb } = await import("@/engine/db/client");
const t = await import("@/engine/db/schema");
const repo = await import("@/engine/repo");
const { makeCtx } = await import("@/engine/agent/context");
const { reverseEngineer } = await import("@/engine/agent/phases/reverse");
const { exportRecorded } = await import("@/engine/live/recorded");
const db = await getDb();
const run = await repo.getRun(db, runId);
if (!run) throw new Error("run not found");
const events = await repo.listEvents(db, runId);
const cut = events.find((e) => e.type === "phase_completed" && e.phase === "research");
if (!cut) throw new Error("research phase not completed in this run");

// Manus result (optional)
if (manusTaskId) {
  process.env.NEXUS_FORCE_LIVE = "manus";
  const { listMessages, taskState, ManusLandscape, landscapeToEvidence } = await import("@/engine/providers/manus");
  const s = taskState(await listMessages(manusTaskId));
  console.log("manus:", s.state);
  if (s.state === "done" && s.success) {
    const v = ManusLandscape.parse(s.value);
    const brand = (await repo.getBrand(db, run.brandId))!;
    const old = (await repo.listEvidence(db, runId)).filter((e) => e.source === "manus_research");
    const items = landscapeToEvidence(
      { db, runId, brand, demoEvidence: [], limit: 0 },
      v,
      `https://manus.im/app/${manusTaskId}`,
    );
    if (old[0]) items[0].id = old[0].id; // replace the "still running" item in place
    await repo.upsertEvidence(db, items);
    console.log(`manus: ${items.length} evidence items attached`);
  }
}

// drop everything after research, then redo reverse_engineer
if (manusOnly) {
  const spend = await repo.listSpend(db, runId);
  const by: Record<string, number> = {};
  for (const x of spend) by[x.provider] = Math.round(((by[x.provider] ?? 0) + x.usd) * 10000) / 10000;
  console.log("exported:", await exportRecorded(db, runId, by));
  process.exit(0);
}
await db.delete(t.runEvents).where(and(eq(t.runEvents.runId, runId), gt(t.runEvents.seq, cut.id)));
await db.delete(t.blueprints).where(eq(t.blueprints.runId, runId));
await repo.updateRun(db, runId, { status: "running", phase: "reverse_engineer" });
const base = await makeCtx(db, runId, new AbortController().signal);
const ctx = base.forPhase("reverse_engineer");
await ctx.emit("phase_started", "Watching the winners shot by shot");
await reverseEngineer(ctx);
await ctx.emit("phase_completed", "Blueprints ready");
await repo.updateRun(db, runId, { status: "done", finishedAt: new Date().toISOString() });
await repo.appendEvent(db, {
  runId,
  phase: "reverse_engineer",
  type: "status",
  title: "Run complete",
  data: { status: "done" },
});
const bps = await repo.listBlueprints(db, runId);
console.log(
  "blueprints:",
  bps.map((b) => `${b.shots.length} shots ${b.structure} (${b.evidenceId})`),
);
{
  const spend = await repo.listSpend(db, runId);
  const by: Record<string, number> = {};
  for (const s of spend) by[s.provider] = Math.round(((by[s.provider] ?? 0) + s.usd) * 10000) / 10000;
  console.log("exported:", await exportRecorded(db, runId, by));
}
