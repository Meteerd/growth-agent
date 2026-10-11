import type { MetricsRequest } from "@/contracts";

export const METRIC_KEYS = ["views", "likes", "comments", "shares", "saves", "follows"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

/** Form strings to a MetricsRequest. Blank fields are skipped; "3,214" is accepted; anything else is `bad`. */
export function parseMetrics(values: Partial<Record<MetricKey, string>>) {
  const req: MetricsRequest = {};
  const bad: MetricKey[] = [];
  for (const k of METRIC_KEYS) {
    const s = (values[k] ?? "").replace(/[\s,_]/g, "");
    if (!s) continue;
    const n = Number(s);
    if (/^\d+$/.test(s) && Number.isSafeInteger(n)) req[k] = n;
    else bad.push(k);
  }
  return { req, bad, empty: Object.keys(req).length === 0 };
}
