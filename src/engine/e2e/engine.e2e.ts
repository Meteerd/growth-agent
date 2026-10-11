import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  Blueprint,
  ChannelPlan,
  ComplianceCheck,
  Concept,
  Evidence,
  PHASES,
  PublishPack,
  Question,
  Review,
  Run,
  RunEvent,
  SEED_BRANDS,
} from "@/contracts";
import type { Db } from "@/engine/db/client";
import { probe } from "@/engine/media/ffmpeg";
import * as repo from "@/engine/repo";
import { seed } from "@/engine/seed";
import { freshDb, runToEnd } from "@/engine/test-utils";
import { urlToFile } from "@/engine/video/files";

/**
 * Engine e2e: one full GTM run per seeded brand in demo mode (no live calls), through the real pipeline:
 * intake -> research -> reverse_engineer -> consult (answered) -> direction -> production -> review -> compliance -> pack.
 */
let db: Db;
const runs: Record<string, string> = {};

beforeAll(async () => {
  process.env.ASSETS_DIR = path.join(os.tmpdir(), `nexus-e2e-${Date.now()}`);
  db = await freshDb();
  await seed(db);
  for (const b of SEED_BRANDS) runs[b.slug] = await runToEnd(db, b.id);
});

const EXPECTED_ORDER = PHASES.filter((p) => p !== "measure");

for (const b of SEED_BRANDS) {
  describe(`${b.name}: full run`, () => {
    it("finishes done with every phase in order and valid entities", async () => {
      const id = runs[b.slug];
      const run = Run.parse(await repo.getRun(db, id));
      expect(run.status).toBe("done");
      const events = (await repo.listEvents(db, id)).map((e) => RunEvent.parse(e));
      expect(events.map((e) => e.id)).toEqual(events.map((_, i) => i + 1));
      expect(events.filter((e) => e.type === "phase_started").map((e) => e.phase)).toEqual(EXPECTED_ORDER);
      expect(events.filter((e) => e.type === "phase_completed").map((e) => e.phase)).toEqual(EXPECTED_ORDER);
      expect(events.some((e) => e.type === "error")).toBe(false);
      for (const e of await repo.listEvidence(db, id)) Evidence.parse(e);
      for (const q of await repo.listQuestions(db, id)) Question.parse(q);
      ChannelPlan.parse(await repo.getLatestPlan(db, id));
      for (const p of await repo.listPacksByRun(db, id)) PublishPack.parse(p);
    });

    it("has at least one blueprint, a remake concept with a shotMap, and at least one review", async () => {
      const id = runs[b.slug];
      const bps = (await repo.listBlueprints(db, id)).map((x) => Blueprint.parse(x));
      expect(bps.length).toBeGreaterThanOrEqual(1);
      const concepts = (await repo.listConcepts(db, id)).map((c) => Concept.parse(c));
      const remake = concepts.find((c) => c.blueprintId && c.shotMap?.length);
      expect(remake).toBeDefined();
      expect(remake?.shotMap?.length).toBe(bps.find((x) => x.id === remake?.blueprintId)?.shots.length);
      const reviews = (await repo.listReviews(db, remake!.id)).map((r) => Review.parse(r));
      expect(reviews.length).toBeGreaterThanOrEqual(1);
    });

    it("compliance: every concept checked, nothing exported that failed", async () => {
      const id = runs[b.slug];
      const concepts = await repo.listConcepts(db, id);
      const packs = await repo.listPacksByRun(db, id);
      for (const c of concepts) {
        const checks = (await repo.listCompliance(db, c.id)).map((x) => ComplianceCheck.parse(x));
        expect(checks.length).toBeGreaterThanOrEqual(1);
        expect(checks.at(-1)?.rulePack).toBe(b.rulePack);
        if (c.compliance === "fail") expect(packs.some((p) => p.conceptId === c.id)).toBe(false);
      }
      expect(packs.length).toBeGreaterThanOrEqual(1);
    });
  });
}

describe("brand-specific outcomes", () => {
  it("Hound: an MP4 exists for the remake (1080x1920)", async () => {
    const remake = (await repo.listConcepts(db, runs.hound)).find((c) => c.blueprintId)!;
    const asset = await repo.getAsset(db, remake.videoAssetId!);
    const file = urlToFile(asset!.url)!;
    expect(fs.existsSync(file)).toBe(true);
    const info = await probe(file);
    expect([info.width, info.height]).toEqual([1080, 1920]);
    console.log(`Hound MP4: ${asset!.url} ${info.durationSec}s ${info.width}x${info.height} audio=${info.hasAudio}`);
  });

  it("a.clinic: Meta paid is not now (RX4); no concept names a prescription medicine", async () => {
    const plan = await repo.getLatestPlan(db, runs.aclinic);
    expect(plan?.notNow.find((n) => n.channel === "meta_ads")?.reason).toContain("RX4");
    for (const c of await repo.listConcepts(db, runs.aclinic)) {
      expect(JSON.stringify(c)).not.toMatch(/ozempic|wegovy|mounjaro|semaglutid|tirzepatid/i);
    }
  });

  it("Evreon: LinkedIn first, no TikTok in the top 3", async () => {
    const plan = await repo.getLatestPlan(db, runs.evreon);
    expect(plan?.channels[0].channel).toBe("linkedin");
    expect(plan?.channels.slice(0, 3).map((c) => c.channel)).not.toContain("tiktok");
  });
});
