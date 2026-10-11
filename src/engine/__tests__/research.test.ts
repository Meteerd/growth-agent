import { beforeEach, describe, expect, it } from "vitest";
import type { Evidence } from "@/contracts";
import { Evidence as EvidenceSchema } from "@/contracts";
import { makeCtx } from "@/engine/agent/context";
import { research } from "@/engine/agent/phases/research";
import type { Db } from "@/engine/db/client";
import { normMetaAd, normTikTok } from "@/engine/providers/apify";
import { landscapeToEvidence, type ManusEvent, ManusLandscape, manusSchema, taskState } from "@/engine/providers/manus";
import { listEvents, listEvidence } from "@/engine/repo";
import { longevityTier, median, scoreOutliers, winnerRank } from "@/engine/research/metrics";
import { createRun } from "@/engine/runs";
import { seed } from "@/engine/seed";
import { freshDb } from "@/engine/test-utils";
import fixture from "./fixtures/manus-messages.json";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  await seed(db);
});

const ev = (o: Partial<Evidence>): Evidence => ({
  id: Math.random().toString(36),
  brandId: "b",
  runId: "r",
  source: "tiktok",
  kind: "video",
  title: "t",
  metrics: {},
  tags: [],
  capturedAt: "x",
  demo: false,
  ...o,
});

describe("research metrics", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it("longevity tiers: 30+ proven, 7-29 testing, <7 new", () => {
    expect(longevityTier(94)).toBe("proven");
    expect(longevityTier(30)).toBe("proven");
    expect(longevityTier(29)).toBe("testing");
    expect(longevityTier(7)).toBe("testing");
    expect(longevityTier(6)).toBe("new");
    expect(longevityTier(undefined)).toBeUndefined();
  });

  it("outlier score uses the author's batch median when there are 3+ posts, else views/followers", () => {
    const items = [
      ev({ author: "@a", metrics: { views: 1000 } }),
      ev({ author: "@a", metrics: { views: 1000 } }),
      ev({ author: "@a", metrics: { views: 14000 } }),
      ev({ author: "@b", metrics: { views: 50000, followers: 10000 } }),
      ev({ author: "@c", metrics: { likes: 3 } }),
    ];
    scoreOutliers(items);
    expect(items[2].metrics.outlierScore).toBe(14);
    expect(items[0].metrics.outlierScore).toBe(1);
    expect(items[3].metrics.outlierScore).toBe(5);
    expect(items[4].metrics.outlierScore).toBeUndefined();
  });

  it("winner rank puts proven ads and big outliers first", () => {
    const proven = ev({ kind: "ad", metrics: { daysRunning: 94 } });
    const fresh = ev({ kind: "ad", metrics: { daysRunning: 3 } });
    const outlier = ev({ metrics: { views: 2e6, outlierScore: 14 } });
    expect(winnerRank(proven)).toBeGreaterThan(winnerRank(fresh));
    expect(winnerRank(outlier)).toBeGreaterThan(winnerRank(fresh));
  });
});

describe("normalizers", () => {
  const sctx = {
    db: undefined as never,
    runId: "run_abcdef",
    brand: { slug: "hound", id: "brand_hound" } as never,
    demoEvidence: [],
    limit: 5,
  };
  it("TikTok item", () => {
    const e = normTikTok(sctx, {
      text: "POV #dogtraining",
      playCount: 2400000,
      diggCount: 3,
      webVideoUrl: "https://tiktok.com/x",
      authorMeta: { name: "trainer", fans: 1000 },
      videoMeta: { duration: 21 },
      hashtags: [{ name: "dogtraining" }],
    });
    EvidenceSchema.parse(e);
    expect(e.metrics.views).toBe(2400000);
    expect(e.author).toBe("@trainer");
    expect(e.deconstruction?.lengthSec).toBe(21);
  });
  it("Meta Ad Library item: days running from start date", () => {
    const start = Math.round(Date.now() / 1000) - 40 * 86400;
    const e = normMetaAd(sctx, {
      ad_archive_id: "123",
      page_name: "Comp",
      start_date: start,
      is_active: true,
      snapshot: { body: { text: "Take the quiz" }, cta_text: "Learn more" },
    });
    EvidenceSchema.parse(e);
    expect(e.metrics.daysRunning).toBe(40);
    expect(e.url).toContain("123");
  });
});

describe("Manus provider (recorded event log)", () => {
  it("reads running / done / waiting states", () => {
    expect(taskState(fixture.running as ManusEvent[]).state).toBe("running");
    const done = taskState(fixture.done as ManusEvent[]);
    expect(done.state).toBe("done");
    if (done.state === "done") {
      const v = ManusLandscape.parse(done.value);
      const items = landscapeToEvidence(
        {
          db: undefined as never,
          runId: "run_abcdef",
          brand: { slug: "hound", id: "brand_hound", name: "Hound" } as never,
          demoEvidence: [],
          limit: 5,
        },
        v,
        "https://manus.im/app/x",
      );
      expect(items).toHaveLength(3);
      for (const i of items) EvidenceSchema.parse(i);
      expect(items[0].url).toBe("https://manus.im/app/x");
    }
    expect(taskState(fixture.waiting as ManusEvent[])).toEqual({ state: "waiting", question: "Which country first?" });
    // recorded from the real Hound task: waiting on its own sub-agents is still running
    expect(taskState(fixture.subagents as ManusEvent[])).toEqual({
      state: "running",
      brief: "Waiting for 4 research sub-agents",
    });
  });

  it("schema follows Manus rules: all properties required, additionalProperties false", () => {
    const s = manusSchema(ManusLandscape) as {
      required: string[];
      additionalProperties: boolean;
      properties: Record<string, unknown>;
    };
    expect(s.additionalProperties).toBe(false);
    expect(s.required.sort()).toEqual(Object.keys(s.properties).sort());
    expect(JSON.stringify(s)).not.toMatch(/minItems|maxLength|"format"/);
  });
});

describe("research phase (demo)", () => {
  for (const slug of ["hound", "aclinic"]) {
    it(`${slug}: >= 30 evidence from >= 5 sources, streamed as events`, async () => {
      const run = await createRun(db, `brand_${slug}`, "research_only");
      const base = await makeCtx(db, run.id, new AbortController().signal);
      await research(base.forPhase("research"));
      const items = await listEvidence(db, run.id);
      expect(items.length).toBeGreaterThanOrEqual(30);
      expect(new Set(items.map((e) => e.source)).size).toBeGreaterThanOrEqual(5);
      for (const e of items) EvidenceSchema.parse(e);
      const evs = await listEvents(db, run.id);
      expect(evs.filter((e) => e.type === "evidence")).toHaveLength(items.length);
      expect(evs.some((e) => e.type === "tool_call" && e.title.startsWith("manus"))).toBe(true);
    });
  }
});
