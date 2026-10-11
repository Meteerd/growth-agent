import { beforeEach, describe, expect, it } from "vitest";
import { Brand as BrandSchema, SEED_BRANDS } from "@/contracts";
import { makeCtx } from "@/engine/agent/context";
import { intake, mergeCrawl } from "@/engine/agent/phases/intake";
import { runPipeline } from "@/engine/agent/pipeline";
import type { Db } from "@/engine/db/client";
import { getBrand, getRun, listEvents, patchDossier } from "@/engine/repo";
import { createRun } from "@/engine/runs";
import { seed } from "@/engine/seed";
import { createBrand } from "@/engine/services/brands";
import { freshDb } from "@/engine/test-utils";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  await seed(db);
});

describe("intake phase (demo)", () => {
  for (const b of SEED_BRANDS) {
    it(`produces a valid dossier for ${b.slug} without losing curated fields`, async () => {
      const run = await createRun(db, b.id, "research_only");
      const base = await makeCtx(db, run.id, new AbortController().signal);
      await intake(base.forPhase("intake"));
      const after = BrandSchema.parse(await getBrand(db, b.id));
      expect(after.dossier.oneLiner).toBe(b.dossier.oneLiner);
      expect(after.dossier.positioning).toBe(b.dossier.positioning);
      expect(after.dossier.gaps.length).toBeGreaterThan(0);
      const evs = await listEvents(db, run.id);
      expect(evs.map((e) => e.type)).toEqual(expect.arrayContaining(["tool_call", "tool_result", "thinking"]));
    });
  }

  it("fills an empty dossier for a brand created at runtime and runs the pipeline to the consultation", async () => {
    const { brand, run } = await createBrand(db, { url: "https://example.com", name: "Example" });
    await runPipeline(db, run.id, new AbortController().signal);
    const after = BrandSchema.parse(await getBrand(db, brand.id));
    expect(after.dossier.gaps.some((g) => g.startsWith("Everything"))).toBe(false);
    expect(after.dossier.gaps.length).toBeGreaterThan(0);
    expect((await getRun(db, run.id))?.status).toBe("waiting_input");
    const phases = (await listEvents(db, run.id)).filter((e) => e.type === "phase_started").map((e) => e.phase);
    expect(phases[0]).toBe("intake");
  });

  it("never overwrites operator-edited fields", async () => {
    await patchDossier(db, "brand_hound", { oneLiner: "Operator says this" }, "operator");
    const run = await createRun(db, "brand_hound", "research_only");
    const base = await makeCtx(db, run.id, new AbortController().signal);
    await intake(base.forPhase("intake"));
    expect((await getBrand(db, "brand_hound"))?.dossier.oneLiner).toBe("Operator says this");
  });

  it("mergeCrawl fills empty fields only and takes branding colors", () => {
    const d = { ...SEED_BRANDS[0].dossier, positioning: "", visual: { colors: [] } };
    const x = {
      oneLiner: "x",
      positioning: "new positioning",
      offers: [],
      personas: [],
      voice: { tone: "", do: [], dont: [] },
      proof: ["p"],
      claimsAllowed: [],
      claimsForbidden: [],
      colors: [],
      fonts: [],
      competitors: [],
      gaps: ["g"],
      vertical: "consumer_app" as const,
      countries: [],
      languages: [],
    };
    const m = mergeCrawl(
      d,
      x,
      { url: "https://houndapp.xyz", markdown: "", source: "firecrawl", branding: { colors: { primary: "#ff9b71" } } },
      "t",
    );
    expect(m.oneLiner).toBeUndefined();
    expect(m.positioning).toBe("new positioning");
    expect(m.visual?.colors).toEqual(["#FF9B71"]);
  });
});
