import { RUN_EVENT_TYPES, type RunEvent } from "@/contracts";

export type StreamState = "connecting" | "open" | "reconnecting" | "closed";

export type RunStreamHandlers = {
  onEvent: (e: RunEvent) => void;
  onEnd?: (data: { status: string }) => void;
  onState?: (s: StreamState) => void;
};

/** The subset of EventSource we use, so tests can inject a fake. */
export interface EventSourceLike {
  addEventListener(type: string, fn: (e: MessageEvent) => void): void;
  close(): void;
  onopen: ((e: Event) => void) | null;
  onerror: ((e: Event) => void) | null;
}
export type EventSourceFactory = (url: string) => EventSourceLike;

const defaultFactory: EventSourceFactory = (url) => new EventSource(url) as unknown as EventSourceLike;

/**
 * Run event stream with our own reconnect: native EventSource retries forever and cannot be told where to resume
 * after a manual reopen, so we close on error, back off, and reopen with `?lastEventId=N` (the server also honours
 * the Last-Event-ID header). Duplicate or older ids are dropped, so a resume never double-renders an event.
 */
export function openRunStream(
  url: string,
  handlers: RunStreamHandlers,
  opts: { lastEventId?: number; factory?: EventSourceFactory; backoffMs?: number; maxRetries?: number } = {},
) {
  const factory = opts.factory ?? defaultFactory;
  const backoff = opts.backoffMs ?? 800;
  const maxRetries = opts.maxRetries ?? 8;
  let last = opts.lastEventId ?? 0;
  let es: EventSourceLike | null = null;
  let retries = 0;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const withResume = () => {
    if (!last) return url;
    const u = new URL(url, "http://local");
    u.searchParams.set("lastEventId", String(last));
    return url.startsWith("http") ? u.toString() : `${u.pathname}${u.search}`;
  };

  const onMessage = (m: MessageEvent) => {
    let ev: RunEvent;
    try {
      ev = JSON.parse(m.data);
    } catch {
      return;
    }
    if (typeof ev.id !== "number" || ev.id <= last) return;
    last = ev.id;
    retries = 0;
    handlers.onEvent(ev);
  };

  const connect = () => {
    if (closed) return;
    handlers.onState?.(retries ? "reconnecting" : "connecting");
    es = factory(withResume());
    es.onopen = () => handlers.onState?.("open");
    for (const t of [...RUN_EVENT_TYPES, "message"]) es.addEventListener(t, onMessage);
    es.addEventListener("end", (m: MessageEvent) => {
      let data = { status: "done" };
      try {
        data = JSON.parse(m.data);
      } catch {}
      stop();
      handlers.onEnd?.(data);
    });
    es.onerror = () => {
      es?.close();
      es = null;
      if (closed) return;
      if (retries >= maxRetries) return stop();
      retries++;
      handlers.onState?.("reconnecting");
      timer = setTimeout(connect, backoff * Math.min(4, retries));
    };
  };

  const stop = () => {
    closed = true;
    clearTimeout(timer);
    es?.close();
    es = null;
    handlers.onState?.("closed");
  };

  connect();
  return { close: stop, lastEventId: () => last };
}

/** Incremental SSE parser for POST streams (chat), where EventSource cannot be used. */
export function createSSEParser(onMessage: (event: string, data: string) => void) {
  let buf = "";
  return (chunk: string) => {
    buf += chunk.replace(/\r\n/g, "\n");
    let i = buf.indexOf("\n\n");
    while (i !== -1) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith(":")) continue;
        const [k, ...rest] = line.split(":");
        const v = rest.join(":").replace(/^ /, "");
        if (k === "event") event = v;
        else if (k === "data") data.push(v);
      }
      if (data.length) onMessage(event, data.join("\n"));
      i = buf.indexOf("\n\n");
    }
  };
}
