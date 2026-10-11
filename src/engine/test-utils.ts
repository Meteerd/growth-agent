import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb, type Db, setDb } from "./db/client";

/** Fresh temp SQLite file wired in as the process DB. Never touches data/nexus.db. */
export async function freshDb(): Promise<Db> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-test-"));
  const db = createDb(`file:${path.join(dir, "test.db")}`);
  setDb(db);
  (globalThis as unknown as { __nexusSeeded?: unknown }).__nexusSeeded = undefined;
  return db;
}

export function ctx<P extends Record<string, string | string[]>>(params: P) {
  return { params: Promise.resolve(params) } as never;
}

export function req(url: string, init?: RequestInit & { json?: unknown }): Request {
  const { json, ...rest } = init ?? {};
  return new Request(`http://localhost${url}`, {
    ...rest,
    ...(json !== undefined ? { body: JSON.stringify(json), headers: { "content-type": "application/json" } } : {}),
  });
}

/** Run a full pipeline in demo mode, answering every question with its default. Returns the run id. */
export async function runToEnd(
  db: import("./db/client").Db,
  brandId: string,
  kind: "full" | "research_only" = "full",
): Promise<string> {
  const { createRun } = await import("./runs");
  const { runPipeline } = await import("./agent/pipeline");
  const { listQuestions, getRun } = await import("./repo");
  const { submitAnswers } = await import("./agent/phases/consult");
  const run = await createRun(db, brandId, kind);
  const signal = new AbortController().signal;
  await runPipeline(db, run.id, signal);
  if ((await getRun(db, run.id))?.status === "waiting_input") {
    const qs = await listQuestions(db, run.id);
    await submitAnswers(
      db,
      run.id,
      qs.map((q) =>
        q.defaultAnswer !== undefined ? { questionId: q.id, value: q.defaultAnswer } : { questionId: q.id, skip: true },
      ),
    );
    await runPipeline(db, run.id, signal);
  }
  return run.id;
}
