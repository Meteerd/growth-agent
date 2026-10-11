import { db, handle, json } from "@/engine/http";
import { providerStatuses } from "@/engine/providers/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => json(await providerStatuses(await db())));
