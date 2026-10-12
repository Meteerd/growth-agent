import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type BetaMessage,
  loadPrompt,
  outputSchema,
  setClaudeTransport,
  structured,
  text,
} from "@/engine/agent/claude";
import type { Db } from "@/engine/db/client";
import { listEvents, spentByProvider } from "@/engine/repo";
import { createRun } from "@/engine/runs";
import { SmokeSchema } from "@/engine/smoke/anthropic";
import { loadFixture } from "@/engine/smoke/record";
import { freshDb } from "@/engine/test-utils";

const recorded = loadFixture<{ response: BetaMessage }>("anthropic", "smoke");

function replay(msg: BetaMessage) {
  const seen: unknown[] = [];
  setClaudeTransport(async (params) => {
    seen.push(params);
    return msg;
  });
  return seen;
}

let db: Db;
beforeEach(async () => {
  db = await freshDb();
});
afterEach(() => setClaudeTransport());

const opts = {
  route: "chat" as const,
  system: "sys",
  user: "u",
  schema: SmokeSchema,
  note: "test",
  demo: () => ({ ok: false, hook: "demo", why: "demo" }),
};

describe("Claude agent core (recorded responses, no network)", () => {
  it("has a recorded live smoke response", () => {
    expect(recorded?.response.stop_reason).toBe("end_turn");
  });

  it("parses a recorded structured response, records cost in the ledger and a cost event", async () => {
    const seen = replay(recorded!.response);
    const run = await createRun(db, "brand_hound", "full");
    const r = await structured({ db, runId: run.id, phase: "research", mode: "live" }, opts);
    expect(r.mode).toBe("live");
    expect(r.value.ok).toBe(true);
    expect(r.usd).toBeGreaterThan(0);
    expect((await spentByProvider(db)).anthropic).toBeCloseTo(r.usd);
    const params = seen[0] as Record<string, unknown>;
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect((params.output_config as { effort: string }).effort).toBe("low");
    expect(params.fallbacks).toBe("default");
    expect(params.tool_choice).toBeUndefined();
    const evs = await listEvents(db, run.id);
    expect(evs.some((e) => e.type === "cost" && (e.costUsd ?? 0) > 0)).toBe(true);
  });

  it("refusal falls back to demo output with a warning event", async () => {
    replay({
      ...recorded!.response,
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: null },
    } as BetaMessage);
    const run = await createRun(db, "brand_hound", "full");
    const r = await structured({ db, runId: run.id, phase: "research", mode: "live" }, opts);
    expect(r.mode).toBe("demo");
    expect(r.value.hook).toBe("demo");
    expect((await listEvents(db, run.id)).some((e) => e.type === "warning")).toBe(true);
  });

  it("invalid JSON shape throws (no silent garbage)", async () => {
    replay({
      ...recorded!.response,
      content: [{ type: "text", text: '{"ok": "yes"}', citations: null }],
    } as BetaMessage);
    await expect(structured({ db, mode: "live" }, opts)).rejects.toThrow(/validation/);
  });

  it("demo mode never touches the transport", async () => {
    const seen = replay(recorded!.response);
    const r = await structured({ db }, opts);
    expect(r.mode).toBe("demo");
    expect(seen).toHaveLength(0);
  });

  it("text() streams demo text through onText", async () => {
    let got = "";
    const r = await text(
      { db },
      {
        route: "chat",
        system: "s",
        messages: [{ role: "user", content: "hi" }],
        note: "t",
        demo: () => "hello",
        onText: (t) => (got += t),
      },
    );
    expect(r.value).toBe("hello");
    expect(got).toBe("hello");
  });

  it("output schema is strict and drops unsupported constraints", () => {
    const js = outputSchema(z.object({ a: z.number().min(0).max(100), b: z.array(z.string()).min(1) })) as {
      additionalProperties: boolean;
      properties: { a: Record<string, unknown> };
    };
    expect(js.additionalProperties).toBe(false);
    expect(js.properties.a.minimum).toBeUndefined();
  });

  it("regression: properties named like JSON-schema keywords (format, pattern) survive", () => {
    const js = outputSchema(
      z.object({ items: z.array(z.object({ format: z.string(), pattern: z.string(), default: z.string() })) }),
    ) as {
      properties: { items: { items: { properties: Record<string, unknown>; required: string[] } } };
    };
    expect(Object.keys(js.properties.items.items.properties).sort()).toEqual(["default", "format", "pattern"]);
    expect(js.properties.items.items.required.sort()).toEqual(["default", "format", "pattern"]);
  });

  it("prompt loader fills variables", () => {
    expect(loadPrompt("_test", { name: "Hound" })).toContain("Hello Hound");
  });
});

describe("house style", () => {
  it("noDashes turns punctuation dashes into commas and keeps numeric ranges", async () => {
    const { noDashes } = await import("@/engine/agent/claude");
    expect(noDashes({ a: "Reels — the main channel", b: ["one – two", "3–5 days"] })).toEqual({
      a: "Reels, the main channel",
      b: ["one, two", "3–5 days"],
    });
  });
});
