import { MetricsRequest } from "@/contracts";
import { db, handle, json, parseBody } from "@/engine/http";
import { addMetrics } from "@/engine/services/packs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/packs/[id]/metrics">) => {
  const { id } = await ctx.params;
  return json(await addMetrics(await db(), id, await parseBody(req, MetricsRequest)), 201);
});
