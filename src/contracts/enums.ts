import { z } from "zod";

export const PRODUCT_NAME = "nexus";

export const VERTICALS = ["telehealth_rx", "consumer_app", "health_wellness_dtc", "b2b_saas", "other"] as const;
export const Vertical = z.enum(VERTICALS);
export type Vertical = z.infer<typeof Vertical>;

export const CHANNELS = [
  "tiktok",
  "instagram_reels",
  "youtube_shorts",
  "x",
  "linkedin",
  "reddit",
  "meta_ads",
  "tiktok_ads",
  "google_ads",
  "email",
  "seo",
  "communities",
  "app_store",
] as const;
export const Channel = z.enum(CHANNELS);
export type Channel = z.infer<typeof Channel>;

export const CHANNEL_LABELS: Record<Channel, string> = {
  tiktok: "TikTok",
  instagram_reels: "Instagram Reels",
  youtube_shorts: "YouTube Shorts",
  x: "X",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  meta_ads: "Meta paid",
  tiktok_ads: "TikTok paid",
  google_ads: "Google Search paid",
  email: "Email / newsletter",
  seo: "SEO / content",
  communities: "Communities & partnerships",
  app_store: "App store optimization",
};

export const PHASES = [
  "intake",
  "research",
  "reverse_engineer",
  "consult",
  "direction",
  "production",
  "review",
  "compliance",
  "pack",
  "measure",
] as const;
export const Phase = z.enum(PHASES);
export type Phase = z.infer<typeof Phase>;

export const PROVIDER_IDS = [
  "anthropic",
  "openai",
  "firecrawl",
  "apify",
  "manus",
  "fal",
  "higgsfield",
  "youtube",
  "spiral",
  "elevenlabs",
  "gemini",
  "revenuecat",
  "posthog",
  "databricks",
  "stripe",
  "paddle",
  "meta",
  "instagram",
] as const;
export const ProviderId = z.enum(PROVIDER_IDS);
export type ProviderId = z.infer<typeof ProviderId>;

export const CONNECTION_STATUSES = ["live", "demo", "missing", "error"] as const;
export const ConnectionStatus = z.enum(CONNECTION_STATUSES);
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;

export const RUN_KINDS = ["full", "research_only", "production_only"] as const;
export const RunKind = z.enum(RUN_KINDS);
export type RunKind = z.infer<typeof RunKind>;

export const RUN_STATUSES = ["queued", "running", "waiting_input", "done", "failed", "cancelled"] as const;
export const RunStatus = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatus>;

export const RUN_EVENT_TYPES = [
  "phase_started",
  "phase_completed",
  "thinking",
  "tool_call",
  "tool_result",
  "evidence",
  "blueprint",
  "review",
  "question",
  "plan",
  "concept",
  "asset",
  "compliance",
  "pack",
  "cost",
  "warning",
  "error",
  "log",
  // additive (A02): run status changes (queued/running/waiting_input/done/failed/cancelled)
  "status",
  // additive (A19): a render version / revision progress (data: { conceptId, renderId, status, plan? })
  "revision",
] as const;
export const RunEventType = z.enum(RUN_EVENT_TYPES);
export type RunEventType = z.infer<typeof RunEventType>;

export const EVIDENCE_SOURCES = [
  "website",
  "meta_ad_library",
  "tiktok",
  "instagram",
  "youtube",
  "reddit",
  "google_maps",
  "app_store",
  "play_store",
  "trustpilot",
  "spiral",
  "manus_research",
  "revenuecat",
  "posthog",
  "databricks",
  "stripe",
  "paddle",
  "meta_ads",
] as const;
export const EvidenceSource = z.enum(EVIDENCE_SOURCES);
export type EvidenceSource = z.infer<typeof EvidenceSource>;

export const EVIDENCE_KINDS = ["ad", "post", "video", "thread", "review", "page", "metric", "research"] as const;
export const EvidenceKind = z.enum(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

/** Longevity tiers for ads: proven = 30+ days running, testing = 7 to 29, new = under 7. */
export const LONGEVITY_TIERS = ["proven", "testing", "new"] as const;
export const LongevityTier = z.enum(LONGEVITY_TIERS);
export type LongevityTier = z.infer<typeof LongevityTier>;

export const QUESTION_KINDS = ["single", "multi", "text", "scale", "confirm"] as const;
export const QuestionKind = z.enum(QUESTION_KINDS);
export type QuestionKind = z.infer<typeof QuestionKind>;

export const CHANNEL_MODES = ["organic", "paid", "both"] as const;
export const ChannelMode = z.enum(CHANNEL_MODES);
export type ChannelMode = z.infer<typeof ChannelMode>;

export const CONCEPT_FORMATS = [
  "ugc_talking_head",
  "faceless_broll",
  "product_demo",
  "founder_story",
  "listicle",
  "myth_vs_fact",
  "static",
  "carousel",
  "text_post",
] as const;
export const ConceptFormat = z.enum(CONCEPT_FORMATS);
export type ConceptFormat = z.infer<typeof ConceptFormat>;

export const COMPLIANCE_STATUSES = ["pending", "pass", "warn", "fail"] as const;
export const ComplianceStatus = z.enum(COMPLIANCE_STATUSES);
export type ComplianceStatus = z.infer<typeof ComplianceStatus>;

export const CONCEPT_STATUSES = ["draft", "keyframes", "approved", "rendering", "rendered", "failed"] as const;
export const ConceptStatus = z.enum(CONCEPT_STATUSES);
export type ConceptStatus = z.infer<typeof ConceptStatus>;

export const ASSET_KINDS = ["keyframe", "clip", "voice", "music", "video", "image", "cover"] as const;
export const AssetKind = z.enum(ASSET_KINDS);
export type AssetKind = z.infer<typeof AssetKind>;

export const COMPLIANCE_TARGETS = ["concept", "caption", "shot", "pack"] as const;
export const ComplianceTarget = z.enum(COMPLIANCE_TARGETS);
export type ComplianceTarget = z.infer<typeof ComplianceTarget>;

export const FINDING_SEVERITIES = ["info", "warn", "block"] as const;
export const FindingSeverity = z.enum(FINDING_SEVERITIES);
export type FindingSeverity = z.infer<typeof FindingSeverity>;

export const PACK_STATUSES = ["ready", "posted"] as const;
export const PackStatus = z.enum(PACK_STATUSES);
export type PackStatus = z.infer<typeof PackStatus>;

export const CONFIDENCES = ["low", "medium", "high"] as const;
export const Confidence = z.enum(CONFIDENCES);
export type Confidence = z.infer<typeof Confidence>;

export const RENDER_TIERS = ["draft", "final"] as const;
export const RenderTier = z.enum(RENDER_TIERS);
export type RenderTier = z.infer<typeof RenderTier>;

/** Where a run's data came from: deterministic demo fixtures, a recorded live pass, or live calls right now. */
export const DATASETS = ["demo", "live_recorded", "live"] as const;
export const Dataset = z.enum(DATASETS);
export type Dataset = z.infer<typeof Dataset>;

export const SCORE_AXES = [
  "audience",
  "provenWins",
  "productionFit",
  "complianceRisk",
  "speedToSignal",
  "modelFit",
] as const;
export type ScoreAxis = (typeof SCORE_AXES)[number];

export const SCORE_AXIS_LABELS: Record<ScoreAxis, string> = {
  audience: "Audience presence",
  provenWins: "Proven competitor wins",
  productionFit: "Production fit",
  complianceRisk: "Compliance safety (higher = safer)",
  speedToSignal: "Cost and speed to first signal",
  modelFit: "Business-model fit",
};

export const ASPECTS = ["9:16", "4:5", "1:1", "16:9"] as const;
export const Aspect = z.enum(ASPECTS);
export type Aspect = z.infer<typeof Aspect>;

export const BLUEPRINT_STRUCTURES = [
  "problem_agitate_solve",
  "story",
  "listicle",
  "myth_vs_fact",
  "demo",
  "founder_story",
  "testimonial_style",
  "other",
] as const;
export const BlueprintStructure = z.enum(BLUEPRINT_STRUCTURES);
export type BlueprintStructure = z.infer<typeof BlueprintStructure>;

export const SHOT_TYPES = [
  "talking_head",
  "ugc_selfie",
  "broll",
  "product_closeup",
  "screen_recording",
  "text_card",
  "other",
] as const;
export const ShotType = z.enum(SHOT_TYPES);
export type ShotType = z.infer<typeof ShotType>;

export const SHOT_PURPOSES = ["hook", "problem", "agitate", "solution", "demo", "proof", "offer", "cta"] as const;
export const ShotPurpose = z.enum(SHOT_PURPOSES);
export type ShotPurpose = z.infer<typeof ShotPurpose>;

export const REVIEW_DECISIONS = ["accept", "regenerate"] as const;
export const ReviewDecision = z.enum(REVIEW_DECISIONS);
export type ReviewDecision = z.infer<typeof ReviewDecision>;
