import { describe, expect, it } from "vitest";
import type { Review } from "@/contracts";
import { applyMeasurements } from "@/engine/agent/phases/review";

const aclinicLike: Review = {
  id: "review_x",
  conceptId: "concept_x",
  assetId: "asset_x",
  round: 6,
  overall: 82,
  blueprintMatch: 85,
  perShot: [80, 83, 82, 85, 80, 80].map((score, idx) => ({ idx, score, issues: [] })),
  complianceOk: true,
  decision: "accept",
  notes: "Clean listicle.",
  createdAt: "2026-10-12T00:00:00.000Z",
};

describe("A18 review measurements", () => {
  it("the a.clinic-like cut (82, shaking stills, no music) fails under the new rubric", () => {
    const r = applyMeasurements(aclinicLike, {
      shake: [
        { idx: 0, reversalsPerSec: 0 },
        { idx: 1, reversalsPerSec: 6 },
        { idx: 2, reversalsPerSec: 9.5 },
        { idx: 3, reversalsPerSec: 0.5 },
      ],
      musicBed: false,
    });
    expect(r.decision).toBe("regenerate");
    expect(r.overall).toBeLessThanOrEqual(75);
    expect(r.perShot[1]!.score).toBe(65);
    expect(r.perShot[2]!.issues[0]).toContain("shakes");
    expect(r.perShot[3]!.score).toBe(85);
    expect(r.notes).toContain("No music bed");
  });

  it("a clean cut with music keeps the model's verdict", () => {
    const r = applyMeasurements(aclinicLike, { shake: [{ idx: 0, reversalsPerSec: 0 }], musicBed: true });
    expect(r.overall).toBe(82);
    expect(r.decision).toBe("accept");
    expect(r.perShot.map((p) => p.score)).toEqual([80, 83, 82, 85, 80, 80]);
  });

  it("overall cannot sit far above the shots it is made of", () => {
    const r = applyMeasurements(
      { ...aclinicLike, overall: 95, perShot: [70, 72, 75].map((score, idx) => ({ idx, score, issues: [] })) },
      { shake: [], musicBed: true },
    );
    expect(r.overall).toBeLessThanOrEqual(77);
    expect(r.decision).toBe("regenerate");
  });
});
