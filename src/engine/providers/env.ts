import { PROVIDER_IDS, PROVIDER_INFO, type ProviderId } from "@/contracts";

/** Env vars that hold each provider's credential (never read the values outside the provider modules). */
export const PROVIDER_KEY_ENV: Record<ProviderId, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  firecrawl: ["FIRECRAWL_API_KEY"],
  apify: ["APIFY_TOKEN"],
  manus: ["MANUS_API_KEY"],
  fal: ["FAL_KEY"],
  higgsfield: ["HIGGSFIELD_API_KEY"],
  youtube: ["YOUTUBE_API_KEY"],
  spiral: ["SPIRAL_API_KEY"],
  elevenlabs: ["ELEVENLABS_API_KEY"],
  gemini: ["GEMINI_API_KEY"],
  revenuecat: ["REVENUECAT_API_KEY"],
  posthog: ["POSTHOG_API_KEY", "POSTHOG_PROJECT_ID"],
  databricks: ["DATABRICKS_HOST", "DATABRICKS_TOKEN", "DATABRICKS_WAREHOUSE_ID"],
  stripe: ["STRIPE_SECRET_KEY"],
  paddle: ["PADDLE_API_KEY"],
  meta: ["META_ACCESS_TOKEN"],
  instagram: ["META_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID"],
};

export function keyPresent(p: ProviderId): boolean {
  return PROVIDER_KEY_ENV[p].every((k) => (process.env[k] ?? "").trim().length > 0);
}

export function liveList(): Set<string> {
  return new Set(
    (process.env.LIVE_PROVIDERS ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Tests never call live APIs, whatever the env says. */
export function testMode(): boolean {
  return process.env.NEXUS_TEST === "1" || process.env.VITEST === "true";
}

/** live = key present AND listed in LIVE_PROVIDERS (or forced by a smoke script), never in tests. */
export function isLive(p: ProviderId): boolean {
  if (testMode()) return false;
  const forced = (process.env.NEXUS_FORCE_LIVE ?? "").split(",").includes(p);
  return keyPresent(p) && (liveList().has(p) || forced);
}

/** Cap in USD (Manus: credits) from BUDGET_* env; undefined = no cap configured. */
export function budgetFor(p: ProviderId): number | undefined {
  const env = PROVIDER_INFO[p].budgetEnv;
  if (!env) return undefined;
  const v = Number(process.env[env]);
  return Number.isFinite(v) && v >= 0 && process.env[env] !== "" && process.env[env] !== undefined ? v : undefined;
}

export const ALL_PROVIDERS = PROVIDER_IDS;
