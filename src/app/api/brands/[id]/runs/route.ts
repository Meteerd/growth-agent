import type { z } from "zod";
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

// serializes run creation per brand so two simultaneous requests cannot both pass the duplicate check
const creating = new Map<string, Promise<unknown>>();

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/brands/[id]/runs">) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, CreateRunRequest);
  const d = await db();
  const brand = await getBrand(d, id);
  if (!brand) throw notFound("Brand");
  const prev = creating.get(brand.id) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(() => create(d, brand.id, body));
  creating.set(brand.id, next);
  try {
    const { run, created } = await next;
    return json(run, created ? 201 : 200);
  } finally {
    if (creating.get(brand.id) === next) creating.delete(brand.id);
  }
});

async function create(d: Awaited<ReturnType<typeof db>>, brandId: string, body: z.output<typeof CreateRunRequest>) {
  const runs = await listRuns(d, brandId);
  let from: string | undefined;
  if (body.reuseResearchFrom) {
    from =
      body.reuseResearchFrom === "recorded"
        ? runs.find((r) => r.dataset === "live_recorded")?.id
        : (await getRun(d, body.reuseResearchFrom))?.brandId === brandId
          ? body.reuseResearchFrom
          : undefined;
    if (!from) throw new HttpError(404, "no_research", "No research run to reuse for this brand");
  }
  // a double click must not start (and pay for) two identical runs: the same request within 60 s returns the active run
  const dup = runs.find(
    (r) =>
      r.kind === body.kind && ["queued", "running"].includes(r.status) && Date.now() - Date.parse(r.createdAt) < 60_000,
  );
  if (dup) return { run: dup, created: false };
  const run = await createRun(d, brandId, body.kind, { demo: !isLive("anthropic") });
  if (from) await reuseResearch(d, from, run.id);
  startRun(run.id);
  return { run, created: true };
}
