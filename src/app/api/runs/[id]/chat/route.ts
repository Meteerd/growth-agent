import { ChatRequest } from "@/contracts";
import { chat } from "@/engine/agent/chat";
import { db, handle, parseBody } from "@/engine/http";
import { SSE_HEADERS, sseFrame } from "@/engine/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSE: `token` {text}, `question` Question, `done` {messageId}, `error` {message}. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/runs/[id]/chat">) => {
  const { id } = await ctx.params;
  const { message } = await parseBody(req, ChatRequest);
  const d = await db();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(sseFrame(event, data));
        } catch {}
      };
      try {
        const { messageId } = await chat(d, id, message, {
          token: (text) => send("token", { text }),
          question: (q) => send("question", q),
        });
        send("done", { messageId });
      } catch (e) {
        send("error", { message: e instanceof Error ? e.message : String(e) });
      }
      try {
        controller.close();
      } catch {}
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
});
