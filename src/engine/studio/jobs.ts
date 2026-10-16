import { type Db, getDb } from "../db/client";
import { createJob, getJob, listJobsByStatus, updateJob } from "./store";
import type { Job, JobKind } from "./types";

/**
 * In-process background jobs for the studio (one Node process on the server). A job is a row in studio_jobs with
 * a step, a progress fraction and a log, so the UI and the chat agent can follow it. Jobs left "running" by a
 * restart are marked failed on the first call.
 */

export interface JobCtx {
  db: Db;
  job: Job;
  signal: AbortSignal;
  step: (name: string, progress?: number) => Promise<void>;
  log: (msg: string) => Promise<void>;
  cost: (usd: number) => Promise<void>;
  check: () => void;
}

export type JobHandler = (ctx: JobCtx) => Promise<Record<string, unknown> | undefined>;

const g = globalThis as unknown as {
  __studioJobs?: Map<string, AbortController>;
  __studioHandlers?: Map<JobKind, JobHandler>;
  __studioRecovered?: boolean;
};
const running = (g.__studioJobs ??= new Map());
const handlers = (g.__studioHandlers ??= new Map());

export class JobCancelled extends Error {
  constructor() {
    super("Job cancelled");
  }
}

export function registerJob(kind: JobKind, h: JobHandler) {
  handlers.set(kind, h);
}

async function recover(db: Db) {
  if (g.__studioRecovered) return;
  g.__studioRecovered = true;
  for (const j of await listJobsByStatus(db, ["running", "queued"]))
    if (!running.has(j.id))
      await updateJob(db, j.id, { status: "failed", error: "The server restarted while this job was running." });
}

/** Create a job row and run it in the background. Returns immediately. */
export async function startJob(kind: JobKind, brandId: string | null, input: Record<string, unknown>): Promise<Job> {
  const db = await getDb();
  await recover(db);
  await import("./handlers");
  const job = await createJob(db, { brandId, kind, input });
  runJob(db, job);
  return job;
}

/** Run a job inline and wait for it (scripts, the autopilot's sub-steps). */
export async function runJobNow(
  kind: JobKind,
  brandId: string | null,
  input: Record<string, unknown>,
): Promise<Job> {
  const db = await getDb();
  await import("./handlers");
  const job = await createJob(db, { brandId, kind, input });
  await runJob(db, job);
  return (await getJob(db, job.id))!;
}

function runJob(db: Db, job: Job): Promise<void> {
  const h = handlers.get(job.kind);
  const controller = new AbortController();
  running.set(job.id, controller);
  const ctx: JobCtx = {
    db,
    job,
    signal: controller.signal,
    step: async (name, progress) => {
      ctx.check();
      await updateJob(db, job.id, { step: name, ...(progress !== undefined ? { progress } : {}), log: name });
    },
    log: (msg) => updateJob(db, job.id, { log: msg }),
    cost: (usd) => (usd > 0 ? updateJob(db, job.id, { addCost: usd }) : Promise.resolve()),
    check: () => {
      if (controller.signal.aborted) throw new JobCancelled();
    },
  };
  return (async () => {
    try {
      if (!h) throw new Error(`no handler for job kind ${job.kind}`);
      await updateJob(db, job.id, { status: "running" });
      const out = await h(ctx);
      await updateJob(db, job.id, { status: "done", progress: 1, output: out ?? {}, step: "Done" });
    } catch (e) {
      const cancelled = e instanceof JobCancelled || controller.signal.aborted;
      const msg = e instanceof Error ? e.message : String(e);
      await updateJob(db, job.id, {
        status: cancelled ? "cancelled" : "failed",
        error: cancelled ? null : msg,
        log: cancelled ? "Cancelled" : `Failed: ${msg}`,
      });
      if (!cancelled) console.error(`[studio job ${job.kind} ${job.id}]`, e);
    } finally {
      running.delete(job.id);
    }
  })();
}

export function cancelJob(id: string): boolean {
  const c = running.get(id);
  if (!c) return false;
  c.abort();
  return true;
}

export const isJobRunning = (id: string) => running.has(id);
