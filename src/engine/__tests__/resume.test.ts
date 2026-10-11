import { beforeEach, describe, expect, it } from "vitest";
import { runPipeline } from "@/engine/agent/pipeline";
import type { Db } from "@/engine/db/client";
import { resumeInterruptedRuns, waitForRun } from "@/engine/jobs/runner";
import { appendEvent, getRun, listEvents, updateRun } from "@/engine/repo";
import { createRun, setStatus } from "@/engine/runs";
import { seed } from "@/engine/seed";
import { freshDb } from "@/engine/test-utils";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  await seed(db);
  (globalThis as { __nexusResumed?: boolean }).__nexusResumed = false;
});

describe("AS3 resume after restart", () => {
  it("resumes a stale running run from its last completed phase; leaves fresh ones alone", async () => {
    const stale = await createRun(db, "brand_hound", "research_only");
    await setStatus(db, stale.id, "running");
    await appendEvent(db, {
      runId: stale.id,
      phase: "intake",
      type: "phase_started",
      title: "Reading the brand",
      ts: new Date(Date.now() - 10 * 60_000).toISOString(),
    });
    await appendEvent(db, {
      runId: stale.id,
      phase: "intake",
      type: "phase_completed",
      title: "Dossier ready",
      ts: new Date(Date.now() - 10 * 60_000).toISOString(),
    });
    await updateRun(db, stale.id, { phase: "research" });
    const fresh = await createRun(db, "brand_aclinic", "research_only");
    await setStatus(db, fresh.id, "running");
    const resumed = await resumeInterruptedRuns(60_000);
    expect(resumed).toEqual([stale.id]);
    await waitForRun(stale.id);
    expect((await getRun(db, stale.id))?.status).toBe("done");
    const evs = await listEvents(db, stale.id);
    expect(evs.filter((e) => e.type === "phase_started" && e.phase === "intake")).toHaveLength(1);
    expect(evs.some((e) => e.type === "warning" && e.title.startsWith("Server restarted"))).toBe(true);
    expect((await getRun(db, fresh.id))?.status).toBe("running");
    void runPipeline;
  });
});
