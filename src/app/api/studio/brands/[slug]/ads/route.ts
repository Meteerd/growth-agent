import { handle, json } from "@/engine/http";
import { mustBrand } from "@/engine/studio/config";
import { sdb } from "@/engine/studio/http";
import { listAds } from "@/engine/studio/store";
import type { AdStatus } from "@/engine/studio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: RouteContext<"/api/studio/brands/[slug]/ads">) => {
  const { slug } = await ctx.params;
  const d = await sdb();
  const b = await mustBrand(d, slug);
  const status = new URL(req.url).searchParams.get("status") as AdStatus | null;
  return json(await listAds(d, { brandId: b.id, status: status ?? undefined }));
});
