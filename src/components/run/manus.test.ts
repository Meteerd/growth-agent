import { describe, expect, it } from "vitest";
import hound from "@/contracts/fixtures/live/runs/hound.json";
import { landscapeLead, manusRows } from "./manus";

const text = (tag: string) =>
  (hound.evidence as { source: string; tags?: string[]; text?: string }[]).find(
    (e) => e.source === "manus_research" && e.tags?.includes(tag),
  )?.text;

describe("Manus findings on the recorded Hound run", () => {
  it("lists the 10 competitors and 6 communities with one sentence each", () => {
    const comps = manusRows(text("competitors"));
    expect(comps).toHaveLength(10);
    expect(comps[0]).toEqual({
      name: "Woofz",
      note: "Google Trends-driven per-problem surveys funnel to paid app.",
    });
    const rules = manusRows(text("communities"));
    expect(rules.map((r) => r.name)).toContain("r/DogTraining");
    expect(rules).toHaveLength(6);
    expect(rules.every((r) => r.note.length > 10 && !r.note.includes("http"))).toBe(true);
  });

  it("keeps one clean sentence of the landscape", () => {
    const lead = landscapeLead(text("landscape"));
    expect(lead.startsWith("The GTM landscape for Hound")).toBe(true);
    expect(lead).not.toMatch(/["}]/);
    expect(lead.split(". ")).toHaveLength(1);
  });

  it("ignores lines that are not 'Name (url): note'", () => {
    expect(manusRows("no list here\nAlso (not a url): x")).toEqual([]);
    expect(landscapeLead(undefined)).toBe("");
  });
});
