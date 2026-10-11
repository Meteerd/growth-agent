import type { ProviderId, SpendEntry } from "@/contracts";
import type { Db } from "./db/client";
import { newId, nowIso } from "./ids";
import { budgetFor } from "./providers/env";
import { addRunCost, insertSpend, spentByProvider } from "./repo";

export class BudgetExceededError extends Error {
  constructor(
    public provider: ProviderId,
    public budgetUsd: number,
    public spentUsd: number,
    public estimateUsd: number,
  ) {
    super(
      `${provider} budget cap reached: spent $${spentUsd.toFixed(2)} + estimate $${estimateUsd.toFixed(2)} > cap $${budgetUsd.toFixed(2)}`,
    );
  }
}

/** In-flight reservations so parallel calls cannot overshoot a cap together. */
const g = globalThis as unknown as { __nexusReserved?: Map<string, number> };
if (!g.__nexusReserved) g.__nexusReserved = new Map();
const reserved = g.__nexusReserved;

export async function spentFor(db: Db, provider: ProviderId): Promise<number> {
  return (await spentByProvider(db))[provider] ?? 0;
}

/**
 * Reserve `estimateUsd` against the provider's cap or throw BudgetExceededError.
 * Providers without a configured cap (free APIs like YouTube) pass. Returns a release function.
 */
export async function reserve(db: Db, provider: ProviderId, estimateUsd: number, budgetOverride?: number) {
  const budget = budgetOverride ?? budgetFor(provider);
  const spent = await spentFor(db, provider);
  const inFlight = reserved.get(provider) ?? 0;
  if (budget !== undefined && spent + inFlight + estimateUsd > budget) {
    throw new BudgetExceededError(provider, budget, spent + inFlight, estimateUsd);
  }
  reserved.set(provider, inFlight + estimateUsd);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    reserved.set(provider, Math.max(0, (reserved.get(provider) ?? 0) - estimateUsd));
  };
}

export async function recordSpend(
  db: Db,
  e: { provider: ProviderId; usd: number; note: string; runId?: string; units?: string },
): Promise<SpendEntry> {
  const entry: SpendEntry = {
    id: newId("spend"),
    provider: e.provider,
    usd: Math.max(0, Math.round(e.usd * 1e6) / 1e6),
    note: e.note,
    ts: nowIso(),
    ...(e.runId ? { runId: e.runId } : {}),
    ...(e.units ? { units: e.units } : {}),
  };
  await insertSpend(db, entry);
  if (e.runId) await addRunCost(db, e.runId, entry.usd);
  return entry;
}
