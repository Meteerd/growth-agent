import type { SpendResponse } from "@/contracts";
import { db, handle, json } from "@/engine/http";
import { listSpend } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const runId = new URL(req.url).searchParams.get("runId") ?? undefined;
  const entries = await listSpend(await db(), runId);
  const byProvider: Record<string, number> = {};
  for (const e of entries) byProvider[e.provider] = (byProvider[e.provider] ?? 0) + e.usd;
  const totalUsd = entries.reduce((a, e) => a + e.usd, 0);
  return json({ entries, byProvider, totalUsd } satisfies SpendResponse);
});
