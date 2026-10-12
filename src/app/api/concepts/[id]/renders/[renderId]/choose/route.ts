import { db, handle, json } from "@/engine/http";
import { chooseVersion } from "@/engine/revise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A19: mark a version as chosen (the concept's video and its packs switch to it). */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/concepts/[id]/renders/[renderId]/choose">) => {
  const { id, renderId } = await ctx.params;
  return json(await chooseVersion(await db(), id, renderId));
});
