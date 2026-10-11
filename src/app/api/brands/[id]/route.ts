import { db, handle, json, notFound } from "@/engine/http";
import { getBrand } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/brands/[id]">) => {
  const { id } = await ctx.params;
  const brand = await getBrand(await db(), id);
  if (!brand) throw notFound("Brand");
  return json(brand);
});
