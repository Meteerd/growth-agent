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
