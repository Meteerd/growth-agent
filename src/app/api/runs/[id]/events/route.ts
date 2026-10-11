import { db, handle, notFound } from "@/engine/http";
import { getRun } from "@/engine/repo";
import { runEventStream, SSE_HEADERS } from "@/engine/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE stream of RunEvents. Resume with the Last-Event-ID header (or ?lastEventId=). ?pace=<ms> replays stored
 * events with a delay between them (demo playback of a finished run).
 */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/runs/[id]/events">) => {
  const { id } = await ctx.params;
  const d = await db();
  if (!(await getRun(d, id))) throw notFound("Run");
  const url = new URL(req.url);
  const after = Number(req.headers.get("last-event-id") ?? url.searchParams.get("lastEventId") ?? 0) || 0;
  const pace = Number(url.searchParams.get("pace") ?? 0) || 0;
  return new Response(runEventStream(d, id, after, req.signal, { paceMs: pace }), { headers: SSE_HEADERS });
});
