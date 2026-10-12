import { z } from "zod";
import {
  Asset,
  Blueprint,
  Brand,
  BrandDossier,
  BrandSummary,
  ChannelPlan,
  Concept,
  Connection,
  Evidence,
  Learning,
  MetricSnapshot,
  ProviderStatus,
  PublishPack,
  Question,
  Review,
  Run,
  RunEvent,
  SpendEntry,
} from "./entities";
import { Channel, ProviderId, RenderTier, RunKind, Vertical } from "./enums";

/**
 * Route constants. Every path is same-origin under /api.
 * `:id` params accept the entity id; brand routes also accept the brand slug.
 */
export const API = {
  health: () => "/api/health",
  brands: () => "/api/brands",
  brand: (idOrSlug: string) => `/api/brands/${encodeURIComponent(idOrSlug)}`,
  brandDossier: (id: string) => `/api/brands/${encodeURIComponent(id)}/dossier`,
  brandConnections: (id: string) => `/api/brands/${encodeURIComponent(id)}/connections`,
  brandRuns: (id: string) => `/api/brands/${encodeURIComponent(id)}/runs`,
  brandResults: (id: string) => `/api/brands/${encodeURIComponent(id)}/results`,
  run: (id: string) => `/api/runs/${id}`,
  runEvents: (id: string) => `/api/runs/${id}/events`,
  runCancel: (id: string) => `/api/runs/${id}/cancel`,
  runEvidence: (id: string) => `/api/runs/${id}/evidence`,
  runQuestions: (id: string) => `/api/runs/${id}/questions`,
  runAnswers: (id: string) => `/api/runs/${id}/answers`,
  runChat: (id: string) => `/api/runs/${id}/chat`,
  runPlan: (id: string) => `/api/runs/${id}/plan`,
  runConcepts: (id: string) => `/api/runs/${id}/concepts`,
  runPacks: (id: string) => `/api/runs/${id}/packs`,
  conceptKeyframes: (id: string) => `/api/concepts/${id}/keyframes`,
  conceptApprove: (id: string) => `/api/concepts/${id}/approve`,
  conceptRender: (id: string) => `/api/concepts/${id}/render`,
  conceptAssets: (id: string) => `/api/concepts/${id}/assets`,
  conceptReviews: (id: string) => `/api/concepts/${id}/reviews`,
  runBlueprints: (id: string) => `/api/runs/${id}/blueprints`,
  blueprint: (id: string) => `/api/blueprints/${id}`,
  packDownload: (id: string) => `/api/packs/${id}/download`,
  packPosted: (id: string) => `/api/packs/${id}/posted`,
  packMetrics: (id: string) => `/api/packs/${id}/metrics`,
  /** additive: POST, Manus builds a landing page for the pack (link in pack.landingUrl; never published by us) */
  packLanding: (id: string) => `/api/packs/${id}/landing`,
  spend: () => "/api/spend",
  providers: () => "/api/providers",
  asset: (path: string) => `/api/assets/${path.replace(/^\/+/, "")}`,
  mcp: () => "/api/mcp",
} as const;

// ---------------------------------------------------------------- errors

export const ApiError = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export type ApiError = z.infer<typeof ApiError>;

// ---------------------------------------------------------------- health / providers / spend

export const HealthResponse = z.object({ ok: z.boolean(), version: z.string(), providers: z.array(ProviderStatus) });
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ProvidersResponse = z.array(ProviderStatus);
export type ProvidersResponse = z.infer<typeof ProvidersResponse>;

export const SpendResponse = z.object({
  entries: z.array(SpendEntry),
  byProvider: z.partialRecord(ProviderId, z.number()),
  /** additive: grand total */
  totalUsd: z.number().optional(),
});
export type SpendResponse = z.infer<typeof SpendResponse>;

// ---------------------------------------------------------------- brands

export const BrandsResponse = z.array(BrandSummary);
export type BrandsResponse = z.infer<typeof BrandsResponse>;

export const CreateBrandRequest = z.object({
  url: z.string().min(3),
  name: z.string().optional(),
  vertical: Vertical.optional(),
  countries: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
});
export type CreateBrandRequest = z.infer<typeof CreateBrandRequest>;

export const CreateBrandResponse = z.object({ brand: Brand, run: Run });
export type CreateBrandResponse = z.infer<typeof CreateBrandResponse>;

export const BrandResponse = Brand;
export const PatchDossierRequest = BrandDossier.partial();
export type PatchDossierRequest = z.infer<typeof PatchDossierRequest>;

export const ConnectionsResponse = z.array(Connection);
export const CreateConnectionRequest = z.object({
  provider: ProviderId,
  config: z.record(z.string(), z.string()).optional(),
});
export type CreateConnectionRequest = z.infer<typeof CreateConnectionRequest>;

// ---------------------------------------------------------------- runs

export const CreateRunRequest = z.object({
  kind: RunKind.default("full"),
  /**
   * additive: start from an earlier run's research (evidence + blueprints are copied, intake/research/reverse_engineer
   * are marked done) and go straight to the consultation. A run id, or "recorded" for the brand's recorded live pass.
   */
  reuseResearchFrom: z.string().optional(),
});
export type CreateRunRequest = z.input<typeof CreateRunRequest>;

export const RunsResponse = z.array(Run);
export const EvidenceResponse = z.array(Evidence);
export const EvidenceQuery = z.object({ source: z.string().optional(), kind: z.string().optional() });
export const QuestionsResponse = z.array(Question);

export const AnswersRequest = z.object({
  answers: z
    .array(z.object({ questionId: z.string(), value: z.unknown().optional(), skip: z.boolean().optional() }))
    .min(1),
});
export type AnswersRequest = z.infer<typeof AnswersRequest>;

export const ChatRequest = z.object({ message: z.string().min(1).max(4000) });
export type ChatRequest = z.infer<typeof ChatRequest>;

export const PlanResponse = ChannelPlan;
export const PatchPlanRequest = z.object({
  /** full new order of channels to keep (others are dropped to notNow with reason "dropped by operator") */
  channels: z.array(Channel).optional(),
  drop: z.array(z.object({ channel: Channel, reason: z.string().optional() })).optional(),
});
export type PatchPlanRequest = z.infer<typeof PatchPlanRequest>;

export const ConceptsResponse = z.array(Concept);

// ---------------------------------------------------------------- concepts

export const KeyframesRequest = z.object({ shotIdx: z.number().int().nonnegative().optional() });
export type KeyframesRequest = z.infer<typeof KeyframesRequest>;

export const ApproveRequest = z.object({ shotIdx: z.array(z.number().int().nonnegative()) });
export type ApproveRequest = z.infer<typeof ApproveRequest>;

export const RenderRequest = z.object({ tier: RenderTier.default("draft") });
export type RenderRequest = z.input<typeof RenderRequest>;

export const RenderResponse = z.object({ concept: Concept, estimatedCostUsd: z.number() });
export type RenderResponse = z.infer<typeof RenderResponse>;

export const AssetsResponse = z.array(Asset);
export const ReviewsResponse = z.array(Review);
export const BlueprintsResponse = z.array(Blueprint);
export const BlueprintResponse = Blueprint.extend({ evidence: Evidence.optional() });
export type BlueprintResponse = z.infer<typeof BlueprintResponse>;

// ---------------------------------------------------------------- packs / results

export const PacksResponse = z.array(PublishPack);

export const PostedRequest = z.object({ postedUrl: z.string().min(4), postedAt: z.string().optional() });
export type PostedRequest = z.infer<typeof PostedRequest>;

export const MetricsRequest = z.object({
  views: z.number().nonnegative().optional(),
  likes: z.number().nonnegative().optional(),
  comments: z.number().nonnegative().optional(),
  shares: z.number().nonnegative().optional(),
  saves: z.number().nonnegative().optional(),
  follows: z.number().nonnegative().optional(),
  capturedAt: z.string().optional(),
});
export type MetricsRequest = z.infer<typeof MetricsRequest>;

export const ResultsResponse = z.object({
  packs: z.array(PublishPack.extend({ snapshots: z.array(MetricSnapshot) })),
  learnings: z.array(Learning),
});
export type ResultsResponse = z.infer<typeof ResultsResponse>;

// ---------------------------------------------------------------- SSE

/**
 * GET /api/runs/:id/events: Server-Sent Events.
 * Each message: `id: <RunEvent.id>`, `event: <RunEvent.type>`, `data: <RunEvent JSON>`.
 * Heartbeat comment lines (`: ping`) every 15 s. Reconnect with `Last-Event-ID` to resume without duplicates.
 * When the run reaches done/failed/cancelled the server sends a final `event: end` with `data: {"status": ...}` and closes.
 */
export const RunStreamMessage = RunEvent;
export const RunStreamEnd = z.object({ status: z.string() });

/**
 * POST /api/runs/:id/chat: SSE.
 * `event: token` data `{"text": "..."}`; `event: question` data `Question`; `event: done` data `{"messageId": "..."}`;
 * `event: error` data `{"message": "..."}`.
 */
export const ChatTokenEvent = z.object({ text: z.string() });
export const ChatDoneEvent = z.object({ messageId: z.string() });
export const ChatErrorEvent = z.object({ message: z.string() });
export const CHAT_EVENT_NAMES = ["token", "question", "done", "error"] as const;

// ---------------------------------------------------------------- A19: render versions, revise by chat, variants

/** The layers a revision can touch; everything else is reused byte for byte. */
export const REVISION_LAYERS = [
  "voice",
  "music",
  "sfx",
  "captions",
  "hook_text",
  "shots",
  "pacing",
  "language",
] as const;
export const RevisionLayer = z.enum(REVISION_LAYERS);
export type RevisionLayer = z.infer<typeof RevisionLayer>;

export const RevisionPlan = z.object({
  layers: z.array(RevisionLayer),
  /** plain language, e.g. "voice Lucy -> Hope (warmer, female); captions re-timed; clips reused" */
  summary: z.string(),
  voice: z
    .object({ voiceId: z.string(), name: z.string(), speed: z.number().optional(), stability: z.number().optional() })
    .optional(),
  musicPrompt: z.string().optional(),
  sfx: z.enum(["on", "off", "softer", "louder"]).optional(),
  captions: z
    .object({
      sizePct: z.number().optional(),
      position: z.enum(["upper", "middle", "lower"]).optional(),
      case: z.enum(["as_is", "upper", "lower"]).optional(),
      fill: z.string().optional(),
      accent: z.string().optional(),
    })
    .optional(),
  hookText: z.string().optional(),
  shots: z.array(z.object({ idx: z.number().int().nonnegative(), instruction: z.string() })).optional(),
  language: z.string().optional(),
});
export type RevisionPlan = z.infer<typeof RevisionPlan>;

export const RenderVersion = z.object({
  id: z.string(),
  conceptId: z.string(),
  version: z.number().int().positive(),
  parentId: z.string().optional(),
  /** what the operator asked for (absent for the original render) */
  message: z.string().optional(),
  plan: RevisionPlan.optional(),
  status: z.enum(["rendering", "ready", "failed"]),
  assetId: z.string().optional(),
  assetUrl: z.string().optional(),
  posterUrl: z.string().optional(),
  shots: z.array(z.object({ idx: z.number(), provider: z.string(), clipUrl: z.string().optional() })),
  /** filled when the self-review of this version lands (a few minutes after the video) */
  review: z.object({ overall: z.number(), perShot: z.array(z.number()), notes: z.string() }).optional(),
  costUsd: z.number(),
  chosen: z.boolean(),
  error: z.string().optional(),
  createdAt: z.string(),
});
export type RenderVersion = z.infer<typeof RenderVersion>;

/** POST /api/concepts/:id/revise */
export const ReviseRequest = z.object({ message: z.string().min(1), fromRenderId: z.string().optional() });
export const ReviseResponse = z.union([
  z.object({
    status: z.literal("needs_clarification"),
    question: z.string(),
    options: z.array(z.string()).min(2).max(4),
  }),
  z.object({ status: z.literal("queued"), plan: RevisionPlan, renderId: z.string() }),
]);
export type ReviseResponse = z.infer<typeof ReviseResponse>;

/** POST /api/concepts/:id/variants: alternative clips per shot from each provider (runs in the background). */
export const VariantsRequest = z.object({
  providers: z
    .array(z.enum(["fal", "higgsfield"]))
    .min(1)
    .default(["fal", "higgsfield"]),
  shots: z.array(z.number().int().nonnegative()).optional(),
});
export const ShotVariant = z.object({
  clipId: z.string(),
  idx: z.number(),
  provider: z.string(),
  model: z.string().optional(),
  url: z.string(),
  chosen: z.boolean(),
  costUsd: z.number(),
});
export type ShotVariant = z.infer<typeof ShotVariant>;
/** GET /api/concepts/:id/variants -> { shots: { idx, variants: ShotVariant[] }[] } */
export const VariantsResponse = z.object({
  shots: z.array(z.object({ idx: z.number(), variants: z.array(ShotVariant) })),
});

/** PATCH /api/concepts/:id/shots/:idx { chosenClipId } -> the concept (the next render uses that clip) */
export const ShotPatchRequest = z.object({ chosenClipId: z.string() });

export const A19_ROUTES = {
  revise: (id: string) => `/api/concepts/${id}/revise`,
  renders: (id: string) => `/api/concepts/${id}/renders`,
  choose: (id: string, renderId: string) => `/api/concepts/${id}/renders/${renderId}/choose`,
  variants: (id: string) => `/api/concepts/${id}/variants`,
  shot: (id: string, idx: number) => `/api/concepts/${id}/shots/${idx}`,
} as const;
