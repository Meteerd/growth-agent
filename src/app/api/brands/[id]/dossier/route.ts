import { PatchDossierRequest } from "@/contracts";
import { db, handle, json, notFound, parseBody } from "@/engine/http";
import { getBrand, patchDossier } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Operator edits: the touched fields are locked against later crawls. */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/brands/[id]/dossier">) => {
  const { id } = await ctx.params;
  const patch = await parseBody(req, PatchDossierRequest);
  const d = await db();
  const brand = await getBrand(d, id);
  if (!brand) throw notFound("Brand");
  return json(await patchDossier(d, brand.id, patch, "operator"));
});
