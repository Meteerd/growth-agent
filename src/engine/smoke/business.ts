import type { Db } from "../db/client";
import { databricksTables, posthogTruth, revenuecatOverview } from "../providers/business";
import { isLive } from "../providers/env";

/**
 * Business connectors smoke (read-only). The numbers belong to a private brand (CONNECTOR_BRAND): printed to the
 * console only, never recorded into the repo's fixtures.
 */
export async function smokeRevenuecat(db: Db) {
  const r = await revenuecatOverview(db);
  return {
    mode: isLive("revenuecat") && r ? ("live" as const) : ("demo" as const),
    usd: 0,
    project: r?.project,
    metrics: r?.metrics.map((m) => `${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ""}`),
  };
}

export async function smokePosthog(db: Db) {
  const r = await posthogTruth(db);
  return {
    mode: isLive("posthog") && r ? ("live" as const) : ("demo" as const),
    usd: 0,
    topEvents: r?.topEvents.slice(0, 8),
    referrers: r?.referrers.slice(0, 5),
    utmSources: r?.utmSources.slice(0, 5),
    days: r?.dailyUsers.length,
  };
}

export async function smokeDatabricks(db: Db) {
  const r = await databricksTables(db);
  return {
    mode: isLive("databricks") && r ? ("live" as const) : ("demo" as const),
    usd: 0.01,
    tables: r?.rows.slice(0, 40).map((x) => x.slice(0, 3).join(".")),
  };
}
