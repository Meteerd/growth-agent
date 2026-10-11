import { z } from "zod";
import {
  Asset,
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
  packDownload: (id: string) => `/api/packs/${id}/download`,
  packPosted: (id: string) => `/api/packs/${id}/posted`,
  packMetrics: (id: string) => `/api/packs/${id}/metrics`,
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

export const CreateRunRequest = z.object({ kind: RunKind.default("full") });
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
