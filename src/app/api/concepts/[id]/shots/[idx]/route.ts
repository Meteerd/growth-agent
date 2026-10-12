import { ShotPatchRequest } from "@/contracts";
import { db, handle, json, parseBody } from "@/engine/http";
import { chooseClip } from "@/engine/revise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A19: pick the clip a shot uses (one of its variants); the next render or revision uses it. */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/concepts/[id]/shots/[idx]">) => {
  const { id, idx } = await ctx.params;
  const { chosenClipId } = await parseBody(req, ShotPatchRequest);
  return json(await chooseClip(await db(), id, Number(idx), chosenClipId));
});
