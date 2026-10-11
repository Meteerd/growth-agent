import { db, handle, json } from "@/engine/http";
import { listReviews } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/concepts/[id]/reviews">) => {
  const { id } = await ctx.params;
  return json(await listReviews(await db(), id));
});
