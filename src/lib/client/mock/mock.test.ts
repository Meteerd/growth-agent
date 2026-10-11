import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_RUNS, type RunEvent } from "@/contracts";
import { createMockClient } from "./client";
import { createPlayer, eventDelays, isPause } from "./player";

describe("mock run script", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("paces a full run at about 60 seconds", () => {
    const d = eventDelays(DEMO_RUNS.hound.events, 60_000);
    const total = d.reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 60_000)).toBeLessThan(200);
    expect(Math.min(...d)).toBeGreaterThan(0);
  });

  it("player stops at waiting_input and resumes", async () => {
    const seen: RunEvent[] = [];
    const p = createPlayer(DEMO_RUNS.hound.events, { totalMs: 10_000, onEvent: (e) => seen.push(e) });
    p.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(p.paused).toBe(true);
    expect(isPause(seen.at(-1)!)).toBe(true);
    p.resume();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(seen).toHaveLength(DEMO_RUNS.hound.events.length);
  });

  it("a new run streams, pauses at consult, resumes on answers, ends done", async () => {
    const client = createMockClient();
    const run = client.startRun("hound", { kind: "full" });
    await vi.advanceTimersByTimeAsync(300);
    const { id } = await run;
    const ids: number[] = [];
    const onEnd = vi.fn();
    client.subscribeRun(id, { onEvent: (e) => ids.push(e.id), onEnd });
    await vi.advanceTimersByTimeAsync(80_000);
    expect((await settle(client.run(id))).status).toBe("waiting_input");
    // mid-run reads only show what the stream revealed; plan is not decided yet
    const ev = await settle(client.evidence(id));
    expect(ev.length).toBe(DEMO_RUNS.hound.evidence.length);
    await expect(settle(client.plan(id))).rejects.toThrow(/not found/);
    const qs = await settle(client.questions(id));
    expect(qs.every((q) => q.answeredAt == null)).toBe(true);
    await settle(
      client.answer(id, {
        answers: qs.map((q) => ({ questionId: q.id, value: q.defaultAnswer, skip: q.defaultAnswer == null })),
      }),
    );
    await vi.advanceTimersByTimeAsync(80_000);
    expect(onEnd).toHaveBeenCalledWith({ status: "done" });
    expect(ids).toEqual(DEMO_RUNS.hound.events.map((e) => e.id));
    expect((await settle(client.plan(id))).channels.length).toBeGreaterThan(0);
    // fresh run ids never collide with the seeded demo run
    const concepts = await settle(client.concepts(id));
    expect(concepts[0].id).not.toBe(DEMO_RUNS.hound.concepts[0].id);
  });

  it("creating a brand runs a short intake and lists it in the portfolio", async () => {
    const client = createMockClient();
    const { brand, run } = await settle(client.createBrand({ url: "https://www.example-dogs.com" }));
    expect(brand.slug).toBe("example-dogs");
    await vi.advanceTimersByTimeAsync(6_000);
    expect((await settle(client.run(run.id))).status).toBe("done");
    expect((await settle(client.evidence(run.id))).length).toBe(0);
    const list = await settle(client.brands());
    expect(list.map((b) => b.slug)).toContain("example-dogs");
  });

  it("posting a pack and adding metrics shows up in results", async () => {
    const client = createMockClient();
    const packs = await settle(client.packs("run_hound_demo"));
    await settle(client.markPosted(packs[0].id, { postedUrl: "https://tiktok.com/@hound/video/1" }));
    await settle(client.addMetrics(packs[0].id, { views: 3214, likes: 120 }));
    const r = await settle(client.results("hound"));
    expect(r.packs).toHaveLength(1);
    expect(r.packs[0].snapshots[0].views).toBe(3214);
    expect((await settle(client.brands())).find((b) => b.slug === "hound")?.counts.totalViews).toBe(3214);
  });
});

/** Mock calls wait on timers; advance fake time until the promise settles. */
async function settle<T>(p: Promise<T>): Promise<T> {
  let done = false;
  p.then(
    () => (done = true),
    () => (done = true),
  );
  for (let i = 0; i < 50 && !done; i++) await vi.advanceTimersByTimeAsync(100);
  return p;
}
