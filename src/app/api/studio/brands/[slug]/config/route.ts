import { HttpError, handle, json } from "@/engine/http";
import { mustBrand, setConfig } from "@/engine/studio/config";
import { sdb } from "@/engine/studio/http";
import { StudioBrandConfig } from "@/engine/studio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/studio/brands/[slug]/config">) => {
  const { slug } = await ctx.params;
  const d = await sdb();
  const b = await mustBrand(d, slug);
  const patch = StudioBrandConfig.partial().safeParse(await req.json().catch(() => ({})));
  if (!patch.success)
    throw new HttpError(
      400,
      "invalid_body",
      patch.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return json(await setConfig(d, b, patch.data));
});
