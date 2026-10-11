import { db, handle } from "@/engine/http";
import { handleRpc } from "@/engine/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** MCP Streamable HTTP endpoint (JSON responses; batches supported). */
export const POST = handle(async (req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }
  const d = await db();
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(d, m)))).filter(Boolean);
    return out.length ? Response.json(out) : new Response(null, { status: 202 });
  }
  const out = await handleRpc(d, body as Parameters<typeof handleRpc>[1]);
  return out ? Response.json(out) : new Response(null, { status: 202 });
});

export const GET = () =>
  new Response("Use POST (MCP Streamable HTTP, JSON responses)", { status: 405, headers: { Allow: "POST" } });
