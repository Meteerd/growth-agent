import { beforeEach, describe, expect, it } from "vitest";
import { POST as cancel } from "@/app/api/runs/[id]/cancel/route";
import { GET as events } from "@/app/api/runs/[id]/events/route";
import type { Db } from "@/engine/db/client";
import { appendEvent, getRun } from "@/engine/repo";
import { canTransition, createRun, setStatus } from "@/engine/runs";
import { seed } from "@/engine/seed";
import { runEventStream } from "@/engine/sse";
import { ctx, freshDb, req } from "@/engine/test-utils";

interface Frame {
  id?: number;
  event: string;
  data: unknown;
}

async function readFrames(stream: ReadableStream<Uint8Array>, max = Number.POSITIVE_INFINITY): Promise<Frame[]> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const frames: Frame[] = [];
  while (frames.length < max) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i = buf.indexOf("\n\n");
    while (i >= 0) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const f: Partial<Frame> = {};
      for (const line of raw.split("\n")) {
        if (line.startsWith("id: ")) f.id = Number(line.slice(4));
        else if (line.startsWith("event: ")) f.event = line.slice(7);
        else if (line.startsWith("data: ")) f.data = JSON.parse(line.slice(6));
      }
      if (f.event) frames.push(f as Frame);
      i = buf.indexOf("\n\n");
    }
  }
  await reader.cancel().catch(() => {});
  return frames;
}

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  await seed(db);
});

describe("runs + SSE", () => {
  it("streams a seeded demo run in order and ends", async () => {
    const res = await events(req("/api/runs/run_hound_demo/events"), ctx({ id: "run_hound_demo" }));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const frames = await readFrames(res.body!);
    const evs = frames.filter((f) => f.event !== "end");
    expect(evs.length).toBeGreaterThan(80);
    expect(evs.map((f) => f.id)).toEqual(evs.map((_, i) => i + 1));
    expect(frames.at(-1)).toEqual({ event: "end", data: { status: "done" } });
  });

  it("reconnect with Last-Event-ID resumes without duplicates", async () => {
    const first = await readFrames(runEventStream(db, "run_aclinic_demo", 0, new AbortController().signal), 20);
    const lastId = first.at(-1)!.id!;
    const res = await events(
      req("/api/runs/run_aclinic_demo/events", { headers: { "last-event-id": String(lastId) } }),
      ctx({ id: "run_aclinic_demo" }),
    );
    const rest = (await readFrames(res.body!)).filter((f) => f.event !== "end");
    expect(rest[0].id).toBe(lastId + 1);
    const all = [...first, ...rest].map((f) => f.id);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual(all.map((_, i) => i + 1));
  });

  it("picks up new events live and ends when the run finishes", async () => {
    const run = await createRun(db, "brand_hound", "full");
    await setStatus(db, run.id, "running");
    const ac = new AbortController();
    const reading = readFrames(runEventStream(db, run.id, 0, ac.signal, { pollMs: 5000 }));
    await new Promise((r) => setTimeout(r, 50));
    await appendEvent(db, { runId: run.id, phase: "intake", type: "log", title: "hello" });
    await setStatus(db, run.id, "done");
    const frames = await reading;
    expect(frames.map((f) => f.event)).toEqual(["status", "log", "status", "end"]);
  });

  it("state machine rejects illegal transitions; cancel works", async () => {
    expect(canTransition("done", "running")).toBe(false);
    expect(canTransition("waiting_input", "running")).toBe(true);
    const run = await createRun(db, "brand_hound", "full");
    const res = await cancel(req(`/api/runs/${run.id}/cancel`, { method: "POST" }), ctx({ id: run.id }));
    expect((await res.json()).status).toBe("cancelled");
    expect((await getRun(db, run.id))?.finishedAt).toBeDefined();
    await expect(setStatus(db, run.id, "running")).rejects.toThrow(/cannot become running/);
  });
});
