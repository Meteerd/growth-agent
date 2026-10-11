import { PostedRequest } from "@/contracts";
import { db, handle, json, parseBody } from "@/engine/http";
import { markPosted } from "@/engine/services/packs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/packs/[id]/posted">) => {
  const { id } = await ctx.params;
  return json(await markPosted(await db(), id, await parseBody(req, PostedRequest)));
});
