import { describe, expect, it } from "vitest";
import { keepIds, resolveCitations, resolveId } from "@/engine/agent/digest";

const ids = new Set(["ev_evreon369b5a_02_52d515", "ev_evreon369b5a_08_52d515", "ev_x_1", "ev_x_1_a", "ev_x_1_b"]);

describe("evidence id resolution (Claude shortens long ids)", () => {
  it("maps a shortened id to the one real id it prefixes; ambiguous or unknown ids stay unresolved", () => {
    expect(resolveId("ev_evreon369b5a_02", ids)).toBe("ev_evreon369b5a_02_52d515");
    expect(resolveId("ev_x_1", ids)).toBe("ev_x_1");
    expect(resolveId("ev_x", ids)).toBeUndefined();
    expect(resolveId("ev_nope", ids)).toBeUndefined();
  });

  it("keeps resolvable ids once and drops the rest", () => {
    expect(keepIds(["ev_evreon369b5a_02", "ev_evreon369b5a_02_52d515", "ev_nope"], ids)).toEqual([
      "ev_evreon369b5a_02_52d515",
    ]);
  });

  it("repairs ids quoted in prose and leaves everything else as written", () => {
    expect(resolveCitations("Research says so (ev_evreon369b5a_02, ev_evreon369b5a_08). See ev_nope.", ids)).toBe(
      "Research says so (ev_evreon369b5a_02_52d515, ev_evreon369b5a_08_52d515). See ev_nope.",
    );
  });
});

describe("fixture text is well formed", () => {
  it("drops half surrogate pairs from scraped text and keeps whole emoji and styled letters", async () => {
    const { scrub } = await import("@/engine/smoke/record");
    const cut = "Styled \u{1D5D5}\u{1D5EE}".slice(0, -1); // ends in a lone high surrogate
    const out = scrub({ caption: cut, ok: "🐶 𝗕" });
    expect(out.caption).toBe("Styled \u{1D5D5}");
    expect(out.ok).toBe("🐶 𝗕");
    expect(JSON.stringify(out)).not.toMatch(/\\ud[89ab]/i);
  });
});

describe("what Claude is told about the operator", () => {
  it("dossier digest keeps real answers and drops skip notes", async () => {
    const { dossierDigest } = await import("@/engine/agent/digest");
    const { SEED_BRANDS } = await import("@/contracts");
    const b = SEED_BRANDS[0]!;
    const brand = {
      ...b,
      dossier: {
        ...b.dossier,
        operatorNotes: [
          { questionId: "q1", prompt: "Budget?", answer: "Zero paid for now", at: "2026-10-12T00:00:00.000Z" },
          {
            questionId: "q2",
            prompt: "Who is on camera?",
            answer: "Skipped. Assumption: nobody",
            at: "2026-10-12T00:00:00.000Z",
          },
        ],
      },
    };
    const d = JSON.parse(dossierDigest(brand));
    expect(d.operatorAnswers.map((n: { questionId: string }) => n.questionId)).toEqual(["q1"]);
  });

  it("answers digest marks skipped questions as assumptions, never as something the operator said", async () => {
    const { answersDigest } = await import("@/engine/agent/digest");
    const base = { runId: "r", kind: "text", why: "w", evidenceIds: [], required: true } as const;
    const out = answersDigest([
      { ...base, id: "q_1", order: 1, prompt: "Budget?", answer: 0 },
      { ...base, id: "q_2", order: 2, prompt: "Camera?", skipped: true, assumption: "nobody on camera" },
    ] as never);
    expect(out).toContain("[q_1] Budget? -> operator answered: 0");
    expect(out).toContain("[q_2] Camera? -> NOT ANSWERED");
    expect(out).toContain("nobody on camera");
  });

  it("clipCaption handles empty, exact-length and punctuation-only input", async () => {
    const { clipCaption } = await import("@/engine/agent/phases/production");
    expect(clipCaption("")).toBe("");
    const eight = "one two three four five six seven eight";
    expect(clipCaption(eight)).toBe(eight);
    expect(clipCaption("→ → → → → → → → → →")).toBe("→ → → → → → → → → →");
  });
});
