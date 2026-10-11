import { describe, expect, it } from "vitest";
import type { MetricSnapshot } from "@/contracts";
import {
  areaPath,
  formatElapsed,
  latestCounters,
  linePath,
  nearestIndex,
  niceMax,
  safeHttpUrl,
  scale,
  sumCounters,
  viewSeries,
} from "./chart";

const snap = (capturedAt: string, m: Partial<MetricSnapshot>): MetricSnapshot => ({
  id: `s_${capturedAt}`,
  packId: "p1",
  capturedAt,
  source: "manual",
  ...m,
});

describe("results chart helpers", () => {
  const snaps = [
    snap("2026-10-12T12:00:00.000Z", { views: 3214, likes: 90 }),
    snap("2026-10-12T09:00:00.000Z", { views: 1200, likes: 40, saves: 3 }),
    snap("2026-10-12T13:00:00.000Z", { likes: 120 }),
  ];

  it("latest counters take the newest recorded value per metric and never invent zeros", () => {
    expect(latestCounters(snaps)).toEqual({ views: 3214, likes: 120, saves: 3 });
    expect(latestCounters([])).toEqual({});
    expect(sumCounters([{ views: 10, likes: 1 }, { views: 5 }, {}])).toEqual({ views: 15, likes: 1 });
  });

  it("view series is time-sorted, relative to posting, and skips snapshots without views", () => {
    const s = viewSeries(snaps, "2026-10-12T08:00:00.000Z");
    expect(s.map((p) => [p.t / 3_600_000, p.v])).toEqual([
      [1, 1200],
      [4, 3214],
    ]);
    expect(viewSeries([snap("2026-10-12T07:00:00.000Z", { views: 5 })], "2026-10-12T08:00:00.000Z")[0].t).toBe(0);
    expect(viewSeries(snaps)[0].t).toBe(0);
  });

  it("nice axis tops have whole halves", () => {
    expect([0, 7, 10, 11, 1200, 3214, 4000, 51_000].map(niceMax)).toEqual([10, 10, 10, 20, 2000, 4000, 4000, 60_000]);
  });

  it("scales, paths and nearest point", () => {
    const x = scale(0, 100, 10, 210);
    expect([x(0), x(50), x(100)]).toEqual([10, 110, 210]);
    expect(scale(0, 0, 0, 100)(0)).toBe(0);
    const pts = [
      { x: 0, y: 100 },
      { x: 50.04, y: 20 },
    ];
    expect(linePath(pts)).toBe("M0 100 L50 20");
    expect(areaPath(pts, 120)).toBe("M0 100 L50 20 L50 120 L0 120 Z");
    expect(areaPath(pts.slice(0, 1), 120)).toBe("");
    expect(nearestIndex([0, 40, 100], 75)).toBe(2);
  });

  it("elapsed labels and safe links", () => {
    expect([40_000, 720_000, 5_400_000, 36_000_000, 259_200_000].map(formatElapsed)).toEqual([
      "40 s",
      "12 min",
      "1.5 h",
      "10 h",
      "3 d",
    ]);
    expect(safeHttpUrl("https://www.tiktok.com/@hound/video/1")?.hostname).toBe("www.tiktok.com");
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("not a url")).toBeUndefined();
  });
});
