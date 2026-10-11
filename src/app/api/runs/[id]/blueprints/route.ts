import { db, handle, json } from "@/engine/http";
import { listBlueprints } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/runs/[id]/blueprints">) => {
  const { id } = await ctx.params;
  return json(await listBlueprints(await db(), id));
});
