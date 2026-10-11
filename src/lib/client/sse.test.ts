import { describe, expect, it, vi } from "vitest";
import { createSSEParser, type EventSourceLike, openRunStream } from "./sse";

class FakeES implements EventSourceLike {
  static all: FakeES[] = [];
  listeners = new Map<string, ((e: MessageEvent) => void)[]>();
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeES.all.push(this);
  }
  addEventListener(t: string, fn: (e: MessageEvent) => void) {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn]);
  }
  close() {
    this.closed = true;
  }
  send(type: string, data: unknown) {
    for (const fn of this.listeners.get(type) ?? []) fn({ data: JSON.stringify(data) } as MessageEvent);
  }
}
const ev = (id: number, type = "log") => ({
  id,
  runId: "r1",
  ts: "2026-10-11T21:00:00Z",
  phase: "research",
  type,
  title: `e${id}`,
});

describe("openRunStream", () => {
  it("reconnects after an error and resumes from the last event id, dropping duplicates", () => {
    vi.useFakeTimers();
    FakeES.all = [];
    const got: number[] = [];
    const states: string[] = [];
    openRunStream(
      "/api/runs/r1/events?pace=250",
      { onEvent: (e) => got.push(e.id), onState: (s) => states.push(s) },
      {
        factory: (u) => new FakeES(u),
        backoffMs: 100,
      },
    );
    const a = FakeES.all[0];
    expect(a.url).toBe("/api/runs/r1/events?pace=250");
    a.send("tool_call", ev(1, "tool_call"));
    a.send("evidence", ev(2, "evidence"));
    a.onerror?.(new Event("error"));
    expect(a.closed).toBe(true);
    vi.advanceTimersByTime(100);
    const b = FakeES.all[1];
    expect(b.url).toBe("/api/runs/r1/events?pace=250&lastEventId=2");
    b.send("evidence", ev(2, "evidence")); // duplicate after resume
    b.send("thinking", ev(3, "thinking"));
    expect(got).toEqual([1, 2, 3]);
    expect(states).toContain("reconnecting");
    vi.useRealTimers();
  });

  it("closes on the end frame and does not reconnect", () => {
    vi.useFakeTimers();
    FakeES.all = [];
    const onEnd = vi.fn();
    openRunStream(
      "/api/runs/r1/events",
      { onEvent: () => {}, onEnd },
      { factory: (u) => new FakeES(u), lastEventId: 5 },
    );
    const a = FakeES.all[0];
    expect(a.url).toBe("/api/runs/r1/events?lastEventId=5");
    a.send("end", { status: "done" });
    expect(onEnd).toHaveBeenCalledWith({ status: "done" });
    expect(a.closed).toBe(true);
    a.onerror?.(new Event("error"));
    vi.advanceTimersByTime(10_000);
    expect(FakeES.all).toHaveLength(1);
    vi.useRealTimers();
  });
});

describe("createSSEParser", () => {
  it("parses chunked frames, multi-line data and comments", () => {
    const out: [string, string][] = [];
    const feed = createSSEParser((e, d) => out.push([e, d]));
    feed(': ping\n\nevent: token\ndata: {"text":"Hel');
    feed('lo"}\n\nevent: done\r\ndata: {}\r\n\r\ndata: a\ndata: b\n\n');
    expect(out).toEqual([
      ["token", '{"text":"Hello"}'],
      ["done", "{}"],
      ["message", "a\nb"],
    ]);
  });
});
