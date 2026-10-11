import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as answers } from "@/app/api/runs/[id]/answers/route";
import { POST as chatRoute } from "@/app/api/runs/[id]/chat/route";
import { Question as QuestionSchema } from "@/contracts";
import { chat } from "@/engine/agent/chat";
import { type BetaMessage, setClaudeTransport } from "@/engine/agent/claude";
import { runPipeline } from "@/engine/agent/pipeline";
import type { Db } from "@/engine/db/client";
import { waitForRun } from "@/engine/jobs/runner";
import { getBrand, getRun, listEvents, listQuestions } from "@/engine/repo";
import { createRun } from "@/engine/runs";
import { seed } from "@/engine/seed";
import { loadFixture } from "@/engine/smoke/record";
import { ctx, freshDb, req } from "@/engine/test-utils";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  await seed(db);
});
afterEach(() => setClaudeTransport());

describe("consult phase", () => {
  it("demo run pauses at consult in waiting_input and resumes after answers", async () => {
    const run = await createRun(db, "brand_hound", "full");
    await runPipeline(db, run.id, new AbortController().signal);
    const paused = await getRun(db, run.id);
    expect(paused?.status).toBe("waiting_input");
    expect(paused?.phase).toBe("consult");
    const qs = await listQuestions(db, run.id);
    expect(qs.length).toBeGreaterThanOrEqual(5);
    for (const q of qs) {
      QuestionSchema.parse(q);
      expect(q.why.length).toBeGreaterThan(10);
      expect(q.answer).toBeUndefined();
    }
    expect(qs.some((q) => q.evidenceIds.length > 0)).toBe(true);
    expect(qs.every((q) => q.required)).toBe(true);

    // answer all but one; still waiting
    const first = qs.slice(0, -1).map((q) => ({ questionId: q.id, value: q.defaultAnswer ?? "ok" }));
    const r1 = await answers(
      req(`/api/runs/${run.id}/answers`, { method: "POST", json: { answers: first } }),
      ctx({ id: run.id }),
    );
    expect(r1.status).toBe(200);
    expect((await getRun(db, run.id))?.status).toBe("waiting_input");

    // skip the last one -> resumes and finishes
    const last = qs.at(-1)!;
    await answers(
      req(`/api/runs/${run.id}/answers`, { method: "POST", json: { answers: [{ questionId: last.id, skip: true }] } }),
      ctx({ id: run.id }),
    );
    await waitForRun(run.id);
    expect((await getRun(db, run.id))?.status).toBe("done");
    const brand = await getBrand(db, "brand_hound");
    expect(brand?.dossier.operatorNotes?.length).toBe(qs.length);
    expect(brand?.dossier.provenance?.find((p) => p.field === "operatorNotes")?.source).toBe("answer");
    const evs = await listEvents(db, run.id);
    const statuses = evs.filter((e) => e.type === "status").map((e) => (e.data as { status: string }).status);
    expect(statuses).toEqual(["running", "waiting_input", "running", "done"]);
  });

  it("rejects unknown questions and answers to finished runs", async () => {
    const r = await answers(
      req("/api/runs/run_hound_demo/answers", {
        method: "POST",
        json: { answers: [{ questionId: "nope", value: 1 }] },
      }),
      ctx({ id: "run_hound_demo" }),
    );
    expect(r.status).toBe(409);
  });
});

describe("consult chat", () => {
  it("streams tokens over SSE and ends with done (demo)", async () => {
    const res = await chatRoute(
      req("/api/runs/run_hound_demo/chat", { method: "POST", json: { message: "We can film our own beagle." } }),
      ctx({ id: "run_hound_demo" }),
    );
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const body = await res.text();
    expect(body).toContain("event: token");
    expect(body).toContain("event: done");
  });

  it("turns a trailing <question> block into a question card and never streams the marker", async () => {
    const rec = loadFixture<{ response: BetaMessage }>("anthropic", "smoke")!.response;
    const reply =
      'That changes the plan: real footage beats illustration here [ev_hound_02].\n<question>{"kind":"confirm","prompt":"Can you film 10 minutes a day this week?","why":"The top outliers are real-dog reveals."}</question>';
    setClaudeTransport(async (_p, onText) => {
      for (const chunk of reply.match(/[\s\S]{1,7}/g) ?? []) onText?.(chunk);
      return { ...rec, content: [{ type: "text", text: reply, citations: null }] } as BetaMessage;
    });
    let streamed = "";
    const questions: unknown[] = [];
    await chat(
      db,
      "run_hound_demo",
      "We can film our dog",
      { token: (t) => (streamed += t), question: (q) => questions.push(q) },
      { mode: "live" },
    );
    expect(streamed).toContain("real footage beats illustration");
    expect(streamed).not.toContain("<question");
    expect(questions).toHaveLength(1);
    expect(QuestionSchema.parse(questions[0]).prompt).toContain("film");
  });
});
