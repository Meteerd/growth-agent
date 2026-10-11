import type { Db } from "../db/client";
import { smokeAnthropic } from "./anthropic";
import { smokeFirecrawl, smokeIntake } from "./intake";

type Smoke = (db: Db) => Promise<{ mode: "live" | "demo"; usd: number; file?: string; [k: string]: unknown }>;

export const SMOKES: Record<string, Smoke> = {
  anthropic: smokeAnthropic,
  firecrawl: smokeFirecrawl,
  intake: (db) => smokeIntake(db, process.env.SMOKE_BRAND || "hound"),
};

export async function runSmoke(db: Db, provider: string) {
  const fn = SMOKES[provider];
  if (!fn) throw new Error(`No smoke test for "${provider}" yet. Available: ${Object.keys(SMOKES).join(", ")}`);
  return fn(db);
}
