import { handle, json } from "@/engine/http";
import { sdb } from "@/engine/studio/http";
import { cancelJob } from "@/engine/studio/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/studio/jobs/[id]/cancel">) => {
  const { id } = await ctx.params;
  await sdb();
  return json({ cancelled: cancelJob(id) });
});
