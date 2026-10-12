import type { ProviderId } from "@/contracts";
import type { Db } from "../db/client";
import { BudgetExceededError, recordSpend, reserve } from "../ledger";
import { appendEvent, getRun } from "../repo";
import { isLive } from "./env";

export interface LiveResult<T> {
  result: T;
  /** actual cost of the call in USD (0 for free APIs) */
  usd: number;
  units?: string;
}

export interface ProviderCall<T> {
  provider: ProviderId;
  /** short description for the ledger, e.g. "messages: research deconstruction" */
  note: string;
  runId?: string;
  /** upper-bound estimate reserved against the cap before the call */
  estimateUsd: number;
  live: () => Promise<LiveResult<T>>;
  demo: () => Promise<T> | T;
  /** called when the cap blocks a live call; the step continues in demo (default: a warning event on the run) */
  onBudgetExceeded?: (err: BudgetExceededError) => Promise<void> | void;
  /** tests only: force a mode without touching env */
  mode?: "live" | "demo";
  budgetOverride?: number;
}

export interface CallOutcome<T> {
  value: T;
  mode: "live" | "demo";
  usd: number;
}

/**
 * The one door every provider call goes through: live only if allowed (key + LIVE_PROVIDERS, never in tests),
 * reserved against the cap, recorded in the ledger. Past the cap the step falls back to demo data.
 */
export async function callProvider<T>(db: Db, c: ProviderCall<T>): Promise<CallOutcome<T>> {
  const live = c.mode ? c.mode === "live" : isLive(c.provider);
  if (!live) return { value: await c.demo(), mode: "demo", usd: 0 };
  let release: (() => void) | undefined;
  try {
    release = await reserve(db, c.provider, c.estimateUsd, c.budgetOverride);
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      if (c.onBudgetExceeded) await c.onBudgetExceeded(e);
      else
        await warnRun(db, c.runId, `${c.provider} budget cap reached: demo data for this step (${c.note})`, e.message);
      return { value: await c.demo(), mode: "demo", usd: 0 };
    }
    throw e;
  }
  try {
    const out = await c.live();
    await recordSpend(db, { provider: c.provider, usd: out.usd, note: c.note, runId: c.runId, units: out.units });
    return { value: out.result, mode: "live", usd: out.usd };
  } finally {
    release();
  }
}

/** A visible warning in the run's event stream (current phase), so a cap hit never silently mixes demo data in. */
async function warnRun(db: Db, runId: string | undefined, title: string, detail: string) {
  if (!runId) return;
  const run = await getRun(db, runId);
  if (run) await appendEvent(db, { runId, phase: run.phase, type: "warning", title, detail });
}
