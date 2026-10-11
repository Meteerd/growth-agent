import type { ProviderStatus } from "@/contracts";
import { PROVIDER_IDS, PROVIDER_INFO } from "@/contracts";
import type { Db } from "../db/client";
import { spentByProvider } from "../repo";
import { budgetFor, isLive, keyPresent } from "./env";

/** Providers whose key was verified by scripts/check-keys.sh on 11 Oct (see docs/APIS.md). */
const VERIFIED = new Set(["anthropic", "openai", "apify", "manus", "firecrawl", "fal", "youtube", "spiral"]);

export async function providerStatuses(db: Db): Promise<ProviderStatus[]> {
  const spent = await spentByProvider(db);
  return PROVIDER_IDS.map((p) => {
    const live = isLive(p);
    const key = keyPresent(p);
    const info = PROVIDER_INFO[p];
    const note = live
      ? "Live: real calls within the cap"
      : key
        ? info.scarce
          ? "Key present; demo by default (scarce credits: smoke test + real-data pass only)"
          : "Key present; not in LIVE_PROVIDERS, demo data"
        : "No key: demo data (labelled)";
    const s: ProviderStatus = {
      provider: p,
      mode: live ? "live" : "demo",
      keyPresent: key,
      verified: key && VERIFIED.has(p),
      spentUsd: Math.round((spent[p] ?? 0) * 10000) / 10000,
      note,
      label: info.label,
      usedFor: info.usedFor,
    };
    const b = budgetFor(p);
    if (b !== undefined) s.budgetUsd = b;
    return s;
  });
}
