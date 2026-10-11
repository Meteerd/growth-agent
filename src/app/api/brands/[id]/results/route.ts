import { db, handle, json, notFound } from "@/engine/http";
import { getBrand } from "@/engine/repo";
import { results } from "@/engine/services/packs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Packs with metric snapshots ordered by time, plus learnings (brand + global). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/brands/[id]/results">) => {
  const { id } = await ctx.params;
  const d = await db();
  const brand = await getBrand(d, id);
  if (!brand) throw notFound("Brand");
  return json(await results(d, brand.id));
});
