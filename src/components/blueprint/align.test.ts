import { describe, expect, it } from "vitest";
import { DEMO_RUNS } from "@/contracts";
import { alignRemake, keyframeUrls, latestReview, nearestFrame, scoreTone, shotAt, shotScore } from "./align";

const bp = DEMO_RUNS.hound.blueprints[0];
const remake = DEMO_RUNS.hound.concepts.find((c) => c.blueprintId === bp.id)!;

describe("blueprint alignment", () => {
  it("finds the shot playing at a time, clamping the ends", () => {
    expect(shotAt(bp.shots, 0)).toBe(0);
    expect(shotAt(bp.shots, 2.5)).toBe(1);
    expect(shotAt(bp.shots, 20.99)).toBe(bp.shots.length - 1);
    expect(shotAt(bp.shots, 99)).toBe(bp.shots.length - 1);
    expect(shotAt([], 1)).toBe(-1);
  });
  it("aligns the remake shot for shot through shotMap", () => {
    const aligned = alignRemake(bp, remake);
    expect(aligned).toHaveLength(bp.shots.length);
    expect(aligned.every(Boolean)).toBe(true);
    const swapped = alignRemake(bp, { ...remake, shotMap: [{ shotIdx: 1, blueprintShotIdx: 0 }] });
    expect(swapped[0]?.idx).toBe(1);
    expect(alignRemake(bp, undefined)[0]).toBeUndefined();
  });
  it("picks the frame nearest the middle of a shot", () => {
    const frames = [
      { t: 0.25, url: "a" },
      { t: 1.2, url: "b" },
      { t: 2.4, url: "c" },
    ];
    expect(nearestFrame(frames, 0, 2.5)?.url).toBe("b");
    expect(nearestFrame(frames, 5, 6)).toBeUndefined();
  });
  it("reads the latest review round and per-shot scores", () => {
    const reviews = DEMO_RUNS.hound.reviews.filter((r) => r.conceptId === remake.id);
    const last = latestReview(reviews)!;
    expect(last.round).toBe(Math.max(...reviews.map((r) => r.round)));
    expect(shotScore(last, 0)?.score).toBeGreaterThan(0);
    expect(shotScore(last, undefined)).toBeUndefined();
    expect([scoreTone(90), scoreTone(70), scoreTone(40)]).toEqual(["pass", "warn", "fail"]);
  });
  it("maps keyframes by asset id or shot index", () => {
    const urls = keyframeUrls(
      [
        {
          id: "k1",
          brandId: "b",
          kind: "keyframe",
          url: "/k1.png",
          provider: "openai",
          costUsd: 0,
          demo: true,
          createdAt: "",
          shotIdx: 2,
        },
      ],
      remake.shots,
    );
    expect(urls.get(2)).toBe("/k1.png");
    expect(urls.has(0)).toBe(false);
  });
});
