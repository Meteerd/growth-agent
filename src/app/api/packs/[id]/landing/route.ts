import { db, handle, json } from "@/engine/http";
import { buildLanding } from "@/engine/services/landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ask Manus to build a landing page for this pack (never published by us). Returns the pack with landingUrl. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/packs/[id]/landing">) => {
  const { id } = await ctx.params;
  return json(await buildLanding(await db(), id), 202);
});
