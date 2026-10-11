import { ApproveRequest } from "@/contracts";
import { db, handle, json, parseBody } from "@/engine/http";
import { approveShots } from "@/engine/services/concepts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/concepts/[id]/approve">) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, ApproveRequest);
  return json(await approveShots(await db(), id, body.shotIdx));
});
