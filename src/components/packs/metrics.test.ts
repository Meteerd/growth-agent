import { describe, expect, it } from "vitest";
import { parseMetrics } from "./metrics";

describe("parseMetrics", () => {
  it("keeps whole numbers, accepts thousands separators, skips blanks", () => {
    expect(parseMetrics({ views: "3,214", likes: " 187 ", shares: "" })).toEqual({
      req: { views: 3214, likes: 187 },
      bad: [],
      empty: false,
    });
  });
  it("rejects negatives, decimals and words", () => {
    expect(parseMetrics({ views: "-3", likes: "1.5", saves: "lots" }).bad).toEqual(["views", "likes", "saves"]);
  });
  it("flags an all-blank form as empty", () => {
    expect(parseMetrics({ views: " " }).empty).toBe(true);
  });
});
