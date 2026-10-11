import { db, handle, json } from "@/engine/http";
import { listAssets } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/concepts/[id]/assets">) => {
  const { id } = await ctx.params;
  return json(await listAssets(await db(), id));
});
