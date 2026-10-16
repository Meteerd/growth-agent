import { handle, json, notFound } from "@/engine/http";
import { sdb } from "@/engine/studio/http";
import { getJob } from "@/engine/studio/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/studio/jobs/[id]">) => {
  const { id } = await ctx.params;
  const j = await getJob(await sdb(), id);
  if (!j) throw notFound("Job");
  return json(j);
});
