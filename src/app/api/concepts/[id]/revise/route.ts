import { ReviseRequest } from "@/contracts";
import { db, handle, json, parseBody } from "@/engine/http";
import { revise } from "@/engine/revise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A19: a chat command on a render -> one clarifying question, or an edit plan and a new version rendering. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/concepts/[id]/revise">) => {
  const { id } = await ctx.params;
  const { message, fromRenderId } = await parseBody(req, ReviseRequest);
  const r = await revise(await db(), id, message, fromRenderId);
  return json(r, r.status === "queued" ? 202 : 200);
});
