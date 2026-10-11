import type { EvidenceSource, Phase } from "@/contracts";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en");

/** 3214 -> "3,214"; 1_250_000 -> "1.3M" (compact above 99,999 unless forced). */
export function formatCount(n: number, mode: "auto" | "full" | "compact" = "auto") {
  if (!Number.isFinite(n)) return "0";
  if (mode === "full" || (mode === "auto" && Math.abs(n) < 100_000)) return full.format(Math.round(n));
  return compact.format(n);
}

/** USD with enough precision for sub-cent provider calls. */
export function formatUsd(n: number) {
  const abs = Math.abs(n);
  const digits = abs === 0 ? 2 : abs < 0.1 ? 4 : abs < 10 ? 3 : 2;
  return `$${n.toFixed(digits)}`;
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

/** mm:ss.mmm clock for run timelines. */
export function clock(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(Math.floor(ms % 1000)).padStart(3, "0")}`;
}

export const PHASE_LABELS: Record<Phase, string> = {
  intake: "Intake",
  research: "Research",
  reverse_engineer: "Reverse-engineer",
  consult: "Consult",
  direction: "Direction",
  production: "Production",
  review: "Self-review",
  compliance: "Compliance",
  pack: "Pack",
  measure: "Measure",
};

export const SOURCE_LABELS: Record<EvidenceSource, string> = {
  website: "Website",
  meta_ad_library: "Meta Ad Library",
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  reddit: "Reddit",
  google_maps: "Google Maps",
  app_store: "App Store",
  play_store: "Play Store",
  trustpilot: "Trustpilot",
  spiral: "Spiral",
  manus_research: "Manus research",
  revenuecat: "RevenueCat",
  posthog: "PostHog",
  stripe: "Stripe",
  paddle: "Paddle",
  meta_ads: "Meta Ads",
};

/** Longevity is the honest proxy for "works": 30+ days proven, 7 to 29 testing. */
export function longevity(daysRunning?: number) {
  if (daysRunning == null) return undefined;
  return daysRunning >= 30 ? "proven" : daysRunning >= 7 ? "testing" : "new";
}
