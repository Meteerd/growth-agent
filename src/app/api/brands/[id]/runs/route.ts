import { CreateRunRequest } from "@/contracts";
import { db, HttpError, handle, json, notFound, parseBody } from "@/engine/http";
import { startRun } from "@/engine/jobs/runner";
import { reuseResearch } from "@/engine/live/recorded";
import { isLive } from "@/engine/providers/env";
import { getBrand, getRun, listRuns } from "@/engine/repo";
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
  let from: string | undefined;
  if (body.reuseResearchFrom) {
    const runs = await listRuns(d, brand.id);
    from =
      body.reuseResearchFrom === "recorded"
        ? runs.find((r) => r.dataset === "live_recorded")?.id
        : (await getRun(d, body.reuseResearchFrom))?.brandId === brand.id
          ? body.reuseResearchFrom
          : undefined;
    if (!from) throw new HttpError(404, "no_research", "No research run to reuse for this brand");
  }
  const run = await createRun(d, brand.id, body.kind, { demo: !isLive("anthropic") });
  if (from) await reuseResearch(d, from, run.id);
  startRun(run.id);
  return json(run, 201);
});
