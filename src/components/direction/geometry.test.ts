import { describe, expect, it } from "vitest";
import {
  bodySize,
  CENTER,
  firstSentence,
  moveItem,
  orbitRadius,
  R_CORE,
  R_OUTER,
  radarPoints,
  ringTicks,
  seedAngle,
  spreadAngles,
  TAU,
} from "./geometry";

describe("orbit geometry", () => {
  it("places higher scores closer to the core and clamps to the ring band", () => {
    expect(orbitRadius(100, 60)).toBe(R_CORE);
    expect(orbitRadius(60, 60)).toBe(R_OUTER);
    expect(orbitRadius(88, 60)).toBeLessThan(orbitRadius(69, 60));
    expect(orbitRadius(20, 60)).toBe(R_OUTER);
    expect(orbitRadius(140, 60)).toBe(R_CORE);
  });

  it("picks 10-point rings when every pick scores 60+, else wider steps", () => {
    expect(ringTicks(69)).toEqual([90, 80, 70, 60]);
    expect(ringTicks(52)).toEqual([90, 70, 50, 30]);
  });

  it("sizes bodies by priority, largest first", () => {
    expect(bodySize(1, 5)).toBe(112);
    expect(bodySize(5, 5)).toBe(64);
    expect(bodySize(2, 5)).toBeGreaterThan(bodySize(3, 5));
    expect(bodySize(1, 1)).toBe(112);
  });

  it("spreads angles evenly from a stable seed", () => {
    expect(seedAngle("brand_hound")).toBe(seedAngle("brand_hound"));
    expect(seedAngle("brand_hound")).not.toBe(seedAngle("brand_aclinic"));
    const a = spreadAngles(4, 0.5);
    expect(a).toHaveLength(4);
    expect(a[1] - a[0]).toBeCloseTo(TAU / 4);
    for (const x of spreadAngles(7, seedAngle("x"))) expect(x).toBeGreaterThanOrEqual(0);
  });

  it("puts radar vertices at value/100 of the radius, first axis straight up", () => {
    const c = { x: CENTER, y: CENTER };
    const pts = radarPoints(
      { audience: 100, provenWins: 50, productionFit: 0, complianceRisk: 100, speedToSignal: 100, modelFit: 100 },
      100,
      c,
    );
    expect(pts).toHaveLength(6);
    expect(pts[0].x).toBeCloseTo(CENTER);
    expect(pts[0].y).toBeCloseTo(CENTER - 100);
    expect(Math.hypot(pts[1].x - CENTER, pts[1].y - CENTER)).toBeCloseTo(50);
    expect(pts[2]).toEqual(c);
  });

  it("moves list items and takes first sentences", () => {
    expect(moveItem(["a", "b", "c"], 1, 0)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 9)).toEqual(["a", "b", "c"]);
    expect(firstSentence("One thing (14x). Two things.")).toBe("One thing (14x).");
  });
});
