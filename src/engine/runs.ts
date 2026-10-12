import type { Phase, Run, RunKind, RunStatus } from "@/contracts";
import type { Db } from "./db/client";
import { HttpError } from "./http";
import { newId, nowIso } from "./ids";
import { isLive } from "./providers/env";
import { appendEvent, getRun, updateRun, upsertRun } from "./repo";

const ALLOWED: Record<RunStatus, RunStatus[]> = {
  queued: ["running", "cancelled", "failed"],
  running: ["waiting_input", "done", "failed", "cancelled"],
  waiting_input: ["running", "cancelled", "failed"],
  done: [],
  failed: [],
  cancelled: [],
};

export const TERMINAL: RunStatus[] = ["done", "failed", "cancelled"];

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return from === to || ALLOWED[from].includes(to);
}

/** Move a run through its state machine and log a `status` event. Throws on an illegal transition. */
export async function setStatus(
  db: Db,
  runId: string,
  to: RunStatus,
  title?: string,
  extra: Partial<Run> = {},
): Promise<Run> {
  const run = await getRun(db, runId);
  if (!run) throw new HttpError(404, "not_found", "Run not found");
  if (!canTransition(run.status, to))
    throw new HttpError(409, "bad_transition", `Run is ${run.status}, cannot become ${to}`);
  if (run.status === to && !Object.keys(extra).length) return run;
  const patch: Partial<Run> = { ...extra, status: to };
  if (to === "running" && !run.startedAt) patch.startedAt = nowIso();
  if (TERMINAL.includes(to)) patch.finishedAt = nowIso();
  const next = (await updateRun(db, runId, patch))!;
  if (run.status !== to) {
    await appendEvent(db, {
      runId,
      phase: next.phase,
      type: "status",
      title: title ?? defaultTitle(to),
      data: { status: to },
    });
  }
  return next;
}

function defaultTitle(s: RunStatus): string {
  return {
    queued: "Queued",
    running: "Running",
    waiting_input: "Waiting for your answers",
    done: "Run complete",
    failed: "Run failed",
    cancelled: "Run cancelled",
  }[s];
}

export async function setPhase(db: Db, runId: string, phase: Phase): Promise<void> {
  await updateRun(db, runId, { phase });
}

export async function createRun(db: Db, brandId: string, kind: RunKind, opts: { demo?: boolean } = {}): Promise<Run> {
  const run: Run = {
    id: newId("run"),
    brandId,
    kind,
    status: "queued",
    phase: kind === "production_only" ? "production" : "intake",
    costUsd: 0,
    demo: opts.demo ?? !isLive("anthropic"),
    createdAt: nowIso(),
  };
  await upsertRun(db, run);
  return run;
}
