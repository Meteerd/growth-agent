import { beforeEach, describe, expect, it } from "vitest";
import { PATCH as patchRoute } from "@/app/api/runs/[id]/plan/route";
import { ChannelPlan as PlanSchema } from "@/contracts";
import { applyRuleGuards, buildPlan, type ChannelAssessment, weightsFor } from "@/engine/agent/phases/direction";
import type { Db } from "@/engine/db/client";
import { getLatestPlan, getRun } from "@/engine/repo";
import { seed } from "@/engine/seed";
import { ctx, freshDb, req, runToEnd } from "@/engine/test-utils";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  await seed(db);
});

describe("direction phase (demo runs through the real pipeline)", () => {
  it("a.clinic: meta_ads is not now, citing RX4", async () => {
    const runId = await runToEnd(db, "brand_aclinic");
    const plan = PlanSchema.parse(await getLatestPlan(db, runId));
    expect(plan.channels.some((c) => c.channel === "meta_ads")).toBe(false);
    expect(plan.notNow.find((n) => n.channel === "meta_ads")?.reason).toContain("RX4");
    expect((await getRun(db, runId))?.status).toBe("done");
  });

  it("Evreon: LinkedIn first, no TikTok in the top 3", async () => {
    const plan = PlanSchema.parse(await getLatestPlan(db, await runToEnd(db, "brand_evreon")));
    expect(plan.channels[0].channel).toBe("linkedin");
    expect(plan.channels.slice(0, 3).map((c) => c.channel)).not.toContain("tiktok");
  });

  it("Hound: TikTok and Reels recommended, named subreddits as targets, explicit weights", async () => {
    const plan = PlanSchema.parse(await getLatestPlan(db, await runToEnd(db, "brand_hound")));
    const chans = plan.channels.map((c) => c.channel);
    expect(chans).toContain("tiktok");
    expect(chans).toContain("instagram_reels");
    expect(plan.channels.flatMap((c) => c.targets).some((t) => /^r\/\w+/.test(t))).toBe(true);
    expect(Object.values(plan.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    for (const c of plan.channels) expect(c.evidenceIds.length).toBeGreaterThan(0);
  });

  it("PATCH reorders and drops channels into a new version", async () => {
    const runId = await runToEnd(db, "brand_hound");
    const v1 = PlanSchema.parse(await getLatestPlan(db, runId));
    const order = v1.channels.map((c) => c.channel).reverse();
    const dropped = order.pop()!;
    const res = await patchRoute(
      req(`/api/runs/${runId}/plan`, { method: "PATCH", json: { channels: order } }),
      ctx({ id: runId }),
    );
    const v2 = PlanSchema.parse(await res.json());
    expect(v2.version).toBe(2);
    expect(v2.channels.map((c) => c.channel)).toEqual(order);
    expect(v2.notNow.find((n) => n.channel === dropped)?.reason).toContain("operator");
    expect((await getLatestPlan(db, runId))?.version).toBe(2);
  });
});

describe("rule guards", () => {
  const assessment: ChannelAssessment = {
    summary: "s",
    channels: [
      {
        channel: "meta_ads",
        scores: {
          audience: 90,
          provenWins: 90,
          productionFit: 80,
          complianceRisk: 80,
          speedToSignal: 80,
          modelFit: 80,
        },
        recommend: true,
        mode: "paid",
        rationale: "r",
        evidenceIds: [],
        answerIds: [],
        formats: [],
        cadence: "",
        firstSteps: [],
        kpis: [],
        targets: [],
        notNowReason: "",
      },
      {
        channel: "instagram_reels",
        scores: {
          audience: 80,
          provenWins: 80,
          productionFit: 80,
          complianceRisk: 80,
          speedToSignal: 80,
          modelFit: 80,
        },
        recommend: true,
        mode: "both",
        rationale: "r",
        evidenceIds: [],
        answerIds: [],
        formats: [],
        cadence: "",
        firstSteps: [],
        kpis: [],
        targets: [],
        notNowReason: "",
      },
    ],
  };
  it("a model that recommends Meta paid for Rx telehealth is overruled (RX4), Reels forced organic", () => {
    const g = applyRuleGuards(assessment, "eu_rx_telehealth", []);
    const plan = buildPlan("run_x", "b", 1, g, weightsFor("telehealth_rx"), new Set(), new Set());
    expect(plan.channels.map((c) => c.channel)).toEqual(["instagram_reels"]);
    expect(plan.channels[0].mode).toBe("organic");
    expect(plan.notNow[0].reason).toMatch(/^RX4/);
  });
  it("other packs are untouched", () => {
    expect(applyRuleGuards(assessment, "consumer_app_pet", [])).toEqual(assessment);
  });
});
