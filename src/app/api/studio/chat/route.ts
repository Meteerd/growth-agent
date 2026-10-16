import { z } from "zod";
import { handle, json, parseBody } from "@/engine/http";
import { SSE_HEADERS, sseFrame } from "@/engine/sse";
import { chatTurn, transcript } from "@/engine/studio/agent";
import { sdb } from "@/engine/studio/http";
import { clearThread } from "@/engine/studio/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  thread: z.string().min(1).max(80),
  message: z.string().min(1).max(20000),
  brand: z.string().optional(),
});

/** SSE: text {text}, tool {name,input}, tool_result {name,summary,isError}, done {}, error {message}. */
export const POST = handle(async (req: Request) => {
  const b = await parseBody(req, Body);
  const d = await sdb();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(sseFrame(event, data));
        } catch {}
      };
      try {
        await chatTurn(
          d,
          b.thread,
          b.message,
          { brand: b.brand },
          {
            text: (text) => send("text", { text }),
            tool: (name, input) => send("tool", { name, input }),
            toolResult: (name, summary, isError) => send("tool_result", { name, summary, isError }),
          },
        );
        send("done", {});
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

export const GET = handle(async (req: Request) => {
  const thread = new URL(req.url).searchParams.get("thread") ?? "main";
  return json(await transcript(await sdb(), thread));
});

export const DELETE = handle(async (req: Request) => {
  const thread = new URL(req.url).searchParams.get("thread") ?? "main";
  await clearThread(await sdb(), thread);
  return json({ ok: true });
});
