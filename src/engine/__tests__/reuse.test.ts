import { beforeEach, describe, expect, it } from "vitest";
import { POST as createRun } from "@/app/api/brands/[id]/runs/route";
import type { Db } from "@/engine/db/client";
import { waitForRun } from "@/engine/jobs/runner";
import { getRun, listBlueprints, listEvents, listEvidence } from "@/engine/repo";
import { seed } from "@/engine/seed";
import { ctx, freshDb, req } from "@/engine/test-utils";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  await seed(db);
});

describe("reuse research (recorded data powers a live consultation)", () => {
  it("copies evidence and blueprints, skips the gathering phases, and pauses at the consultation", async () => {
    const res = await createRun(
      req("/api/brands/hound/runs", { method: "POST", json: { kind: "full", reuseResearchFrom: "run_hound_demo" } }),
      ctx({ id: "hound" }),
    );
    expect(res.status).toBe(201);
    const run = await res.json();
    await waitForRun(run.id);
    expect((await getRun(db, run.id))?.status).toBe("waiting_input");
    const src = await listEvidence(db, "run_hound_demo");
    const copied = await listEvidence(db, run.id);
    expect(copied).toHaveLength(src.length);
    expect((await listBlueprints(db, run.id)).length).toBe((await listBlueprints(db, "run_hound_demo")).length);
    const evs = await listEvents(db, run.id);
    const intakeStarts = evs.filter((e) => e.type === "phase_started" && e.phase === "intake");
    expect(intakeStarts).toHaveLength(1);
    expect(evs.filter((e) => e.type === "evidence").every((e) => copied.some((c) => c.id === e.refId))).toBe(true);
    expect(evs.map((e) => e.id)).toEqual(evs.map((_, i) => i + 1));
  });

  it("404 when there is nothing to reuse", async () => {
    const res = await createRun(
      req("/api/brands/evreon/runs", { method: "POST", json: { kind: "full", reuseResearchFrom: "recorded" } }),
      ctx({ id: "evreon" }),
    );
    expect(res.status).toBe(404);
  });
});
