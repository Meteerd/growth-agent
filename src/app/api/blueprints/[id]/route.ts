import { db, handle, json, notFound } from "@/engine/http";
import { getBlueprint, getEvidence } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/blueprints/[id]">) => {
  const { id } = await ctx.params;
  const d = await db();
  const bp = await getBlueprint(d, id);
  if (!bp) throw notFound("Blueprint");
  const evidence = await getEvidence(d, bp.evidenceId);
  return json({ ...bp, ...(evidence ? { evidence } : {}) });
});
