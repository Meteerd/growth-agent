import type { Db } from "../db/client";
import { saveFixture } from "./record";

/**
 * Free credential check (no generation): GET /requests/<unknown id>/status with each documented key format.
 * 401 = credentials rejected; 404/422/200 = the format is accepted. Records which format works.
 */
export async function smokeHiggsfield(_db: Db) {
  const key = process.env.HIGGSFIELD_API_KEY ?? "";
  const secret = process.env.HIGGSFIELD_API_SECRET ?? "";
  const variants: { name: string; headers: Record<string, string> }[] = [
    ...(secret ? [{ name: "Key id:secret (env pair)", headers: { Authorization: `Key ${key}:${secret}` } }] : []),
    { name: "Key <single key>", headers: { Authorization: `Key ${key}` } },
    ...(key.includes(":") ? [] : [{ name: "Bearer <single key>", headers: { Authorization: `Bearer ${key}` } }]),
    ...(secret ? [{ name: "legacy hf-api-key + hf-secret", headers: { "hf-api-key": key, "hf-secret": secret } }] : []),
  ];
  const results: { name: string; status: number; body: string }[] = [];
  for (const v of variants) {
    const r = await fetch("https://api.higgsfield.ai/requests/00000000-0000-0000-0000-000000000000/status", {
      headers: v.headers,
    });
    results.push({ name: v.name, status: r.status, body: (await r.text()).slice(0, 160) });
  }
  const works = results.find((r) => r.status !== 401 && r.status !== 403);
  const file = saveFixture("higgsfield", "auth_check", { results, works: works?.name ?? null });
  return { mode: "live" as const, usd: 0, file, works: works?.name ?? "none (all 401/403)", results };
}
