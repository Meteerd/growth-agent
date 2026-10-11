import { beforeEach, describe, expect, it } from "vitest";
import { POST as cancel } from "@/app/api/runs/[id]/cancel/route";
import { makeCtx } from "@/engine/agent/context";
import { PHASE_RUNNERS } from "@/engine/agent/phases";
import type { Db } from "@/engine/db/client";
import { startRun, waitForRun } from "@/engine/jobs/runner";
import { getRun, listEvents } from "@/engine/repo";
import { createRun } from "@/engine/runs";
import { seed } from "@/engine/seed";
import { ctx, freshDb, req } from "@/engine/test-utils";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  await seed(db);
});

describe("cancel mid-run", () => {
  it("a run cancelled during research stops there: no later phases, status cancelled", async () => {
    const original = PHASE_RUNNERS.research!;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    PHASE_RUNNERS.research = async (c) => {
      await gate; // hold the phase open until the cancel lands
      c.check();
      return original(c);
    };
    try {
      const run = await createRun(db, "brand_hound", "full");
      startRun(run.id);
      for (let i = 0; i < 50 && !(await listEvents(db, run.id)).some((e) => e.phase === "research"); i++)
        await new Promise((r) => setTimeout(r, 20));
      const res = await cancel(req(`/api/runs/${run.id}/cancel`, { method: "POST" }), ctx({ id: run.id }));
      expect((await res.json()).status).toBe("cancelled");
      release();
      await waitForRun(run.id);
      expect((await getRun(db, run.id))?.status).toBe("cancelled");
      const phases = new Set((await listEvents(db, run.id)).map((e) => e.phase));
      expect(phases.has("consult")).toBe(false);
      expect(phases.has("direction")).toBe(false);
      void makeCtx;
    } finally {
      PHASE_RUNNERS.research = original;
    }
  });
});
