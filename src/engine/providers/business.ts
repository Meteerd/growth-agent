import type { Brand, Evidence } from "@/contracts";
import type { Db } from "../db/client";
import { nowIso } from "../ids";
import { callProvider } from "./call";
import { fetchRetry, okJson } from "./http";

/**
 * Business-truth connectors (read-only): RevenueCat (API v2 overview metrics), PostHog (HogQL over the last 30
 * days: top events, referrers, UTM sources) and Databricks (SQL Statement Execution API, SELECT/SHOW/DESCRIBE
 * only). The keys in .env belong to ONE brand: CONNECTOR_BRAND (slug) names it, and no other brand ever gets
 * these numbers. Results become compact `metric` evidence for that brand's research. Private brands
 * (CONNECTOR_BRAND) are excluded from the public showcase export.
 */
export const connectorBrand = () => (process.env.CONNECTOR_BRAND ?? "").trim().toLowerCase();

// ---------------------------------------------------------------- RevenueCat

export interface RcMetric {
  id: string;
  name: string;
  value: number;
  unit?: string;
  period?: string;
}

export async function revenuecatOverview(
  db: Db,
  runId?: string,
): Promise<{ project: string; metrics: RcMetric[] } | null> {
  const out = await callProvider(db, {
    provider: "revenuecat",
    note: "overview metrics",
    runId,
    estimateUsd: 0,
    demo: () => null,
    live: async () => {
      const h = { Authorization: `Bearer ${process.env.REVENUECAT_API_KEY}` };
      let project = process.env.REVENUECAT_PROJECT_ID ?? "";
      if (!project) {
        const p = await okJson<{ items: { id: string; name: string }[] }>(
          await fetchRetry("https://api.revenuecat.com/v2/projects", { headers: h, timeoutMs: 20_000 }),
          "revenuecat projects",
        );
        project = p.items?.[0]?.id ?? "";
      }
      if (!project) throw new Error("revenuecat: no project (set REVENUECAT_PROJECT_ID)");
      const r = await okJson<{ metrics: RcMetric[] }>(
        await fetchRetry(`https://api.revenuecat.com/v2/projects/${project}/metrics/overview`, {
          headers: h,
          timeoutMs: 20_000,
        }),
        "revenuecat overview",
      );
      return { result: { project, metrics: r.metrics ?? [] }, usd: 0 };
    },
  });
  return out.value;
}

// ---------------------------------------------------------------- PostHog

async function hogql(query: string): Promise<{ columns: string[]; results: unknown[][] }> {
  const host = (process.env.POSTHOG_HOST || "https://eu.posthog.com").replace(/\/$/, "");
  return okJson(
    await fetchRetry(`${host}/api/projects/${process.env.POSTHOG_PROJECT_ID}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.POSTHOG_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      timeoutMs: 60_000,
    }),
    "posthog query",
  );
}

export interface PosthogTruth {
  topEvents: [string, number][];
  referrers: [string, number][];
  utmSources: [string, number][];
  dailyUsers: [string, number][];
}

export async function posthogTruth(db: Db, runId?: string): Promise<PosthogTruth | null> {
  const out = await callProvider(db, {
    provider: "posthog",
    note: "HogQL: events, referrers, sources (30 days)",
    runId,
    estimateUsd: 0,
    demo: () => null,
    live: async () => {
      const pairs = (r: { results: unknown[][] }) =>
        r.results.map((x) => [String(x[0] ?? "(none)"), Number(x[1])] as [string, number]);
      const since = "timestamp > now() - interval 30 day";
      const [ev, ref, utm, dau] = await Promise.all([
        hogql(`select event, count() as c from events where ${since} group by event order by c desc limit 15`),
        hogql(
          `select properties.$referring_domain as d, count(distinct person_id) as u from events where ${since} and event = '$pageview' group by d order by u desc limit 10`,
        ),
        hogql(
          `select properties.utm_source as s, count(distinct person_id) as u from events where ${since} and properties.utm_source is not null group by s order by u desc limit 10`,
        ),
        hogql(
          `select toDate(timestamp) as d, count(distinct person_id) as u from events where ${since} group by d order by d`,
        ),
      ]);
      return {
        result: { topEvents: pairs(ev), referrers: pairs(ref), utmSources: pairs(utm), dailyUsers: pairs(dau) },
        usd: 0,
      };
    },
  });
  return out.value;
}

// ---------------------------------------------------------------- Databricks

const READ_ONLY = /^\s*(select|show|describe|desc|with)\b/i;

export async function databricksQuery(db: Db, statement: string, runId?: string) {
  if (!READ_ONLY.test(statement) || /;\s*\S/.test(statement))
    throw new Error("databricks: read-only (one SELECT/SHOW/DESCRIBE statement)");
  const out = await callProvider(db, {
    provider: "databricks",
    note: `sql: ${statement.slice(0, 60)}`,
    runId,
    // serverless SQL warehouse time; small queries are cents at most
    estimateUsd: 0.05,
    demo: () => null as { columns: string[]; rows: unknown[][] } | null,
    live: async () => {
      const host = (process.env.DATABRICKS_HOST ?? "").replace(/\/$/, "").replace(/^(?!https?:\/\/)/, "https://");
      const r = await okJson<{
        status: { state: string; error?: { message?: string } };
        manifest?: { schema?: { columns?: { name: string }[] } };
        result?: { data_array?: unknown[][] };
      }>(
        await fetchRetry(`${host}/api/2.0/sql/statements`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.DATABRICKS_TOKEN}`, "content-type": "application/json" },
          body: JSON.stringify({
            statement,
            warehouse_id: process.env.DATABRICKS_WAREHOUSE_ID,
            wait_timeout: "50s",
            on_wait_timeout: "CANCEL",
            format: "JSON_ARRAY",
            disposition: "INLINE",
            row_limit: 500,
          }),
          timeoutMs: 70_000,
        }),
        "databricks statement",
      );
      if (r.status.state !== "SUCCEEDED")
        throw new Error(`databricks: ${r.status.state} ${r.status.error?.message ?? ""}`);
      return {
        result: { columns: (r.manifest?.schema?.columns ?? []).map((c) => c.name), rows: r.result?.data_array ?? [] },
        usd: 0.01,
      };
    },
  });
  return out.value;
}

export async function databricksTables(db: Db, runId?: string) {
  return databricksQuery(
    db,
    "select table_catalog, table_schema, table_name, table_type from system.information_schema.tables where table_schema not in ('information_schema') and table_catalog not in ('system', 'samples') order by 1, 2, 3 limit 200",
    runId,
  );
}

// ---------------------------------------------------------------- evidence

const fmt = (n: number) =>
  Math.abs(n) >= 1000 ? Math.round(n).toLocaleString("en-US") : String(Math.round(n * 100) / 100);

/** The brand's own numbers as compact evidence (only for CONNECTOR_BRAND; never mixed into another brand). */
export async function businessEvidence(db: Db, brand: Brand, runId: string): Promise<Evidence[]> {
  if (!connectorBrand() || connectorBrand() !== brand.slug) return [];
  const out: Evidence[] = [];
  const at = nowIso();
  const base = (id: string, source: Evidence["source"], title: string, text: string): Evidence => ({
    id: `ev_${brand.slug}_${source}_${id}`,
    brandId: brand.id,
    runId,
    source,
    kind: "metric",
    title,
    text,
    metrics: {},
    tags: ["business_truth", "private"],
    capturedAt: at,
    demo: false,
  });
  const rc = await revenuecatOverview(db, runId).catch(() => null);
  if (rc?.metrics.length)
    out.push(
      base(
        "overview",
        "revenuecat",
        "RevenueCat overview (live)",
        rc.metrics
          .map(
            (m) =>
              `${m.name}: ${fmt(m.value)}${m.unit && m.unit !== "#" ? ` ${m.unit}` : ""}${m.period ? ` (${m.period})` : ""}`,
          )
          .join("; "),
      ),
    );
  const ph = await posthogTruth(db, runId).catch(() => null);
  if (ph)
    out.push(
      base(
        "30d",
        "posthog",
        "PostHog last 30 days (live)",
        [
          `Top events: ${ph.topEvents.map(([e, c]) => `${e} ${fmt(c)}`).join(", ")}`,
          `Referrers (users): ${ph.referrers.map(([d, c]) => `${d} ${fmt(c)}`).join(", ")}`,
          ph.utmSources.length
            ? `UTM sources (users): ${ph.utmSources.map(([d, c]) => `${d} ${fmt(c)}`).join(", ")}`
            : "",
          ph.dailyUsers.length
            ? `Daily users: first ${fmt(ph.dailyUsers[0]![1])}, last ${fmt(ph.dailyUsers.at(-1)![1])}, peak ${fmt(Math.max(...ph.dailyUsers.map((d) => d[1])))}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
  const tables = await databricksTables(db, runId).catch(() => null);
  if (tables?.rows.length)
    out.push(
      base(
        "tables",
        "databricks",
        "Databricks tables (live)",
        `Tables: ${tables.rows.map((r) => `${r[0]}.${r[1]}.${r[2]}`).join(", ")}`,
      ),
    );
  return out;
}
