import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PHASES } from "@/contracts";
import { formatCount, formatUsd, longevity, timeAgo } from "@/lib/client/format";
import { costSegments } from "./CostMeter";
import { formatValue } from "./NumberTicker";
import { PhaseRail, phaseStates } from "./PhaseRail";
import { normalizeUrl } from "./UrlInput";

describe("phaseStates", () => {
  it("marks earlier phases done, current active, later pending", () => {
    const s = phaseStates(PHASES, "consult", "running");
    expect(s.slice(0, 3)).toEqual(["done", "done", "done"]);
    expect(s[3]).toBe("active");
    expect(s.slice(4).every((x) => x === "pending")).toBe(true);
  });
  it("shows waiting at consult when the run needs input", () => {
    expect(phaseStates(PHASES, "consult", "waiting_input")[3]).toBe("waiting");
  });
  it("finished run marks the current phase done; failure marks it failed", () => {
    expect(phaseStates(PHASES, "pack", "done")[8]).toBe("done");
    expect(phaseStates(PHASES, "research", "failed")[1]).toBe("failed");
  });
  it("honours phases the stream reported complete", () => {
    expect(phaseStates(PHASES, "intake", "running", ["research"])[1]).toBe("done");
  });
  it("renders aria-current on the active step", () => {
    const html = renderToStaticMarkup(
      createElement(PhaseRail, { phases: PHASES, current: "direction", status: "running" }),
    );
    expect(html).toContain('aria-current="step"');
    expect(html.match(/data-state="done"/g)?.length).toBe(4);
  });
});

describe("costSegments", () => {
  it("splits spent and estimate against the cap", () => {
    expect(costSegments(1, 0.5, 5)).toMatchObject({ spentPct: 20, estPct: 10, over: false, near: false });
  });
  it("flags over-cap and clamps drawing to 100%", () => {
    const s = costSegments(4.5, 2, 5);
    expect(s.over).toBe(true);
    expect(s.near).toBe(true);
    expect(s.spentPct + s.estPct).toBeLessThanOrEqual(100);
  });
});

describe("normalizeUrl", () => {
  it("accepts bare domains and full urls", () => {
    expect(normalizeUrl("hound.app")).toBe("https://hound.app");
    expect(normalizeUrl("https://a.clinic/sk/")).toBe("https://a.clinic/sk");
  });
  it("rejects things that are not sites", () => {
    expect(normalizeUrl("")).toBeUndefined();
    expect(normalizeUrl("hello world")).toBeUndefined();
    expect(normalizeUrl("localhost")).toBeUndefined();
  });
});

describe("format", () => {
  it("counts, money, ticker values", () => {
    expect(formatCount(3214)).toBe("3,214");
    expect(formatCount(2_400_000)).toBe("2.4M");
    expect(formatUsd(0.0412)).toBe("$0.0412");
    expect(formatUsd(12.5)).toBe("$12.50");
    expect(formatValue(42.4, "percent")).toBe("42%");
  });
  it("longevity tiers and relative time", () => {
    expect([longevity(45), longevity(10), longevity(2), longevity()]).toEqual(["proven", "testing", "new", undefined]);
    expect(timeAgo(new Date(Date.now() - 6 * 3600_000).toISOString())).toBe("6 h ago");
  });
});
