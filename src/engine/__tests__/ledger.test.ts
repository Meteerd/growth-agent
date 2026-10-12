import { beforeEach, describe, expect, it } from "vitest";
import { GET as getSpend } from "@/app/api/spend/route";
import type { Db } from "@/engine/db/client";
import { BudgetExceededError, recordSpend } from "@/engine/ledger";
import { callProvider } from "@/engine/providers/call";
import { isLive } from "@/engine/providers/env";
import { claudeCost, renderEstimate } from "@/engine/providers/prices";
import { spentByProvider } from "@/engine/repo";
import { freshDb, req } from "@/engine/test-utils";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
});

describe("providers + spend ledger", () => {
  it("never live in tests, even with LIVE_PROVIDERS set", () => {
    process.env.LIVE_PROVIDERS = "anthropic,openai";
    process.env.ANTHROPIC_API_KEY = "test-not-a-key";
    expect(isLive("anthropic")).toBe(false);
  });

  it("demo mode returns the fixture and records nothing", async () => {
    let liveCalled = false;
    const out = await callProvider(db, {
      provider: "apify",
      note: "test",
      estimateUsd: 1,
      live: async () => {
        liveCalled = true;
        return { result: "live", usd: 1 };
      },
      demo: () => "fixture",
    });
    expect(out).toEqual({ value: "fixture", mode: "demo", usd: 0 });
    expect(liveCalled).toBe(false);
    expect(await spentByProvider(db)).toEqual({});
  });

  it("live call is recorded; a call past the cap is blocked and falls back to demo", async () => {
    const live = async () => ({ result: "live", usd: 0.6 });
    const first = await callProvider(db, {
      provider: "fal",
      note: "a",
      estimateUsd: 0.6,
      live,
      demo: () => "demo",
      mode: "live",
      budgetOverride: 1,
    });
    expect(first.mode).toBe("live");
    let warned: BudgetExceededError | undefined;
    const second = await callProvider(db, {
      provider: "fal",
      note: "b",
      estimateUsd: 0.6,
      live,
      demo: () => "demo",
      mode: "live",
      budgetOverride: 1,
      onBudgetExceeded: (e) => {
        warned = e;
      },
    });
    expect(second).toEqual({ value: "demo", mode: "demo", usd: 0 });
    expect(warned).toBeInstanceOf(BudgetExceededError);
    expect((await spentByProvider(db)).fal).toBeCloseTo(0.6);
  });

  it("a cap hit inside a run without its own handler leaves a warning event on the run", async () => {
    const { seed } = await import("@/engine/seed");
    const { listEvents } = await import("@/engine/repo");
    await seed(db);
    const runId = "run_hound_demo";
    const out = await callProvider(db, {
      provider: "higgsfield",
      note: "clip shot 2",
      runId,
      estimateUsd: 5,
      live: async () => ({ result: "live", usd: 5 }),
      demo: () => "still",
      mode: "live",
      budgetOverride: 1,
    });
    expect(out.mode).toBe("demo");
    const ev = (await listEvents(db, runId)).at(-1)!;
    expect(ev.type).toBe("warning");
    expect(ev.title).toContain("higgsfield budget cap reached");
  });

  it("parallel calls cannot overshoot the cap together (reservations)", async () => {
    const slow = () =>
      new Promise<{ result: string; usd: number }>((r) => setTimeout(() => r({ result: "x", usd: 0.4 }), 20));
    const outs = await Promise.all(
      [1, 2, 3].map(() =>
        callProvider(db, {
          provider: "openai",
          note: "p",
          estimateUsd: 0.4,
          live: slow,
          demo: () => "d",
          mode: "live",
          budgetOverride: 1,
        }),
      ),
    );
    expect(outs.filter((o) => o.mode === "live")).toHaveLength(2);
    expect((await spentByProvider(db)).openai).toBeCloseTo(0.8);
  });

  it("ledger sums per provider and /api/spend reports totals and runId filter", async () => {
    await recordSpend(db, { provider: "anthropic", usd: 0.12, note: "a", runId: "run_x" });
    await recordSpend(db, { provider: "anthropic", usd: 0.08, note: "b" });
    await recordSpend(db, { provider: "firecrawl", usd: 0.01, note: "c", runId: "run_x" });
    const all = await (await getSpend(req("/api/spend"))).json();
    expect(all.byProvider.anthropic).toBeCloseTo(0.2);
    expect(all.totalUsd).toBeCloseTo(0.21);
    const run = await (await getSpend(req("/api/spend?runId=run_x"))).json();
    expect(run.entries).toHaveLength(2);
    expect(run.byProvider.anthropic).toBeCloseTo(0.12);
  });

  it("price table: Claude usage cost and render estimate", () => {
    expect(claudeCost("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 100_000 })).toBeCloseTo(6);
    const est = renderEstimate([{ durationSec: 4 }, { durationSec: 6 }], "draft");
    expect(est.totalUsd).toBeGreaterThan(0);
    expect(est.lines.map((l) => l.provider)).toEqual(["openai", "fal", "openai"]);
  });
});
