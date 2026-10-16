import { handle, json } from "@/engine/http";
import { mustBrand } from "@/engine/studio/config";
import { sdb } from "@/engine/studio/http";
import { startJob } from "@/engine/studio/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts a analyze job for the brand; the body is the job input. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/studio/brands/[slug]/analyze">) => {
  const { slug } = await ctx.params;
  const d = await sdb();
  const b = await mustBrand(d, slug);
  const input = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const job = await startJob("analyze", b.id, input);
  return json({ jobId: job.id }, 202);
});
