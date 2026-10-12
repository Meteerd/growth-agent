import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { GET as listBrands } from "@/app/api/brands/route";
import { BrandsResponse, Concept as ConceptSchema } from "@/contracts";
import { type BetaMessage, setClaudeTransport } from "@/engine/agent/claude";
import type { Db } from "@/engine/db/client";
import { brandImages, buildFlagship, planShots, tightenCaptions } from "@/engine/flagship";
import { getBrand, getConcept, listCompliance, listConcepts, upsertConcept } from "@/engine/repo";
import { seed } from "@/engine/seed";
import { loadFixture } from "@/engine/smoke/record";
import { freshDb, runToEnd } from "@/engine/test-utils";

let db: Db;
let runId: string;
beforeAll(async () => {
  process.env.ASSETS_DIR = path.join(os.tmpdir(), `nexus-flag-${Date.now()}`);
  process.env.MANUS_WAIT_SEC = "1";
  db = await freshDb();
  await seed(db);
  runId = await runToEnd(db, "brand_hound");
});
afterEach(() => setClaudeTransport());

describe("A17 flagship remake", () => {
  it("lists the brand's real images (no logos)", () => {
    const files = brandImages("hound");
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((f) => /logo/i.test(f))).toBe(false);
  });

  it("shot sourcing keeps only brand images that exist", async () => {
    const rec = loadFixture<{ response: BetaMessage }>("anthropic", "smoke")!.response;
    const c = (await listConcepts(db, runId)).find((x) => x.blueprintId)!;
    setClaudeTransport(async () => {
      const shots = c.shots.map((s) => ({
        idx: s.idx,
        source: "brand_image",
        imageRef: s.idx === 0 ? "problem-separation.webp" : "does-not-exist.png",
        style: "illustration",
        imagePrompt: "x",
        motion: "push in",
        why: "y",
      }));
      return { ...rec, content: [{ type: "text", text: JSON.stringify({ shots }), citations: null }] } as BetaMessage;
    });
    const brand = (await getBrand(db, "brand_hound"))!;
    const plan = await planShots(db, brand, c, null);
    // in tests Claude stays demo: everything is generated
    expect(plan.shots.every((s) => s.source === "generated")).toBe(true);
  });

  it("builds a flagship render with motion fields, reviews and a contact sheet (demo)", async () => {
    const c = (await listConcepts(db, runId)).find((x) => x.blueprintId)!;
    const sheet = path.join(process.env.ASSETS_DIR!, "sheet.jpg");
    const r = await buildFlagship(db, c.id, { sheetPath: sheet });
    ConceptSchema.parse(r.concept);
    expect(r.concept.shots.every((s) => s.motion && s.source && s.style)).toBe(true);
    expect(r.asset.model).toContain("flagship");
    expect(r.reviews.length).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(sheet)).toBe(true);
    const brands = BrandsResponse.parse(await (await listBrands()).json());
    const hound = brands.find((b) => b.slug === "hound")!;
    expect(hound.heroVideo?.conceptId).toBe(c.id);
    expect((await getConcept(db, c.id))?.videoAssetId).toBe(r.asset.id);
  });

  it("tightens long captions and re-checks them against the rule pack", async () => {
    const c = (await listConcepts(db, runId))[1]!;
    const long = "Your puppy cries every night because nobody showed you this simple routine yet";
    await upsertConcept(db, { ...c, shots: c.shots.map((s, i) => (i === 0 ? { ...s, onScreenText: long } : s)) });
    expect(await tightenCaptions(db, c.id)).toBe(1);
    const after = (await getConcept(db, c.id))!;
    expect(after.shots[0]!.onScreenText!.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(await tightenCaptions(db, c.id)).toBe(0);
  });

  it("refuses a tightened caption that breaks a block rule and keeps the original", async () => {
    const c = (await listConcepts(db, runId))[2]!;
    const long = "Hurry, last chance to fix puppy crying before the weekend ends for good";
    await upsertConcept(db, { ...c, shots: c.shots.map((s, i) => (i === 0 ? { ...s, onScreenText: long } : s)) });
    expect(await tightenCaptions(db, c.id)).toBe(0);
    expect((await getConcept(db, c.id))!.shots[0]!.onScreenText).toBe(long);
    const checks = await listCompliance(db, c.id);
    expect(checks.some((k) => k.status === "fail" && k.findings.some((f) => f.ruleId === "C3"))).toBe(true);
  });
});
