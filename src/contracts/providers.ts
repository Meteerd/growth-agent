import type { ProviderId } from "./enums";

export interface ProviderInfo {
  label: string;
  usedFor: string;
  /** engine = one of the three AI engines; tool = called by the engines; connector = brand business data */
  role: "engine" | "tool" | "connector";
  /** scarce = demo by default, one recorded smoke test + the A14 real-data pass only */
  scarce: boolean;
  /** env var holding the budget cap, if any */
  budgetEnv?: string;
}

export const PROVIDER_INFO: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    label: "Claude (Anthropic)",
    usedFor: "The engine: every decision",
    role: "engine",
    scarce: false,
    budgetEnv: "BUDGET_USD_ANTHROPIC",
  },
  openai: {
    label: "OpenAI",
    usedFor: "Keyframes, voiceover, transcription",
    role: "engine",
    scarce: false,
    budgetEnv: "BUDGET_USD_OPENAI",
  },
  manus: {
    label: "Manus",
    usedFor: "Deep research tasks, landing pages",
    role: "engine",
    scarce: true,
    budgetEnv: "BUDGET_MANUS_CREDITS",
  },
  firecrawl: {
    label: "Firecrawl",
    usedFor: "Brand and competitor sites",
    role: "tool",
    scarce: false,
    budgetEnv: "BUDGET_USD_FIRECRAWL",
  },
  apify: {
    label: "Apify",
    usedFor: "Ads library, TikTok, Instagram, Reddit, reviews",
    role: "tool",
    scarce: true,
    budgetEnv: "BUDGET_USD_APIFY",
  },
  spiral: { label: "Spiral", usedFor: "Meta and TikTok ad intelligence", role: "tool", scarce: true },
  youtube: { label: "YouTube Data API", usedFor: "Shorts search", role: "tool", scarce: false },
  fal: { label: "fal", usedFor: "Image-to-video", role: "tool", scarce: true, budgetEnv: "BUDGET_USD_FAL" },
  higgsfield: {
    label: "Higgsfield",
    usedFor: "Alternative video",
    role: "tool",
    scarce: true,
    budgetEnv: "BUDGET_USD_HIGGSFIELD",
  },
  revenuecat: { label: "RevenueCat", usedFor: "Subscriptions and revenue", role: "connector", scarce: false },
  posthog: { label: "PostHog", usedFor: "Funnels and referrers", role: "connector", scarce: false },
  stripe: { label: "Stripe", usedFor: "Paying customers", role: "connector", scarce: false },
  paddle: { label: "Paddle", usedFor: "Paying customers", role: "connector", scarce: false },
  meta: { label: "Meta Ads", usedFor: "Spend and CPA by creative (read-only)", role: "connector", scarce: false },
  instagram: { label: "Instagram", usedFor: "Post insights (read-only)", role: "connector", scarce: false },
};
