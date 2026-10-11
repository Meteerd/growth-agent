import type { Db } from "../db/client";
import { smokeAnthropic } from "./anthropic";

type Smoke = (db: Db) => Promise<{ mode: "live" | "demo"; usd: number; file?: string; [k: string]: unknown }>;

export const SMOKES: Record<string, Smoke> = {
  anthropic: smokeAnthropic,
};

export async function runSmoke(db: Db, provider: string) {
  const fn = SMOKES[provider];
  if (!fn) throw new Error(`No smoke test for "${provider}" yet. Available: ${Object.keys(SMOKES).join(", ")}`);
  return fn(db);
}
