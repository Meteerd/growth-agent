import { analyzeRefs } from "./analyze";
import { mustBrand } from "./config";
import { type BatchInput, generateBatch, reviseAd } from "./generate";
import { type JobCtx, registerJob } from "./jobs";
import { type ScanInput, scanCompetitors } from "./scan";
import { type SetupInput, setupBrand } from "./setup";
import type { ImageModel } from "./types";

/** Job kinds of the studio. Imported lazily by jobs.ts. */

const brandOf = async (ctx: JobCtx) => {
  const id = (ctx.job.input.brand as string | undefined) ?? ctx.job.brandId;
  if (!id) throw new Error("No brand given");
  return mustBrand(ctx.db, id);
};

registerJob("setup", async (ctx) => {
  const { brand, config } = await setupBrand(ctx, ctx.job.input as unknown as SetupInput);
  return { brand: brand.slug, competitors: config.competitors.map((c) => c.name), images: config.brandImages.length };
});

registerJob("scan", async (ctx) => {
  const brand = await brandOf(ctx);
  return scanCompetitors(ctx, brand, ctx.job.input as ScanInput);
});

registerJob("analyze", async (ctx) => {
  const brand = await brandOf(ctx);
  return analyzeRefs(ctx, brand, ctx.job.input as { limit?: number; force?: boolean });
});

registerJob("generate", async (ctx) => {
  const brand = await brandOf(ctx);
  return generateBatch(ctx, brand, ctx.job.input as BatchInput);
});

registerJob("revise", async (ctx) => {
  const brand = await brandOf(ctx);
  const i = ctx.job.input as { adId: string; feedback: string; model?: ImageModel };
  return reviseAd(ctx, brand, i.adId, i.feedback, { model: i.model });
});

/** The whole funnel from a URL: setup, competitor scan, teardown + playbook, first batch. */
registerJob("autopilot", async (ctx) => {
  const i = ctx.job.input as unknown as SetupInput & { batch?: BatchInput };
  const sub = (from: number, to: number): JobCtx => ({
    ...ctx,
    step: (name, p) => ctx.step(name, p === undefined ? undefined : from + (to - from) * p),
  });
  const { brand } = await setupBrand(sub(0, 0.2), i);
  let scanned = { saved: 0 } as { saved: number };
  try {
    scanned = await scanCompetitors(sub(0.2, 0.4), brand, { perSource: 30 });
  } catch (e) {
    await ctx.log(`Competitor scan skipped: ${e instanceof Error ? e.message : e}`);
  }
  if (scanned.saved) await analyzeRefs(sub(0.4, 0.6), brand, { limit: 32 });
  const batch = await generateBatch(sub(0.6, 1), brand, { count: 6, carousels: 2, ...(i.batch ?? {}) });
  return { brand: brand.slug, refs: scanned.saved, batch: batch.batchId, ads: batch.ads };
});
