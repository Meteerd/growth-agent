/**
 * pnpm smoke <provider> [--live]
 * One minimal real call per provider, within its cap, recorded to src/contracts/fixtures/live/<provider>/.
 * --live forces a live call for a provider that is not in LIVE_PROVIDERS (still within the cap).
 */
import { loadEnv } from "./env";

loadEnv();
const [provider, ...flags] = process.argv.slice(2);
if (!provider) {
  console.error("usage: pnpm smoke <provider> [--live]");
  process.exit(1);
}
if (flags.includes("--live")) process.env.NEXUS_FORCE_LIVE = provider;

const { createDb } = await import("@/engine/db/client");
const { runSmoke } = await import("@/engine/smoke");
const db = await createDb();
const t0 = Date.now();
try {
  const out = await runSmoke(db, provider);
  console.log(JSON.stringify({ provider, ms: Date.now() - t0, ...out }, null, 2));
  if (out.mode !== "live") {
    console.error(`${provider}: ran in DEMO mode (key missing, not in LIVE_PROVIDERS, or cap reached). Use --live to force one call.`);
    process.exit(2);
  }
} catch (e) {
  console.error(`${provider} smoke failed:`, e instanceof Error ? e.message : e);
  process.exit(1);
}
