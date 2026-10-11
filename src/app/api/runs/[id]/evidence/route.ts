import { db, handle, json } from "@/engine/http";
import { listEvidence } from "@/engine/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: RouteContext<"/api/runs/[id]/evidence">) => {
  const { id } = await ctx.params;
  const q = new URL(req.url).searchParams;
  return json(
    await listEvidence(await db(), id, { source: q.get("source") ?? undefined, kind: q.get("kind") ?? undefined }),
  );
});
