import { z } from "zod";
import {
  Aspect,
  AssetKind,
  BlueprintStructure,
  Channel,
  ChannelMode,
  ComplianceStatus,
  ComplianceTarget,
  ConceptFormat,
  ConceptStatus,
  Confidence,
  ConnectionStatus,
  Dataset,
  EvidenceKind,
  EvidenceSource,
  FindingSeverity,
  PackStatus,
  Phase,
  ProviderId,
  QuestionKind,
  ReviewDecision,
  RunEventType,
  RunKind,
  RunStatus,
  ShotPurpose,
  ShotType,
  Vertical,
} from "./enums";

const Id = z.string().min(1);
const Iso = z.string().min(1); // ISO 8601 timestamp

// ---------------------------------------------------------------- Brand

export const Offer = z.object({ name: z.string(), price: z.string().optional(), notes: z.string().optional() });
export type Offer = z.infer<typeof Offer>;

export const Persona = z.object({
  name: z.string(),
  pains: z.array(z.string()),
  desires: z.array(z.string()),
  objections: z.array(z.string()),
  whereTheyAre: z.array(z.string()),
});
export type Persona = z.infer<typeof Persona>;

/** Where a dossier field came from. Operator edits are never overwritten by crawled guesses. */
export const FieldProvenance = z.object({
  field: z.string(),
  source: z.enum(["seed", "crawl", "operator", "answer", "agent"]),
  ref: z.string().optional(),
  at: Iso,
});
export type FieldProvenance = z.infer<typeof FieldProvenance>;

export const BrandDossier = z.object({
  oneLiner: z.string(),
  positioning: z.string(),
  offers: z.array(Offer),
  personas: z.array(Persona),
  voice: z.object({ tone: z.string(), do: z.array(z.string()), dont: z.array(z.string()) }),
  proof: z.array(z.string()),
  claimsAllowed: z.array(z.string()),
  claimsForbidden: z.array(z.string()),
  visual: z.object({
    colors: z.array(z.string()),
    logoUrl: z.string().optional(),
    fonts: z.array(z.string()).optional(),
    /** additive: brand-owned reference images (served under /api/assets/brands/...) */
    referenceImages: z.array(z.string()).optional(),
    /** additive: one-line style block reused in every image prompt */
    styleNotes: z.string().optional(),
  }),
  competitors: z.array(z.object({ name: z.string(), url: z.string() })),
  gaps: z.array(z.string()),
  sources: z.array(z.object({ url: z.string(), fetchedAt: Iso })),
  /** additive: per-field provenance (operator edits are locked) */
  provenance: z.array(FieldProvenance).optional(),
  /** additive: answers from the consultation, cited later as "because you said ..." */
  operatorNotes: z
    .array(z.object({ questionId: z.string(), prompt: z.string(), answer: z.string(), at: Iso }))
    .optional(),
});
export type BrandDossier = z.infer<typeof BrandDossier>;

export const Brand = z.object({
  id: Id,
  slug: z.string().min(1),
  name: z.string().min(1),
  url: z.string(),
  vertical: Vertical,
  countries: z.array(z.string()),
  languages: z.array(z.string()),
  rulePack: z.string(),
  dossier: BrandDossier,
  demo: z.boolean(),
  createdAt: Iso,
  updatedAt: Iso,
});
export type Brand = z.infer<typeof Brand>;

export const BrandCounts = z.object({
  runs: z.number().int().nonnegative(),
  packsReady: z.number().int().nonnegative(),
  packsPosted: z.number().int().nonnegative(),
  totalViews: z.number().nonnegative(),
});
export type BrandCounts = z.infer<typeof BrandCounts>;

/** GET /api/brands item: Brand + counts + last run summary. */
export const BrandSummary = Brand.extend({
  counts: BrandCounts,
  /** additive (A17): the brand's flagship final video (real motion), shown as hero media */
  heroVideo: z
    .object({
      url: z.string(),
      posterUrl: z.string().optional(),
      conceptId: z.string(),
      runId: z.string(),
      title: z.string().optional(),
      /** additive (A18): dubbed versions of the hero video */
      dubs: z.array(z.object({ language: z.string(), url: z.string(), posterUrl: z.string().optional() })).optional(),
    })
    .optional(),
  /** additive (A18): the brand's cast ElevenLabs voice, with a short local sample */
  voice: z
    .object({
      name: z.string(),
      voiceId: z.string(),
      language: z.string(),
      persona: z.string().optional(),
      sampleUrl: z.string().optional(),
    })
    .optional(),
  lastRun: z
    .object({ id: Id, status: RunStatus, phase: Phase, startedAt: Iso.optional(), finishedAt: Iso.optional() })
    .optional(),
});
export type BrandSummary = z.infer<typeof BrandSummary>;

// ---------------------------------------------------------------- Connection

export const Connection = z.object({
  id: Id,
  brandId: Id,
  provider: ProviderId,
  status: ConnectionStatus,
  config: z.record(z.string(), z.string()),
  lastSyncAt: Iso.optional(),
  summary: z.string().optional(),
  error: z.string().optional(),
});
export type Connection = z.infer<typeof Connection>;

// ---------------------------------------------------------------- Run + events

export const Run = z.object({
  id: Id,
  brandId: Id,
  kind: RunKind,
  status: RunStatus,
  phase: Phase,
  costUsd: z.number().nonnegative(),
  startedAt: Iso.optional(),
  finishedAt: Iso.optional(),
  error: z.string().optional(),
  demo: z.boolean(),
  /** additive: demo fixtures, a recorded live pass, or live calls */
  dataset: Dataset.optional(),
  /** additive: when the recorded live data was captured */
  capturedAt: Iso.optional(),
  /** additive: Manus deep-research task link for this run (if any) */
  manusTaskUrl: z.string().optional(),
  createdAt: Iso,
});
export type Run = z.infer<typeof Run>;

export const RunEvent = z.object({
  id: z.number().int().positive(),
  runId: Id,
  ts: Iso,
  phase: Phase,
  type: RunEventType,
  title: z.string(),
  detail: z.string().optional(),
  refId: z.string().optional(),
  costUsd: z.number().optional(),
  data: z.unknown().optional(),
});
export type RunEvent = z.infer<typeof RunEvent>;

// ---------------------------------------------------------------- Evidence

export const EvidenceMetrics = z.object({
  views: z.number().optional(),
  likes: z.number().optional(),
  comments: z.number().optional(),
  shares: z.number().optional(),
  followers: z.number().optional(),
  daysRunning: z.number().optional(),
  outlierScore: z.number().optional(),
  rating: z.number().optional(),
});
export type EvidenceMetrics = z.infer<typeof EvidenceMetrics>;

export const Deconstruction = z.object({
  hook: z.string().optional(),
  format: z.string().optional(),
  angle: z.string().optional(),
  beats: z.array(z.object({ t: z.number(), what: z.string() })).optional(),
  emotion: z.string().optional(),
  cta: z.string().optional(),
  lengthSec: z.number().optional(),
  language: z.string().optional(),
});
export type Deconstruction = z.infer<typeof Deconstruction>;

export const Evidence = z.object({
  id: Id,
  brandId: Id,
  runId: Id,
  source: EvidenceSource,
  kind: EvidenceKind,
  url: z.string().optional(),
  title: z.string(),
  author: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  mediaUrl: z.string().optional(),
  text: z.string().optional(),
  metrics: EvidenceMetrics,
  deconstruction: Deconstruction.optional(),
  tags: z.array(z.string()),
  capturedAt: Iso,
  demo: z.boolean(),
});
export type Evidence = z.infer<typeof Evidence>;

// ---------------------------------------------------------------- Consult

export const QuestionOption = z.object({ id: z.string(), label: z.string(), hint: z.string().optional() });
export type QuestionOption = z.infer<typeof QuestionOption>;

export const Question = z.object({
  id: Id,
  runId: Id,
  order: z.number().int(),
  kind: QuestionKind,
  prompt: z.string(),
  why: z.string(),
  evidenceIds: z.array(z.string()),
  options: z.array(QuestionOption).optional(),
  defaultAnswer: z.unknown().optional(),
  required: z.boolean(),
  answer: z.unknown().optional(),
  answeredAt: Iso.optional(),
  skipped: z.boolean().optional(),
  assumption: z.string().optional(),
  /** additive: which dossier field the answer fills (e.g. "voice.dont") */
  fills: z.string().optional(),
  /** additive: for scale questions */
  scale: z.object({ min: z.number(), max: z.number(), minLabel: z.string(), maxLabel: z.string() }).optional(),
});
export type Question = z.infer<typeof Question>;

// ---------------------------------------------------------------- Direction

export const ChannelScores = z.object({
  audience: z.number().min(0).max(100),
  provenWins: z.number().min(0).max(100),
  productionFit: z.number().min(0).max(100),
  complianceRisk: z.number().min(0).max(100),
  speedToSignal: z.number().min(0).max(100),
  modelFit: z.number().min(0).max(100),
});
export type ChannelScores = z.infer<typeof ChannelScores>;

export const ChannelWeights = z.object({
  audience: z.number().min(0).max(1),
  provenWins: z.number().min(0).max(1),
  productionFit: z.number().min(0).max(1),
  complianceRisk: z.number().min(0).max(1),
  speedToSignal: z.number().min(0).max(1),
  modelFit: z.number().min(0).max(1),
});
export type ChannelWeights = z.infer<typeof ChannelWeights>;

export const ChannelRec = z.object({
  channel: Channel,
  priority: z.number().int().positive(),
  score: z.number().min(0).max(100),
  scores: ChannelScores,
  mode: ChannelMode,
  rationale: z.string(),
  evidenceIds: z.array(z.string()),
  formats: z.array(z.string()),
  cadence: z.string(),
  firstSteps: z.array(z.string()),
  kpis: z.array(z.string()),
  targets: z.array(z.string()),
  /** additive: operator answers this recommendation relies on */
  answerIds: z.array(z.string()).optional(),
});
export type ChannelRec = z.infer<typeof ChannelRec>;

export const NotNow = z.object({ channel: Channel, reason: z.string(), evidenceIds: z.array(z.string()) });
export type NotNow = z.infer<typeof NotNow>;

export const ChannelPlan = z.object({
  id: Id,
  runId: Id,
  brandId: Id,
  version: z.number().int().positive(),
  summary: z.string(),
  weights: ChannelWeights,
  channels: z.array(ChannelRec),
  notNow: z.array(NotNow),
  createdAt: Iso,
  /** additive: every channel considered with its scores, including those not recommended */
  considered: z.array(z.object({ channel: Channel, score: z.number(), scores: ChannelScores })).optional(),
});
export type ChannelPlan = z.infer<typeof ChannelPlan>;

// ---------------------------------------------------------------- Reverse engineering

export const BlueprintShot = z.object({
  idx: z.number().int().nonnegative(),
  t0: z.number().nonnegative(),
  t1: z.number().nonnegative(),
  shotType: ShotType,
  camera: z.string(),
  subject: z.string(),
  action: z.string(),
  onScreenText: z.string().optional(),
  voiceover: z.string().optional(),
  audioCue: z.string().optional(),
  transition: z.string().optional(),
  purpose: ShotPurpose,
});
export type BlueprintShot = z.infer<typeof BlueprintShot>;

/** additive (A18): how the winner's on-screen text looks and moves, read from the video (Gemini) and frames */
export const CAPTION_FONTS = [
  "tiktok_sans",
  "montserrat",
  "poppins",
  "inter",
  "anton",
  "bebas",
  "serif_dm",
  "serif_playfair",
  "handwritten",
] as const;
export const CaptionStyle = z.object({
  font: z.enum(CAPTION_FONTS),
  weight: z.enum(["bold", "black"]).optional(),
  case: z.enum(["as_is", "upper", "lower"]),
  /** font size as a percent of the frame width (TikTok auto captions ~6.5, Hormozi ~9) */
  sizePct: z.number().min(3).max(16),
  fill: z.string(),
  /** the spoken word's highlight colour */
  accent: z.string(),
  stroke: z.object({ color: z.string(), widthPct: z.number().min(0).max(30) }).optional(),
  shadow: z.boolean().optional(),
  background: z.enum(["none", "box", "word_box"]),
  backgroundColor: z.string().optional(),
  position: z.enum(["upper", "middle", "lower"]),
  animation: z.enum(["pop", "bounce", "slide", "typewriter", "fade"]),
  /** words on screen at once (1 to 3 for live captions) */
  wordsPerCaption: z.number().int().min(1).max(4),
  /** the winner's hook title (large text over the first shot), when it has one */
  hookTitle: z
    .object({
      font: z.enum(CAPTION_FONTS),
      case: z.enum(["as_is", "upper", "lower"]),
      sizePct: z.number().min(3).max(16),
      fill: z.string(),
      background: z.enum(["none", "box", "word_box"]),
      backgroundColor: z.string().optional(),
      position: z.enum(["upper", "middle", "lower"]),
    })
    .optional(),
  notes: z.string().optional(),
});
export type CaptionStyle = z.infer<typeof CaptionStyle>;

export const Blueprint = z.object({
  id: Id,
  evidenceId: Id,
  brandId: Id,
  runId: Id,
  sourceUrl: z.string().optional(),
  durationSec: z.number().positive(),
  aspect: Aspect,
  structure: BlueprintStructure,
  hook: z.object({
    endSec: z.number().nonnegative(),
    visual: z.string(),
    spoken: z.string().optional(),
    onScreenText: z.string().optional(),
    mechanism: z.string(),
    whyItStops: z.string(),
  }),
  shots: z.array(BlueprintShot),
  pacing: z.object({ cutsPer10s: z.number().nonnegative(), avgShotSec: z.number().nonnegative() }),
  emotionalArc: z.string(),
  cta: z.object({ atSec: z.number().nonnegative(), mechanic: z.string(), text: z.string().optional() }),
  whyItWins: z.string(),
  transcript: z.string().optional(),
  /** local files under ASSETS_DIR; may be missing on other machines */
  frames: z.array(z.object({ t: z.number(), url: z.string() })),
  demo: z.boolean(),
  createdAt: Iso,
  /** additive (A18): the winner's caption look and motion */
  captionStyle: CaptionStyle.optional(),
  /** additive (A18): the winner's sound (music genre/tempo/mood, sound effects, voice delivery), from Gemini */
  audio: z
    .object({
      music: z.string(),
      sfx: z.array(z.string()),
      voice: z.string(),
    })
    .optional(),
  /** additive (A18): Gemini's plain-language read of the whole video with sound */
  watchNotes: z.string().optional(),
  /** additive (A18): the winner's own raw Gemini score on our render rubric (calibration anchor) */
  winnerScore: z.object({ overall: z.number(), model: z.string().optional(), at: z.string() }).optional(),
});
export type Blueprint = z.infer<typeof Blueprint>;

export const Review = z.object({
  id: Id,
  conceptId: Id,
  assetId: Id,
  round: z.number().int().positive(),
  overall: z.number().min(0).max(100),
  blueprintMatch: z.number().min(0).max(100),
  perShot: z.array(
    z.object({ idx: z.number().int().nonnegative(), score: z.number().min(0).max(100), issues: z.array(z.string()) }),
  ),
  complianceOk: z.boolean(),
  decision: ReviewDecision,
  notes: z.string(),
  createdAt: Iso,
  /** additive: shots regenerated as a result of this review */
  regeneratedShots: z.array(z.number().int().nonnegative()).optional(),
  /** additive: demo fixture flag */
  demo: z.boolean().optional(),
});
export type Review = z.infer<typeof Review>;

// ---------------------------------------------------------------- Production

export const Shot = z.object({
  idx: z.number().int().nonnegative(),
  durationSec: z.number().positive(),
  visualPrompt: z.string(),
  onScreenText: z.string().optional(),
  voiceover: z.string().optional(),
  keyframeAssetId: z.string().optional(),
  clipAssetId: z.string().optional(),
  approved: z.boolean(),
  /** additive (A17): where the frame comes from: a real brand image, or a newly generated frame */
  source: z.enum(["brand_image", "generated"]).optional(),
  /** additive (A17): the brand image used (path under assets/brands, served at /api/assets/brands/...) */
  imageRef: z.string().optional(),
  /** additive (A17): look matched to the winner: photoreal phone footage, illustration, or a screen */
  style: z.enum(["photoreal", "illustration", "screen"]).optional(),
  /** additive (A17): the camera move and action for image-to-video, following the blueprint shot */
  motion: z.string().optional(),
  /** additive (A18): where the native caption sits so it never covers the subject (default upper third) */
  captionRegion: z.enum(["upper", "middle", "lower"]).optional(),
  /** additive (A18): reframe the shot's clip (zoom >= 1, anchor 0..1 = which part of the frame stays) */
  framing: z
    .object({ zoom: z.number().min(1).max(2), anchorX: z.number().min(0).max(1), anchorY: z.number().min(0).max(1) })
    .optional(),
  /** additive (A18): operator-pinned caption region (the automatic chooser keeps it) */
  captionRegionLocked: z.boolean().optional(),
});
export type Shot = z.infer<typeof Shot>;

export const Concept = z.object({
  id: Id,
  runId: Id,
  brandId: Id,
  channel: Channel,
  format: ConceptFormat,
  title: z.string(),
  hook: z.string(),
  angle: z.string(),
  language: z.string(),
  shots: z.array(Shot),
  caption: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
  remakesEvidenceIds: z.array(z.string()),
  blueprintId: z.string().optional(),
  shotMap: z
    .array(z.object({ shotIdx: z.number().int().nonnegative(), blueprintShotIdx: z.number().int().nonnegative() }))
    .optional(),
  /** concept id this is a format variant of */
  variantOf: z.string().optional(),
  aspect: Aspect.default("9:16"),
  compliance: ComplianceStatus,
  estimatedCostUsd: z.number().nonnegative(),
  status: ConceptStatus,
  createdAt: Iso,
  /** additive: one-paragraph explanation of what structure is remade and what is original */
  remakeNote: z.string().optional(),
  /** additive: final video asset once rendered */
  videoAssetId: z.string().optional(),
  /** additive: for text posts / carousels: the body text */
  body: z.string().optional(),
  /** additive: compliance revision count (auto-revise max 2) */
  revisions: z.number().int().nonnegative().optional(),
  /** additive (A18): the soundtrack of the latest final render */
  audio: z
    .object({
      music: z.object({ label: z.string(), prompt: z.string().optional(), url: z.string().optional() }).optional(),
      sfx: z.array(z.object({ t: z.number(), label: z.string() })).optional(),
      voice: z.object({ name: z.string(), voiceId: z.string() }).optional(),
    })
    .optional(),
});
export type Concept = z.infer<typeof Concept>;

export const Asset = z.object({
  id: Id,
  brandId: Id,
  conceptId: z.string().optional(),
  kind: AssetKind,
  url: z.string(),
  provider: z.union([ProviderId, z.literal("local")]),
  model: z.string().optional(),
  costUsd: z.number().nonnegative(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSec: z.number().optional(),
  demo: z.boolean(),
  createdAt: Iso,
  /** additive: which shot this asset belongs to */
  shotIdx: z.number().int().optional(),
});
export type Asset = z.infer<typeof Asset>;

// ---------------------------------------------------------------- Compliance

export const ComplianceFinding = z.object({
  ruleId: z.string(),
  severity: FindingSeverity,
  message: z.string(),
  excerpt: z.string().optional(),
});
export type ComplianceFinding = z.infer<typeof ComplianceFinding>;

export const ComplianceCheck = z.object({
  id: Id,
  targetType: ComplianceTarget,
  targetId: Id,
  rulePack: z.string(),
  status: z.enum(["pass", "warn", "fail"]),
  findings: z.array(ComplianceFinding),
  createdAt: Iso,
  /** additive: 0 = first check, 1..2 = after auto-revision */
  attempt: z.number().int().nonnegative().optional(),
});
export type ComplianceCheck = z.infer<typeof ComplianceCheck>;

// ---------------------------------------------------------------- Packs, metrics, learning, spend

export const PublishPack = z.object({
  id: Id,
  conceptId: Id,
  brandId: Id,
  platform: Channel,
  videoAssetId: z.string().optional(),
  imageAssetIds: z.array(z.string()),
  caption: z.string(),
  hashtags: z.array(z.string()),
  firstComment: z.string().optional(),
  postAt: Iso.optional(),
  checklist: z.array(z.string()),
  status: PackStatus,
  postedUrl: z.string().optional(),
  postedAt: Iso.optional(),
  createdAt: Iso,
  /** additive: run that produced it */
  runId: z.string().optional(),
  /** additive: Manus-built landing page for this pack (stretch) */
  landingUrl: z.string().optional(),
});
export type PublishPack = z.infer<typeof PublishPack>;

export const MetricSnapshot = z.object({
  id: Id,
  packId: Id,
  capturedAt: Iso,
  views: z.number().optional(),
  likes: z.number().optional(),
  comments: z.number().optional(),
  shares: z.number().optional(),
  saves: z.number().optional(),
  follows: z.number().optional(),
  source: z.enum(["manual", "api"]),
});
export type MetricSnapshot = z.infer<typeof MetricSnapshot>;

export const Learning = z.object({
  id: Id,
  brandId: z.string().nullable().optional(),
  insight: z.string(),
  evidence: z.string(),
  confidence: Confidence,
  createdAt: Iso,
});
export type Learning = z.infer<typeof Learning>;

export const SpendEntry = z.object({
  id: Id,
  provider: ProviderId,
  runId: z.string().optional(),
  usd: z.number().nonnegative(),
  units: z.string().optional(),
  note: z.string(),
  ts: Iso,
});
export type SpendEntry = z.infer<typeof SpendEntry>;

export const ProviderStatus = z.object({
  provider: ProviderId,
  mode: z.enum(["live", "demo"]),
  keyPresent: z.boolean(),
  verified: z.boolean(),
  budgetUsd: z.number().optional(),
  spentUsd: z.number().nonnegative(),
  note: z.string().optional(),
  /** additive: human label + what we use it for */
  label: z.string().optional(),
  usedFor: z.string().optional(),
});
export type ProviderStatus = z.infer<typeof ProviderStatus>;
