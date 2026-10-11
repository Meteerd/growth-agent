import { describe, expect, it } from "vitest";
import {
  Blueprint,
  Brand,
  ChannelPlan,
  CONTRACTS_VERSION,
  ComplianceCheck,
  Concept,
  Connection,
  DEMO_RUNS,
  Evidence,
  PublishPack,
  Question,
  Review,
  Run,
  RunEvent,
  SEED_BRANDS,
} from "@/contracts";

describe("contracts", () => {
  it("exports a version", () => {
    expect(CONTRACTS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("seed brands parse and have unique slugs", () => {
    for (const b of SEED_BRANDS) Brand.parse(b);
    expect(new Set(SEED_BRANDS.map((b) => b.slug)).size).toBe(4);
  });

  for (const [slug, bundle] of Object.entries(DEMO_RUNS)) {
    describe(`demo run: ${slug}`, () => {
      it("every entity parses with its schema", () => {
        Brand.parse(bundle.brand);
        Run.parse(bundle.run);
        for (const c of bundle.connections) Connection.parse(c);
        for (const e of bundle.evidence) Evidence.parse(e);
        for (const q of bundle.questions) Question.parse(q);
        ChannelPlan.parse(bundle.plan);
        for (const c of bundle.concepts) Concept.parse(c);
        for (const c of bundle.compliance) ComplianceCheck.parse(c);
        for (const p of bundle.packs) PublishPack.parse(p);
        for (const e of bundle.events) RunEvent.parse(e);
        for (const b of bundle.blueprints) Blueprint.parse(b);
        for (const r of bundle.reviews) Review.parse(r);
      });

      it("has a blueprint, an aligned remake with a shotMap, and two review rounds", () => {
        expect(bundle.blueprints.length).toBeGreaterThanOrEqual(1);
        const bp = bundle.blueprints[0];
        expect(bundle.evidence.some((e) => e.id === bp.evidenceId)).toBe(true);
        const remake = bundle.concepts.find((c) => c.blueprintId === bp.id);
        expect(remake).toBeDefined();
        expect(remake?.shotMap?.length).toBe(bp.shots.length);
        expect(remake?.shots.length).toBe(bp.shots.length);
        const rounds = bundle.reviews.filter((r) => r.conceptId === remake?.id);
        expect(rounds.map((r) => r.round)).toEqual([1, 2]);
        expect(rounds[0].decision).toBe("regenerate");
        expect(rounds[1].decision).toBe("accept");
        const weakest = rounds[0].perShot.reduce((a, b) => (b.score < a.score ? b : a));
        expect(rounds[0].regeneratedShots).toEqual([weakest.idx]);
      });

      it("phases appear in pipeline order", () => {
        const order = [
          "intake",
          "research",
          "reverse_engineer",
          "consult",
          "direction",
          "production",
          "review",
          "compliance",
          "pack",
        ];
        const seen = bundle.events.filter((e) => e.type === "phase_started").map((e) => e.phase);
        expect(seen).toEqual(order);
      });

      it("demo rows are labelled and ids resolve", () => {
        expect(bundle.run.demo).toBe(true);
        expect(bundle.evidence.every((e) => e.demo)).toBe(true);
        const evIds = new Set(bundle.evidence.map((e) => e.id));
        expect(evIds.size).toBe(bundle.evidence.length);
        const cited = [
          ...bundle.questions.flatMap((q) => q.evidenceIds),
          ...bundle.plan.channels.flatMap((c) => c.evidenceIds),
          ...bundle.plan.notNow.flatMap((n) => n.evidenceIds),
          ...bundle.concepts.flatMap((c) => c.remakesEvidenceIds),
        ];
        for (const id of cited) expect(evIds.has(id), id).toBe(true);
        for (const q of bundle.questions) expect(q.why.length).toBeGreaterThan(20);
      });

      it("events are monotonic and end with done", () => {
        bundle.events.forEach((e, i) => {
          expect(e.id).toBe(i + 1);
        });
        expect(bundle.events.at(-1)?.data).toEqual({ status: "done" });
      });

      it("plan priorities are ordered by score and weights sum to 1", () => {
        const w = Object.values(bundle.plan.weights).reduce((a, b) => a + b, 0);
        expect(w).toBeCloseTo(1, 5);
        const scores = bundle.plan.channels.map((c) => c.score);
        expect([...scores].sort((a, b) => b - a)).toEqual(scores);
      });
    });
  }

  it("Hound has format variants of its remake (static + text)", () => {
    const h = DEMO_RUNS.hound;
    const variants = h.concepts.filter((c) => c.variantOf === "concept_hound_1");
    expect(variants.map((v) => v.format).sort()).toEqual(["static", "text_post"]);
  });

  it("Hound and a.clinic are rich: 30+ evidence from 5+ sources, 6 questions, 4 concepts with shots", () => {
    for (const slug of ["hound", "aclinic"]) {
      const b = DEMO_RUNS[slug];
      expect(b.evidence.length).toBeGreaterThanOrEqual(30);
      expect(new Set(b.evidence.map((e) => e.source)).size).toBeGreaterThanOrEqual(5);
      expect(b.evidence.filter((e) => e.deconstruction).length).toBeGreaterThanOrEqual(15);
      expect(b.questions.length).toBe(6);
      expect(b.concepts.length).toBeGreaterThanOrEqual(4);
      expect(b.concepts.filter((c) => c.shots.length >= 4).length).toBeGreaterThanOrEqual(3);
      expect(b.packs.length).toBe(b.concepts.length);
    }
  });

  it("direction expectations hold in the fixtures", () => {
    const a = DEMO_RUNS.aclinic.plan;
    const metaNotNow = a.notNow.find((n) => n.channel === "meta_ads");
    expect(metaNotNow?.reason).toContain("RX4");
    expect(a.channels.some((c) => c.channel === "meta_ads")).toBe(false);
    const e = DEMO_RUNS.evreon.plan;
    expect(e.channels[0].channel).toBe("linkedin");
    expect(e.channels.slice(0, 3).some((c) => c.channel === "tiktok")).toBe(false);
    const h = DEMO_RUNS.hound.plan;
    const hc = h.channels.map((c) => c.channel);
    expect(hc).toContain("tiktok");
    expect(hc).toContain("instagram_reels");
    expect(h.channels.find((c) => c.channel === "reddit")?.targets.some((t) => t.startsWith("r/"))).toBe(true);
  });
});
