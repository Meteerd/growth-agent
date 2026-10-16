import { z } from "zod";
import { handle, json, notFound, parseBody } from "@/engine/http";
import { sdb } from "@/engine/studio/http";
import { getAd, updateAd } from "@/engine/studio/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/studio/ads/[id]">) => {
  const { id } = await ctx.params;
  const a = await getAd(await sdb(), id);
  if (!a) throw notFound("Ad");
  return json(a);
});

const Patch = z.object({
  status: z.enum(["ready", "approved", "rejected"]).optional(),
  copy: z
    .object({ primaryText: z.string(), headline: z.string(), description: z.string(), cta: z.string() })
    .optional(),
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/studio/ads/[id]">) => {
  const { id } = await ctx.params;
  const d = await sdb();
  const a = await getAd(d, id);
  if (!a) throw notFound("Ad");
  const p = await parseBody(req, Patch);
  await updateAd(d, id, {
    ...(p.status ? { status: p.status } : {}),
    ...(p.copy ? { body: { ...a.body, copy: p.copy } } : {}),
  });
  return json(await getAd(d, id));
});
