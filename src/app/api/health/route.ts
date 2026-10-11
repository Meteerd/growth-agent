import { CONTRACTS_VERSION } from "@/contracts";
import { db, handle, json } from "@/engine/http";
import { providerStatuses } from "@/engine/providers/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const d = await db();
  return json({ ok: true, version: CONTRACTS_VERSION, providers: await providerStatuses(d) });
});
