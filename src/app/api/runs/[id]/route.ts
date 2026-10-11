import { db, handle, json, notFound } from "@/engine/http";
import { getRun } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/runs/[id]">) => {
  const { id } = await ctx.params;
  const run = await getRun(await db(), id);
  if (!run) throw notFound("Run");
  return json(run);
});
