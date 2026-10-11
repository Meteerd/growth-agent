import { CreateRunRequest } from "@/contracts";
import { db, handle, json, notFound, parseBody } from "@/engine/http";
import { startRun } from "@/engine/jobs/runner";
import { isLive } from "@/engine/providers/env";
import { getBrand, listRuns } from "@/engine/repo";
import { createRun } from "@/engine/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/brands/[id]/runs">) => {
  const { id } = await ctx.params;
  const d = await db();
  const brand = await getBrand(d, id);
  if (!brand) throw notFound("Brand");
  return json(await listRuns(d, brand.id));
});

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/brands/[id]/runs">) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, CreateRunRequest);
  const d = await db();
  const brand = await getBrand(d, id);
  if (!brand) throw notFound("Brand");
  const run = await createRun(d, brand.id, body.kind, { demo: !isLive("anthropic") });
  startRun(run.id);
  return json(run, 201);
});
