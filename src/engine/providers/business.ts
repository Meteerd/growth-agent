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
      // one query at a time: PostHog allows 3 concurrent queries per project
      const ev = await hogql(
        `select event, count() as c from events where ${since} group by event order by c desc limit 15`,
      );
      const ref = await hogql(
        `select properties.$referring_domain as d, count(distinct person_id) as u from events where ${since} and event = '$pageview' group by d order by u desc limit 10`,
      );
      const utm = await hogql(
        `select properties.utm_source as s, count(distinct person_id) as u from events where ${since} and properties.utm_source is not null group by s order by u desc limit 10`,
      );
      const dau = await hogql(
        `select toDate(timestamp) as d, count(distinct person_id) as u from events where ${since} group by d order by d`,
      );
      return {
        result: { topEvents: pairs(ev), referrers: pairs(ref), utmSources: pairs(utm), dailyUsers: pairs(dau) },
        usd: 0,
      };
    },
  });
  return out.value;
}

// ---------------------------------------------------------------- Databricks

const WRITE =
  /\b(insert|update|delete|merge|drop|create|alter|grant|revoke|copy|truncate|replace|optimize|vacuum|call|set|use|refresh|restore|msck|load|put|remove|undrop)\b/i;

/** Read-only guard: one statement, starting with SELECT/SHOW/DESCRIBE/WITH, no write keyword outside strings/comments. */
export function readOnlySql(statement: string): boolean {
  const bare = statement
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^'\\]|\\.|'')*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`[^`]*`/g, "``")
    .trim()
    .replace(/;\s*$/, "");
  if (bare.includes(";")) return false;
  if (!/^(select|show|describe|desc|with)\b/i.test(bare)) return false;
  return !WRITE.test(bare);
}

interface StatementRes {
  statement_id?: string;
  status: { state: string; error?: { message?: string } };
  manifest?: { schema?: { columns?: { name: string }[] }; truncated?: boolean; total_row_count?: number };
  result?: { data_array?: unknown[][] };
}

export async function databricksQuery(db: Db, statement: string, runId?: string) {
  if (!readOnlySql(statement)) throw new Error("databricks: read-only (one SELECT/SHOW/DESCRIBE statement)");
  const out = await callProvider(db, {
    provider: "databricks",
    note: `sql: ${statement.slice(0, 60)}`,
    runId,
    // serverless SQL warehouse time; small queries are cents at most
    estimateUsd: 0.05,
    demo: () => null as { columns: string[]; rows: unknown[][]; truncated: boolean } | null,
    live: async () => {
      const host = (process.env.DATABRICKS_HOST ?? "").replace(/\/$/, "").replace(/^(?!https?:\/\/)/, "https://");
      const h = { Authorization: `Bearer ${process.env.DATABRICKS_TOKEN}`, "content-type": "application/json" };
      let r = await okJson<StatementRes>(
        await fetchRetry(`${host}/api/2.0/sql/statements`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({
            statement,
            warehouse_id: process.env.DATABRICKS_WAREHOUSE_ID,
            ...(process.env.DATABRICKS_CATALOG ? { catalog: process.env.DATABRICKS_CATALOG } : {}),
            ...(process.env.DATABRICKS_SCHEMA ? { schema: process.env.DATABRICKS_SCHEMA } : {}),
            // a stopped warehouse takes a while to start: keep the statement running and poll it
            wait_timeout: "30s",
            on_wait_timeout: "CONTINUE",
            format: "JSON_ARRAY",
            disposition: "INLINE",
            row_limit: 200,
          }),
          timeoutMs: 45_000,
        }),
        "databricks statement",
      );
      const until = Date.now() + 3 * 60_000;
      while (["PENDING", "RUNNING"].includes(r.status.state) && r.statement_id) {
        if (Date.now() > until) {
          await fetchRetry(`${host}/api/2.0/sql/statements/${r.statement_id}/cancel`, {
            method: "POST",
            headers: h,
          }).catch(() => undefined);
          throw new Error("databricks: statement still running after 3 min (cancelled)");
        }
        await new Promise((res) => setTimeout(res, 3000));
        r = await okJson<StatementRes>(
          await fetchRetry(`${host}/api/2.0/sql/statements/${r.statement_id}`, { headers: h, timeoutMs: 30_000 }),
          "databricks status",
        );
      }
      if (r.status.state !== "SUCCEEDED")
        throw new Error(`databricks: ${r.status.state} ${r.status.error?.message ?? ""}`);
      return {
        result: {
          columns: (r.manifest?.schema?.columns ?? []).map((c) => c.name),
          rows: r.result?.data_array ?? [],
          truncated: !!r.manifest?.truncated,
        },
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
export async function businessEvidence(
  db: Db,
  brand: Brand,
  runId: string,
  warn: (title: string, detail: string) => Promise<unknown> = async () => undefined,
): Promise<Evidence[]> {
  const anyKey = ["REVENUECAT_API_KEY", "POSTHOG_API_KEY", "DATABRICKS_TOKEN"].some((k) =>
    (process.env[k] ?? "").trim(),
  );
  if (!connectorBrand()) {
    if (anyKey)
      await warn(
        "Business connector keys are set but CONNECTOR_BRAND is not",
        "Set CONNECTOR_BRAND=<brand slug> in .env so RevenueCat/PostHog/Databricks numbers go to that brand (and only that brand).",
      );
    return [];
  }
  if (connectorBrand() !== brand.slug) return [];
  const fail = (provider: string) => async (e: unknown) => {
    await warn(`${provider} connector failed: continuing without it`, e instanceof Error ? e.message : String(e));
    return null;
  };
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
  const rc = await revenuecatOverview(db, runId).catch(fail("RevenueCat"));
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
  const ph = await posthogTruth(db, runId).catch(fail("PostHog"));
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
  const tables = await databricksTables(db, runId).catch(fail("Databricks"));
  if (tables?.rows.length)
    out.push(
      base(
        "tables",
        "databricks",
        "Databricks tables (live)",
        `Tables: ${tables.rows.map((r) => `${r[0]}.${r[1]}.${r[2]}`).join(", ")}${tables.truncated ? " (list truncated at 200)" : ""}`,
      ),
    );
  return out;
}
