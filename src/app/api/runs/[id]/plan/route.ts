import { db, handle, json, notFound } from "@/engine/http";
import { getLatestPlan } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/runs/[id]/plan">) => {
  const { id } = await ctx.params;
  const plan = await getLatestPlan(await db(), id);
  if (!plan) throw notFound("Plan");
  return json(plan);
});
