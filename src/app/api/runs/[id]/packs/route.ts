import { db, handle, json } from "@/engine/http";
import { listPacksByRun } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/runs/[id]/packs">) => {
  const { id } = await ctx.params;
  return json(await listPacksByRun(await db(), id));
});
