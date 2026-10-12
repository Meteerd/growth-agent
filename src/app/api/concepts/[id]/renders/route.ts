import { db, handle, json, notFound } from "@/engine/http";
import { getConcept } from "@/engine/repo";
import { ensureVersions } from "@/engine/revise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A19: every render version of a concept, oldest first (the original cut is v1). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/concepts/[id]/renders">) => {
  const { id } = await ctx.params;
  const d = await db();
  const c = await getConcept(d, id);
  if (!c) throw notFound("Concept");
  return json(await ensureVersions(d, c));
});
