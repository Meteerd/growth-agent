import { z } from "zod";
import { handle, json, notFound, parseBody } from "@/engine/http";
import { sdb } from "@/engine/studio/http";
import { startJob } from "@/engine/studio/jobs";
import { getAd } from "@/engine/studio/store";
import { IMAGE_MODELS } from "@/engine/studio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ feedback: z.string().min(2), model: z.enum(IMAGE_MODELS).optional() });

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/studio/ads/[id]/revise">) => {
  const { id } = await ctx.params;
  const d = await sdb();
  const a = await getAd(d, id);
  if (!a) throw notFound("Ad");
  const b = await parseBody(req, Body);
  const job = await startJob("revise", a.brandId, { adId: id, feedback: b.feedback, model: b.model });
  return json({ jobId: job.id }, 202);
});
