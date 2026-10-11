import { PatchPlanRequest } from "@/contracts";
import { patchPlan } from "@/engine/agent/phases/direction";
import { db, handle, json, notFound, parseBody } from "@/engine/http";
import { getLatestPlan } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/runs/[id]/plan">) => {
  const { id } = await ctx.params;
  const plan = await getLatestPlan(await db(), id);
  if (!plan) throw notFound("Plan");
  return json(plan);
});

/** Reorder or drop channels; returns the new plan version. */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/runs/[id]/plan">) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, PatchPlanRequest);
  return json(await patchPlan(await db(), id, body));
});
