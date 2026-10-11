import { describe, expect, it } from "vitest";
import { evidenceStat, firstSentence, moveItem, notNowReason, pad2 } from "./rank";

describe("evidenceStat", () => {
  it("prefers the outlier multiple, then views, then days running, else nothing", () => {
    expect(evidenceStat({ metrics: { outlierScore: 14.2, views: 900_000 } })).toBe("14x");
    expect(evidenceStat({ metrics: { outlierScore: 9.43 } })).toBe("9.4x");
    expect(evidenceStat({ metrics: { views: 1_250_000, daysRunning: 40 } })).toBe("1.3M");
    expect(evidenceStat({ metrics: { daysRunning: 94 } })).toBe("94d");
    expect(evidenceStat({ metrics: {} })).toBeUndefined();
  });
});

describe("ranked table helpers", () => {
  it("moves list items and clamps the target", () => {
    expect(moveItem(["a", "b", "c"], 1, 0)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 9)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 0, -3)).toEqual(["a", "b", "c"]);
  });

  it("takes the first sentence without splitting on decimals", () => {
    expect(firstSentence("One thing (14x). Two things.")).toBe("One thing (14x).");
    expect(firstSentence("  Up to 9.4x median. Then more. ")).toBe("Up to 9.4x median.");
    expect(firstSentence("No full stop")).toBe("No full stop");
  });

  it("strips the channel label prefix from operator drop reasons only", () => {
    expect(notNowReason("meta_ads", "Meta paid: No ad budget this month")).toBe("No ad budget this month");
    expect(notNowReason("meta_ads", "RX4: Meta paid ads need LegitScript.")).toBe(
      "RX4: Meta paid ads need LegitScript.",
    );
  });

  it("pads ranks to two digits", () => {
    expect(pad2(1)).toBe("01");
    expect(pad2(12)).toBe("12");
  });
});
