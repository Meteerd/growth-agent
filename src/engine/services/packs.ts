import fs from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { z } from "zod";
import type { Learning, MetricSnapshot, MetricsRequest, PostedRequest, PublishPack } from "@/contracts";
import { loadPrompt, structured } from "../agent/claude";
import type { Db } from "../db/client";
import { HttpError } from "../http";
import { newId, nowIso, slugify } from "../ids";
import { extractFrame } from "../media/ffmpeg";
import {
  appendEvent,
  getAsset,
  getBrand,
  getConcept,
  getPack,
  insertLearning,
  insertSnapshot,
  listLearnings,
  listPacksByBrand,
  listSnapshots,
  upsertPack,
} from "../repo";
import { urlToFile } from "../video/files";

/** Zip: video.mp4 (or images), caption.txt, hashtags.txt, first-comment.txt, checklist.md, cover.jpg. */
export async function packZip(db: Db, packId: string): Promise<{ name: string; data: Uint8Array; files: string[] }> {
  const p = await getPack(db, packId);
  if (!p) throw new HttpError(404, "not_found", "Pack not found");
  const concept = await getConcept(db, p.conceptId);
  if (concept?.compliance === "fail")
    throw new HttpError(409, "compliance_failed", "Export is blocked: the concept failed compliance");
  const files: Record<string, Uint8Array> = {};
  files["caption.txt"] = strToU8(`${p.caption}\n`);
  files["hashtags.txt"] = strToU8(`${p.hashtags.join(" ")}\n`);
  if (p.firstComment) files["first-comment.txt"] = strToU8(`${p.firstComment}\n`);
  files["checklist.md"] = strToU8(
    [
      `# Posting checklist: ${concept?.title ?? p.id}`,
      "",
      `Platform: ${p.platform}`,
      p.postAt ? `Suggested time: ${p.postAt}` : "",
      "",
      ...p.checklist.map((c) => `- [ ] ${c}`),
      "",
    ].join("\n"),
  );
  let coverSrc: string | null = null;
  if (p.videoAssetId) {
    const v = await getAsset(db, p.videoAssetId);
    const f = v ? urlToFile(v.url) : null;
    if (f && fs.existsSync(f)) {
      files["video.mp4"] = fs.readFileSync(f);
      const cover = `${f}.cover.jpg`;
      if (!fs.existsSync(cover)) await extractFrame(f, 0.6, cover, 1080).catch(() => undefined);
      if (fs.existsSync(cover)) coverSrc = cover;
    }
  }
  for (const [i, id] of p.imageAssetIds.entries()) {
    const a = await getAsset(db, id);
    const f = a ? urlToFile(a.url) : null;
    if (f && fs.existsSync(f)) {
      files[`images/${String(i + 1).padStart(2, "0")}${path.extname(f)}`] = fs.readFileSync(f);
      coverSrc ??= f;
    }
  }
  if (coverSrc) files[`cover${path.extname(coverSrc) === ".png" ? ".png" : ".jpg"}`] = fs.readFileSync(coverSrc);
  const data = zipSync(files, { level: 0 });
  const name = `${slugify(concept?.title ?? p.id)}-${p.platform}.zip`;
  return { name, data, files: Object.keys(files) };
}

export async function markPosted(db: Db, packId: string, body: PostedRequest): Promise<PublishPack> {
  const p = await getPack(db, packId);
  if (!p) throw new HttpError(404, "not_found", "Pack not found");
  try {
    new URL(body.postedUrl);
  } catch {
    throw new HttpError(400, "invalid_url", "postedUrl must be a URL");
  }
  const next: PublishPack = { ...p, status: "posted", postedUrl: body.postedUrl, postedAt: body.postedAt ?? nowIso() };
  await upsertPack(db, next);
  if (p.runId)
    await appendEvent(db, {
      runId: p.runId,
      phase: "measure",
      type: "log",
      title: `Posted on ${p.platform}`,
      refId: p.id,
      detail: body.postedUrl,
    });
  return next;
}

/** Manual metrics (never invented). Learnings refresh in the background afterwards. */
export async function addMetrics(db: Db, packId: string, body: MetricsRequest): Promise<MetricSnapshot> {
  const p = await getPack(db, packId);
  if (!p) throw new HttpError(404, "not_found", "Pack not found");
  const { capturedAt, ...m } = body;
  if (!Object.values(m).some((v) => v !== undefined))
    throw new HttpError(400, "empty_metrics", "Send at least one metric");
  const s: MetricSnapshot = { id: newId("snap"), packId, capturedAt: capturedAt ?? nowIso(), ...m, source: "manual" };
  await insertSnapshot(db, s);
  void refreshLearnings(db, p.brandId)
    .then((made) => (made.length ? refreshCrossBrand(db) : []))
    .catch(() => undefined);
  return s;
}

export async function results(db: Db, brandId: string) {
  const packs = await listPacksByBrand(db, brandId);
  const snaps = await listSnapshots(
    db,
    packs.map((p) => p.id),
  );
  return {
    packs: packs.map((p) => ({ ...p, snapshots: snaps.filter((s) => s.packId === p.id) })),
    learnings: await listLearnings(db, brandId),
  };
}

const LearningDrafts = z.object({
  learnings: z.array(
    z.object({ insight: z.string(), evidence: z.string(), confidence: z.enum(["low", "medium", "high"]) }),
  ),
});

/** Rewrite the brand's learnings from its posted packs' latest metrics (needs 2+ posted packs with views). */
export async function refreshLearnings(
  db: Db,
  brandId: string,
  opts: { mode?: "live" | "demo" } = {},
): Promise<Learning[]> {
  const brand = await getBrand(db, brandId);
  if (!brand) return [];
  const r = await results(db, brandId);
  const rows = [];
  for (const p of r.packs.filter((x) => x.status === "posted" && x.snapshots.some((s) => s.views !== undefined))) {
    const c = await getConcept(db, p.conceptId);
    const last = p.snapshots.at(-1)!;
    rows.push({
      packId: p.id,
      platform: p.platform,
      format: c?.format,
      hook: c?.hook,
      language: c?.language,
      postedAt: p.postedAt,
      latest: last,
    });
  }
  if (rows.length < 2) return [];
  const out = await structured(
    { db, mode: opts.mode },
    {
      route: "extraction",
      system: loadPrompt("learnings"),
      user: JSON.stringify({ brand: brand.name, posts: rows }),
      schema: LearningDrafts,
      note: `learnings: ${brand.slug}`,
      maxTokens: 4000,
      demo: () => ({ learnings: [] }),
    },
  );
  const made: Learning[] = [];
  for (const l of out.value.learnings.slice(0, 6)) {
    const row: Learning = {
      id: newId("learn"),
      brandId,
      insight: l.insight,
      evidence: l.evidence,
      confidence: l.confidence,
      createdAt: nowIso(),
    };
    await insertLearning(db, row);
    made.push(row);
  }
  return made;
}

/** AS5: promote a pattern to a global learning (brandId null) only when it holds in 2+ brands. */
export async function refreshCrossBrand(db: Db, opts: { mode?: "live" | "demo" } = {}): Promise<Learning[]> {
  const all = (await listLearnings(db)).filter((l) => l.brandId);
  const brands = new Set(all.map((l) => l.brandId));
  if (brands.size < 2) return [];
  const out = await structured(
    { db, mode: opts.mode },
    {
      route: "extraction",
      system: loadPrompt("learnings"),
      user: JSON.stringify({
        mode: "cross_brand",
        learnings: all.map((l) => ({
          id: l.id,
          brandId: l.brandId,
          insight: l.insight,
          evidence: l.evidence,
          confidence: l.confidence,
        })),
      }),
      schema: LearningDrafts,
      note: "learnings: cross-brand",
      maxTokens: 4000,
      demo: () => ({ learnings: [] }),
    },
  );
  const made: Learning[] = [];
  for (const l of out.value.learnings.slice(0, 5)) {
    const row: Learning = {
      id: newId("learn"),
      brandId: null,
      insight: l.insight,
      evidence: l.evidence,
      confidence: l.confidence,
      createdAt: nowIso(),
    };
    await insertLearning(db, row);
    made.push(row);
  }
  return made;
}
