import { db, handle, json, notFound } from "@/engine/http";
import { cancelJob } from "@/engine/jobs/runner";
import { getRun } from "@/engine/repo";
import { setStatus, TERMINAL } from "@/engine/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/runs/[id]/cancel">) => {
  const { id } = await ctx.params;
  const d = await db();
  const run = await getRun(d, id);
  if (!run) throw notFound("Run");
  if (TERMINAL.includes(run.status)) return json(run);
  cancelJob(id);
  return json(await setStatus(d, id, "cancelled", "Cancelled by operator"));
});
