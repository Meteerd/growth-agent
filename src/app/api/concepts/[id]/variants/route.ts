import { VariantsRequest } from "@/contracts";
import { db, handle, json, notFound, parseBody } from "@/engine/http";
import { getConcept } from "@/engine/repo";
import { listVariants, makeVariants } from "@/engine/revise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A19: alternative clips per shot from fal and Higgsfield, rendered in the background. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/concepts/[id]/variants">) => {
  const { id } = await ctx.params;
  const { providers, shots } = await parseBody(req, VariantsRequest);
  const d = await db();
  if (!(await getConcept(d, id))) throw notFound("Concept");
  void makeVariants(d, id, providers, shots).catch(() => undefined);
  return json({ status: "queued", providers, shots: shots ?? "all" }, 202);
});

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/concepts/[id]/variants">) => {
  const { id } = await ctx.params;
  const d = await db();
  if (!(await getConcept(d, id))) throw notFound("Concept");
  return json(await listVariants(d, id));
});
