import type { Run } from "@/contracts";
import { getDb } from "../db/client";
import { appendEvent, getRun, listEvents, listRunsByStatus, updateRun } from "../repo";
import { heartbeatAge } from "./heartbeat";

/**
 * In-process job runner. One async task per run inside the Node process (fine on localhost).
 * The pipeline itself lives in ../agent/pipeline and is loaded lazily to keep route bundles small.
 */

export class RunCancelled extends Error {
  constructor() {
    super("Run cancelled");
  }
}

interface Job {
  runId: string;
  controller: AbortController;
  promise: Promise<void>;
}

const g = globalThis as unknown as { __nexusJobs?: Map<string, Job>; __nexusResumed?: boolean };
if (!g.__nexusJobs) g.__nexusJobs = new Map<string, Job>();
const jobs = g.__nexusJobs;

export function isRunning(runId: string): boolean {
  return jobs.has(runId);
}

/** Start (or resume) a run in the background. No-op if it is already running in this process. */
export function startRun(runId: string): void {
  if (jobs.has(runId)) return;
  const controller = new AbortController();
  const promise = (async () => {
    const db = await getDb();
    try {
      const { runPipeline } = await import("../agent/pipeline");
      await runPipeline(db, runId, controller.signal);
    } catch (e) {
      const cancelled = e instanceof RunCancelled || controller.signal.aborted;
      const run = await getRun(db, runId);
      if (run && !["done", "cancelled", "failed"].includes(run.status)) {
        const status: Run["status"] = cancelled ? "cancelled" : "failed";
        const error = cancelled ? undefined : e instanceof Error ? e.message : String(e);
        await updateRun(db, runId, { status, error, finishedAt: new Date().toISOString() });
        await appendEvent(db, {
          runId,
          phase: run.phase,
          type: cancelled ? "status" : "error",
          title: cancelled ? "Run cancelled" : `Run failed: ${error}`,
          data: { status },
        });
      }
      if (!cancelled) console.error(`[runner] ${runId}`, e);
    } finally {
      jobs.delete(runId);
    }
  })();
  jobs.set(runId, { runId, controller, promise });
}

export function cancelJob(runId: string): boolean {
  const j = jobs.get(runId);
  if (!j) return false;
  j.controller.abort();
  return true;
}

/** Await a running job (tests). */
export async function waitForRun(runId: string): Promise<void> {
  await jobs.get(runId)?.promise;
}

/**
 * On first use after a server restart, resume runs that were mid-flight (AS3). Only runs whose last event is
 * older than `staleMs` are resumed, so a run being driven by another process (e.g. a live-pass script) is left alone.
 * Each completed phase is skipped on resume; the interrupted phase restarts.
 */
export async function resumeInterruptedRuns(staleMs = 120_000): Promise<string[]> {
  if (g.__nexusResumed) return [];
  g.__nexusResumed = true;
  const db = await getDb();
  const runs = await listRunsByStatus(db, ["queued", "running"]);
  const resumed: string[] = [];
  for (const r of runs) {
    if (jobs.has(r.id)) continue;
    const last = (await listEvents(db, r.id)).at(-1);
    const age = Date.now() - Date.parse(last?.ts ?? r.createdAt);
    if (age < staleMs) continue;
    // another process is still driving it (its heartbeat is fresh): leave it alone
    if (heartbeatAge(r.id) < 60_000) continue;
    if (age > 6 * 3600_000) {
      // abandoned long ago: never resume (and spend) on a cold start
      await updateRun(db, r.id, {
        status: "failed",
        error: "Interrupted more than 6 hours ago; not resumed",
        finishedAt: new Date().toISOString(),
      });
      await appendEvent(db, {
        runId: r.id,
        phase: r.phase,
        type: "error",
        title: "Interrupted more than 6 hours ago; not resumed",
        data: { status: "failed" },
      });
      continue;
    }
    await appendEvent(db, {
      runId: r.id,
      phase: r.phase,
      type: "warning",
      title: "Server restarted: resuming this run from its last completed phase",
    });
    startRun(r.id);
    resumed.push(r.id);
  }
  return resumed;
}

export function throwIfCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new RunCancelled();
}
