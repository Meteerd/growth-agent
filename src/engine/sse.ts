import type { RunEvent } from "@/contracts";
import { bus, runChannel } from "./bus";
import type { Db } from "./db/client";
import { getRun, listEvents } from "./repo";
import { TERMINAL } from "./runs";

const enc = new TextEncoder();

export function sseFrame(event: string, data: unknown, id?: number | string): Uint8Array {
  return enc.encode(`${id !== undefined ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/**
 * Stream a run's events from `afterId`. Reads the DB (source of truth), wakes on in-process bus pings and
 * polls every second as a fallback. `paceMs` > 0 replays stored events with a delay (demo playback).
 * Sends `event: end` once the run is terminal and fully flushed.
 */
export function runEventStream(
  db: Db,
  runId: string,
  afterId: number,
  signal: AbortSignal,
  opts: { paceMs?: number; heartbeatMs?: number; pollMs?: number } = {},
): ReadableStream<Uint8Array> {
  const pace = Math.max(0, Math.min(opts.paceMs ?? 0, 5000));
  let last = afterId;
  let closed = false;
  let wake: (() => void) | undefined;
  const onBus = () => wake?.();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: Uint8Array) => {
        if (!closed) controller.enqueue(chunk);
      };
      const close = () => {
        if (closed) return;
        closed = true;
        bus.off(runChannel(runId), onBus);
        clearInterval(hb);
        try {
          controller.close();
        } catch {}
      };
      bus.on(runChannel(runId), onBus);
      const hb = setInterval(() => send(enc.encode(": ping\n\n")), opts.heartbeatMs ?? 15000);
      signal.addEventListener("abort", close);
      send(enc.encode("retry: 2000\n\n"));
      try {
        while (!closed) {
          const events: RunEvent[] = await listEvents(db, runId, last);
          for (const e of events) {
            if (closed) break;
            send(sseFrame(e.type, e, e.id));
            last = e.id;
            if (pace) await sleep(pace, signal);
          }
          const run = await getRun(db, runId);
          if (!run) {
            send(sseFrame("error", { message: "Run not found" }));
            break;
          }
          if (TERMINAL.includes(run.status)) {
            const more = await listEvents(db, runId, last);
            if (!more.length) {
              send(sseFrame("end", { status: run.status }));
              break;
            }
            continue;
          }
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, opts.pollMs ?? 1000);
            wake = () => {
              clearTimeout(t);
              resolve();
            };
          });
          wake = undefined;
        }
      } catch (e) {
        send(sseFrame("error", { message: e instanceof Error ? e.message : String(e) }));
      }
      close();
    },
    cancel() {
      closed = true;
      bus.off(runChannel(runId), onBus);
    },
  });
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((r) => {
    const t = setTimeout(r, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      r();
    });
  });
}
