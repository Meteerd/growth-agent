import type { Db } from "../db/client";
import { throwIfCancelled } from "../jobs/runner";
import { appendEvent, getRun, updateRun } from "../repo";

/** Phase pipeline. Filled in by A05 to A13; for now it marks the run done so new brands do not hang. */
export async function runPipeline(db: Db, runId: string, signal: AbortSignal): Promise<void> {
  const run = await getRun(db, runId);
  if (!run) throw new Error(`Run ${runId} not found`);
  throwIfCancelled(signal);
  await updateRun(db, runId, { status: "running", startedAt: run.startedAt ?? new Date().toISOString() });
  await appendEvent(db, { runId, phase: run.phase, type: "status", title: "Run started", data: { status: "running" } });
  await updateRun(db, runId, { status: "done", finishedAt: new Date().toISOString() });
  await appendEvent(db, { runId, phase: run.phase, type: "status", title: "Run complete", data: { status: "done" } });
}
