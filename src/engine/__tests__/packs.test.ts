import os from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { GET as results } from "@/app/api/brands/[id]/results/route";
import { GET as download } from "@/app/api/packs/[id]/download/route";
import { POST as metrics } from "@/app/api/packs/[id]/metrics/route";
import { POST as posted } from "@/app/api/packs/[id]/posted/route";
import { ResultsResponse } from "@/contracts";
import { type BetaMessage, setClaudeTransport } from "@/engine/agent/claude";
import type { Db } from "@/engine/db/client";
import { insertLearning, listLearnings, listPacksByRun } from "@/engine/repo";
import { seed } from "@/engine/seed";
import { refreshCrossBrand, refreshLearnings } from "@/engine/services/packs";
import { loadFixture } from "@/engine/smoke/record";
import { ctx, freshDb, req, runToEnd } from "@/engine/test-utils";

let db: Db;
let runId: string;
beforeAll(async () => {
  process.env.ASSETS_DIR = path.join(os.tmpdir(), `nexus-packs-${Date.now()}`);
  process.env.MANUS_WAIT_SEC = "1";
  db = await freshDb();
  await seed(db);
  runId = await runToEnd(db, "brand_hound");
}, 120_000);
afterEach(() => setClaudeTransport());

describe("A13 packs, metrics, results", () => {
  it("downloads a zip with the video, caption, hashtags, checklist and cover", async () => {
    const packs = await listPacksByRun(db, runId);
    const p = packs.find((x) => x.videoAssetId)!;
    const res = await download(req(`/api/packs/${p.id}/download`), ctx({ id: p.id }));
    expect(res.headers.get("content-type")).toBe("application/zip");
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const names = Object.keys(files).sort();
    console.log("zip contents:", names.map((n) => `${n} (${files[n].length} B)`).join(", "));
    expect(names).toEqual(expect.arrayContaining(["video.mp4", "caption.txt", "hashtags.txt", "checklist.md"]));
    expect(names.some((n) => n.startsWith("cover"))).toBe(true);
    expect(files["video.mp4"].length).toBeGreaterThan(50_000);
  });

  it("text-post packs zip without video", async () => {
    const p = (await listPacksByRun(db, runId)).find((x) => x.platform === "reddit")!;
    const files = unzipSync(
      new Uint8Array(await (await download(req(`/api/packs/${p.id}/download`), ctx({ id: p.id }))).arrayBuffer()),
    );
    expect(Object.keys(files)).toContain("caption.txt");
    expect(Object.keys(files)).not.toContain("video.mp4");
  });

  it("mark posted, add metrics; results return snapshots ordered by time", async () => {
    const p = (await listPacksByRun(db, runId))[0];
    const bad = await posted(
      req(`/api/packs/${p.id}/posted`, { method: "POST", json: { postedUrl: "not a url" } }),
      ctx({ id: p.id }),
    );
    expect(bad.status).toBe(400);
    const ok = await posted(
      req(`/api/packs/${p.id}/posted`, {
        method: "POST",
        json: { postedUrl: "https://www.tiktok.com/@hound/video/1" },
      }),
      ctx({ id: p.id }),
    );
    expect((await ok.json()).status).toBe("posted");
    const empty = await metrics(req(`/api/packs/${p.id}/metrics`, { method: "POST", json: {} }), ctx({ id: p.id }));
    expect(empty.status).toBe(400);
    await metrics(
      req(`/api/packs/${p.id}/metrics`, {
        method: "POST",
        json: { views: 3214, capturedAt: "2026-10-12T12:00:00.000Z" },
      }),
      ctx({ id: p.id }),
    );
    await metrics(
      req(`/api/packs/${p.id}/metrics`, {
        method: "POST",
        json: { views: 812, likes: 40, capturedAt: "2026-10-12T08:00:00.000Z" },
      }),
      ctx({ id: p.id }),
    );
    const r = ResultsResponse.parse(
      await (await results(req("/api/brands/hound/results"), ctx({ id: "hound" }))).json(),
    );
    const mine = r.packs.find((x) => x.id === p.id)!;
    expect(mine.snapshots.map((s) => s.views)).toEqual([812, 3214]);
    expect(mine.postedUrl).toContain("tiktok.com");
  });

  it("learnings need 2+ posted packs with views, and come from Claude over real numbers", async () => {
    const packs = await listPacksByRun(db, runId);
    const second = packs[1];
    await posted(
      req(`/api/packs/${second.id}/posted`, {
        method: "POST",
        json: { postedUrl: "https://www.instagram.com/reel/x" },
      }),
      ctx({ id: second.id }),
    );
    await metrics(
      req(`/api/packs/${second.id}/metrics`, { method: "POST", json: { views: 1200 } }),
      ctx({ id: second.id }),
    );
    const rec = loadFixture<{ response: BetaMessage }>("anthropic", "smoke")!.response;
    let sent = "";
    setClaudeTransport(async (params) => {
      sent = JSON.stringify(params.messages);
      const text = JSON.stringify({
        learnings: [
          {
            insight: "The reveal beat the Reels post 2.7x.",
            evidence: `${packs[0].id} 3214 views vs ${second.id} 1200`,
            confidence: "low",
          },
        ],
      });
      return { ...rec, content: [{ type: "text", text, citations: null }] } as BetaMessage;
    });
    expect(await refreshLearnings(db, "brand_hound")).toEqual([]); // demo: nothing invented
    const made = await refreshLearnings(db, "brand_hound", { mode: "live" });
    expect(made).toHaveLength(1);
    expect(made[0].evidence).toContain("3214");
    expect(sent).toContain("3214");
    const r = ResultsResponse.parse(
      await (await results(req("/api/brands/hound/results"), ctx({ id: "hound" }))).json(),
    );
    expect(r.learnings[0].insight).toContain("2.7x");
  });

  it("AS5: cross-brand learnings need 2+ brands and are stored as global (brandId null)", async () => {
    const rec = loadFixture<{ response: BetaMessage }>("anthropic", "smoke")!.response;
    setClaudeTransport(async () => {
      const text = JSON.stringify({
        learnings: [
          { insight: "Reveal hooks beat listicles in both brands.", evidence: "learn_a, learn_b", confidence: "low" },
        ],
      });
      return { ...rec, content: [{ type: "text", text, citations: null }] } as BetaMessage;
    });
    await insertLearning(db, {
      id: "learn_b",
      brandId: "brand_aclinic",
      insight: "Reveal beat median",
      evidence: "x",
      confidence: "low",
      createdAt: new Date().toISOString(),
    });
    const made = await refreshCrossBrand(db, { mode: "live" });
    expect(made).toHaveLength(1);
    expect(made[0].brandId).toBeNull();
    const forHound = await listLearnings(db, "brand_hound");
    expect(forHound.some((l) => l.brandId === null)).toBe(true);
  });
});
