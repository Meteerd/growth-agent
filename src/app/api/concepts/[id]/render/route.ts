import { RenderRequest } from "@/contracts";
import { db, HttpError, handle, json, notFound, parseBody } from "@/engine/http";
import { getConcept, upsertConcept } from "@/engine/repo";
import { estimateRender, renderConcept } from "@/engine/services/concepts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts a render in the background and returns the cost estimate at once; progress arrives as run events. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/concepts/[id]/render">) => {
  const { id } = await ctx.params;
  const { tier } = await parseBody(req, RenderRequest);
  const d = await db();
  const c = await getConcept(d, id);
  if (!c) throw notFound("Concept");
  if (c.compliance === "fail")
    throw new HttpError(409, "compliance_failed", "Rendering is blocked: the concept failed compliance");
  if (c.status === "rendering")
    throw new HttpError(409, "already_rendering", "A render is already running for this concept");
  const est = estimateRender(c, tier);
  const next = { ...c, status: "rendering" as const, estimatedCostUsd: est.totalUsd };
  await upsertConcept(d, next);
  void renderConcept(d, id, tier, { label: tier }).catch(() => undefined);
  return json({ concept: next, estimatedCostUsd: est.totalUsd, lines: est.lines }, 202);
});
