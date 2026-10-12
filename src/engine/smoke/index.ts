import type { Db } from "../db/client";
import { smokeAnthropic } from "./anthropic";
import { smokeBlueprint } from "./blueprint";
import { smokeDatabricks, smokePosthog, smokeRevenuecat } from "./business";
import { smokeFal } from "./fal";
import { smokeHiggsfield } from "./higgsfield";
import { smokeFirecrawl, smokeIntake } from "./intake";
import { smokeOpenai } from "./openai";
import { smokeSora } from "./sora";
import { smokeYoutube } from "./sources";

type Smoke = (db: Db) => Promise<{ mode: "live" | "demo"; usd: number; file?: string; [k: string]: unknown }>;

export const SMOKES: Record<string, Smoke> = {
  anthropic: smokeAnthropic,
  blueprint: smokeBlueprint,
  firecrawl: smokeFirecrawl,
  youtube: smokeYoutube,
  openai: smokeOpenai,
  sora: smokeSora,
  fal: smokeFal,
  higgsfield: smokeHiggsfield,
  revenuecat: smokeRevenuecat,
  posthog: smokePosthog,
  databricks: smokeDatabricks,
  intake: (db) => smokeIntake(db, process.env.SMOKE_BRAND || "hound"),
};

export async function runSmoke(db: Db, provider: string) {
  const fn = SMOKES[provider];
  if (!fn) throw new Error(`No smoke test for "${provider}" yet. Available: ${Object.keys(SMOKES).join(", ")}`);
  return fn(db);
}
