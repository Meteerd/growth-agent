/**
 * pnpm onboard <url> <name> [--vertical consumer_app] [--countries US,GB,ES] [--languages en,es]
 * Create a brand and run intake + live research up to the consultation (the operator answers in the cockpit).
 * Spiral, Apify and Manus are forced live for this run (within their caps).
 */
import { loadEnv } from "./env";

loadEnv();
const args = process.argv.slice(2);
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
process.env.NEXUS_FORCE_LIVE = "spiral,apify,manus,firecrawl,youtube,revenuecat,posthog,databricks";
const { getDb } = await import("@/engine/db/client");
const { createBrand } = await import("@/engine/services/brands");
const { runPipeline } = await import("@/engine/agent/pipeline");
const repo = await import("@/engine/repo");
const db = await getDb();
const t0 = Date.now();
const existing = (await repo.listBrands(db)).find((b) => b.url.includes(new URL(args[0]!).hostname));
const { brand, run } = existing
  ? { brand: existing, run: await (await import("@/engine/runs")).createRun(db, existing.id, "full") }
  : await createBrand(db, {
      url: args[0]!,
      name: args[1],
      vertical: (arg("--vertical") as "consumer_app") ?? "consumer_app",
      countries: (arg("--countries") ?? "").split(",").filter(Boolean),
      languages: (arg("--languages") ?? "").split(",").filter(Boolean),
    });
console.log("brand", brand.slug, brand.id, "run", run.id);
await runPipeline(db, run.id, new AbortController().signal);
const r = (await repo.getRun(db, run.id))!;
const ev = await repo.listEvidence(db, run.id);
console.log(
  JSON.stringify(
    {
      status: r.status,
      phase: r.phase,
      minutes: Math.round((Date.now() - t0) / 600) / 100,
      evidence: ev.length,
      bySource: Object.fromEntries(
        [...new Set(ev.map((e) => e.source))].map((s) => [s, ev.filter((e) => e.source === s).length]),
      ),
      questions: (await repo.listQuestions(db, run.id)).length,
      dossier: (await repo.getBrand(db, brand.id))!.dossier.oneLiner,
    },
    null,
    2,
  ),
);
process.exit(0);
