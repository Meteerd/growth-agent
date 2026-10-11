import { describe, expect, it } from "vitest";
import { patternHits } from "@/engine/rules";

const ids = (pack: string, t: string, paid = false) => patternHits(pack, t, { paid }).map((h) => h.ruleId);

describe("rule patterns: real violations hit, disclaimers do not", () => {
  it("a.clinic RX1/RX3", () => {
    expect(ids("eu_rx_telehealth", "Get Ozempic online today")).toContain("RX1");
    expect(ids("eu_rx_telehealth", "Lose 10 kg in 3 months")).toContain("RX3");
    expect(ids("eu_rx_telehealth", "Doctor-led weight care from home")).toEqual([]);
  });
  it("Hound P1", () => {
    expect(ids("consumer_app_pet", "This plan will cure separation anxiety in 7 days")).toContain("P1");
    expect(ids("consumer_app_pet", "Practice, not a cure. Progress, not a promise.")).toEqual([]);
  });
  it("Dynova T1: claims hit, the site's own disclaimer does not", () => {
    expect(ids("tr_health_wellness", "Bu test hastalığınıza teşhis koyar")).toContain("T1");
    expect(ids("tr_health_wellness", "This supplement prevents cancer")).toContain("T1");
    expect(
      ids("tr_health_wellness", "Raporlar bilgilendirme amaçlıdır, tıbbi teşhis veya tedavinin yerini tutmaz."),
    ).toEqual([]);
  });
  it("Evreon E1: accuracy claims hit, '0 diagnoses made. By design.' does not", () => {
    expect(ids("b2b_healthtech", "Our AI detects cancer with 97% accuracy")).toContain("E1");
    expect(ids("b2b_healthtech", "0 diagnoses made. By design.")).toEqual([]);
    expect(ids("b2b_healthtech", "The agent never diagnoses; the doctor decides.")).toEqual([]);
  });
});
