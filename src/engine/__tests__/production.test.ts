import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as renderRoute } from "@/app/api/concepts/[id]/render/route";
import { Concept as ConceptSchema, Review as ReviewSchema, SEED_BRANDS } from "@/contracts";
import { checkText, conceptText } from "@/engine/compliance/check";
import { checkAndRevise } from "@/engine/compliance/check-and-revise";
import type { Db } from "@/engine/db/client";
import { probe } from "@/engine/media/ffmpeg";
import { getAsset, getBlueprint, listAssets, listConcepts, listReviews, upsertConcept } from "@/engine/repo";
import { seed } from "@/engine/seed";
import { estimateRender, renderConcept } from "@/engine/services/concepts";
import { ctx, freshDb, req, runToEnd } from "@/engine/test-utils";
import { urlToFile } from "@/engine/video/files";

let db: Db;
let runId: string;
beforeAll(async () => {
  process.env.ASSETS_DIR = path.join(os.tmpdir(), `nexus-prod-${Date.now()}`);
  process.env.MANUS_WAIT_SEC = "1";
  db = await freshDb();
  await seed(db);
  runId = await runToEnd(db, "brand_hound");
}, 120_000);

const hound = SEED_BRANDS.find((b) => b.slug === "hound")!;
const aclinic = SEED_BRANDS.find((b) => b.slug === "aclinic")!;

describe("A11 production + video", () => {
  it("renders a playable 1080x1920 MP4 for a Hound concept", async () => {
    const concepts = await listConcepts(db, runId);
    const remake = concepts.find((c) => c.blueprintId)!;
    const video = await getAsset(db, remake.videoAssetId!);
    const info = await probe(urlToFile(video!.url)!);
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1920);
    expect(info.hasAudio).toBe(true);
    const shotsSec = remake.shots.reduce((a, s) => a + s.durationSec, 0);
    expect(info.durationSec).toBeGreaterThanOrEqual(shotsSec);
    expect(video?.demo).toBe(true);
  });

  it("cost estimate comes from the price table and render route returns it", async () => {
    const concepts = await listConcepts(db, runId);
    const c = concepts.find((x) => !x.blueprintId && x.shots.length > 2)!;
    const est = estimateRender(c, "final");
    expect(est.totalUsd).toBeGreaterThan(0);
    expect(est.lines.map((l) => l.provider)).toEqual(["openai", "fal", "openai"]);
    const res = await renderRoute(
      req(`/api/concepts/${c.id}/render`, { method: "POST", json: { tier: "draft" } }),
      ctx({ id: c.id }),
    );
    expect(res.status).toBe(202);
    expect((await res.json()).estimatedCostUsd).toBeTypeOf("number");
  });
});

describe("A11b remake from blueprint + formats", () => {
  it("the 9:16 remake maps 1:1 to blueprint shots and purposes; static and text variants exist; all pass compliance", async () => {
    const concepts = await listConcepts(db, runId);
    for (const c of concepts) ConceptSchema.parse(c);
    const remake = concepts.find((c) => c.blueprintId)!;
    const bp = (await getBlueprint(db, remake.blueprintId!))!;
    expect(remake.aspect).toBe("9:16");
    expect(remake.shots).toHaveLength(bp.shots.length);
    expect(remake.shotMap?.map((m) => m.blueprintShotIdx)).toEqual(bp.shots.map((s) => s.idx));
    const variants = concepts.filter((c) => c.variantOf === remake.id);
    expect(variants.map((v) => v.format)).toEqual(expect.arrayContaining(["static", "text_post"]));
    expect(concepts.every((c) => c.compliance === "pass" || c.compliance === "warn")).toBe(true);
  });
});

describe("A11c self-review loop", () => {
  it("two review rounds with per-shot scores; the round-1 weakest shot got a new keyframe", async () => {
    const remake = (await listConcepts(db, runId)).find((c) => c.blueprintId)!;
    const reviews = await listReviews(db, remake.id);
    for (const r of reviews) ReviewSchema.parse(r);
    expect(reviews.map((r) => r.round)).toEqual([1, 2]);
    expect(reviews[0].perShot).toHaveLength(remake.shots.length);
    const weakest = reviews[0].perShot.reduce((a, b) => (b.score < a.score ? b : a));
    expect(reviews[0].decision).toBe("regenerate");
    expect(reviews[0].regeneratedShots).toEqual([weakest.idx]);
    const kfs = (await listAssets(db, remake.id)).filter((a) => a.kind === "keyframe" && a.shotIdx === weakest.idx);
    expect(kfs.length).toBeGreaterThanOrEqual(2);
    expect(remake.shots[weakest.idx].keyframeAssetId).toBe(kfs.at(-1)?.id);
    expect(reviews[1].perShot[weakest.idx].score).toBeGreaterThan(weakest.score);
    expect(reviews[1].assetId).not.toBe(reviews[0].assetId);
    console.log(
      JSON.stringify(
        reviews.map((r) => ({
          round: r.round,
          overall: r.overall,
          decision: r.decision,
          regenerated: r.regeneratedShots,
          perShot: r.perShot.map((p) => p.score),
        })),
      ),
    );
  });
});

describe("A12 compliance", () => {
  it("an a.clinic caption naming Ozempic fails RX1; the clean version passes", async () => {
    const bad = await checkText(db, {
      brand: aclinic,
      text: "Caption: Get Ozempic online today with a doctor.",
      targetType: "caption",
      targetId: "t1",
    });
    expect(bad.status).toBe("fail");
    expect(bad.findings.map((f) => f.ruleId)).toContain("RX1");
    const good = await checkText(db, {
      brand: aclinic,
      text: "Caption: Doctor-led weight care from home. Full price shown before you pay.",
      targetType: "caption",
      targetId: "t2",
    });
    expect(good.status).toBe("pass");
  });

  it("a Hound script promising to cure separation anxiety in 7 days fails P1; the clean version passes", async () => {
    const bad = await checkText(db, {
      brand: hound,
      text: "Voiceover: This plan will cure separation anxiety in 7 days.",
      targetType: "shot",
      targetId: "t3",
    });
    expect(bad.status).toBe("fail");
    expect(bad.findings.map((f) => f.ruleId)).toContain("P1");
    const good = await checkText(db, {
      brand: hound,
      text: "Voiceover: Ten minutes a day to practice calmer goodbyes.",
      targetType: "shot",
      targetId: "t4",
    });
    expect(good.status).toBe("pass");
  });

  it("auto-revise fixes a failing concept; a concept that stays failing blocks rendering", async () => {
    const remake = (await listConcepts(db, runId)).find((c) => c.blueprintId)!;
    const dirty = {
      ...remake,
      id: `${remake.id}_dirty`,
      caption: "This will cure separation anxiety in 7 days, guaranteed.",
    };
    const { concept, checks } = await checkAndRevise(db, hound, dirty, runId);
    expect(checks[0].status).toBe("fail");
    expect(concept.compliance).not.toBe("fail");
    expect(conceptText(concept)).not.toMatch(/cure/i);
    await upsertConcept(db, { ...dirty, compliance: "fail" });
    await expect(renderConcept(db, dirty.id, "draft")).rejects.toThrow(/compliance/);
  });
});

describe("packs follow the newest render", () => {
  it("re-rendering a concept updates its ready packs' video", async () => {
    const { listPacksByRun: packsOf } = await import("@/engine/repo");
    const remake = (await listConcepts(db, runId)).find((c) => c.blueprintId)!;
    const before = (await packsOf(db, runId)).find((p) => p.conceptId === remake.id)!;
    const { asset } = await renderConcept(db, remake.id, "draft", { label: "again" });
    const after = (await packsOf(db, runId)).find((p) => p.conceptId === remake.id)!;
    expect(after.videoAssetId).toBe(asset.id);
    expect(after.videoAssetId).not.toBe(before.videoAssetId);
  });
});

describe("caption readability", () => {
  it("shortens video captions over 12 words and leaves statics and short captions alone", async () => {
    const { makeCtx } = await import("@/engine/agent/context");
    const { shortenVideoCaptions } = await import("@/engine/agent/phases/production");
    const pctx = (await makeCtx(db, runId, new AbortController().signal)).forPhase("production");
    const all = await listConcepts(db, runId);
    const video = all.find((c) => c.shots.length > 1 && !["static", "carousel", "text_post"].includes(c.format))!;
    const still = all.find((c) => c.format === "static" || c.format === "carousel")!;
    const long = "Bu cümle çok uzun. Kısa bir videoda okunamaz, çünkü on iki kelimeden fazla var";
    const put = (c: typeof video) => ({
      ...c,
      shots: c.shots.map((s, i) => (i === 0 ? { ...s, onScreenText: long } : s)),
    });
    const [v, st] = await shortenVideoCaptions(pctx, [put(video), put(still)]);
    expect(v!.shots[0]!.onScreenText).toBe("Bu cümle çok uzun. Kısa bir videoda okunamaz");
    expect(v!.shots[1]!.onScreenText).toBe(video.shots[1]!.onScreenText);
    expect(st!.shots[0]!.onScreenText).toBe(long);
    const same = [video];
    expect(await shortenVideoCaptions(pctx, same)).toBe(same);
  });
});

describe("clipCaption (fallback without a model)", () => {
  it("keeps whole clauses and never cuts mid-phrase", async () => {
    const { clipCaption } = await import("@/engine/agent/phases/production");
    expect(clipCaption("Dotazník, keď máš čas → video s licencovaným lekárom → lekár rozhodne, čo je vhodné")).toBe(
      "Dotazník, keď máš čas",
    );
    const noBoundary = "Your puppy cries every night because nobody showed you this simple routine yet";
    expect(clipCaption(noBoundary)).toBe(noBoundary);
    expect(clipCaption("Short and fine")).toBe("Short and fine");
  });
});
