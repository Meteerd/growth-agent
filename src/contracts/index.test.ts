import { describe, expect, it } from "vitest";
import { CONTRACTS_VERSION } from "@/contracts";

describe("contracts", () => {
  it("exports a version", () => {
    expect(CONTRACTS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
