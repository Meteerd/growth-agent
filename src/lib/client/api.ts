import type { z } from "zod";
import {
  type AnswersRequest,
  API,
  type Asset,
  AssetsResponse,
  type Blueprint,
  BlueprintResponse,
  BlueprintsResponse,
  type Brand,
  BrandResponse,
  type BrandSummary,
  BrandsResponse,
  type ChannelPlan,
  type Concept,
  Concept as ConceptSchema,
  ConceptsResponse,
  type Connection,
  Connection as ConnectionSchema,
  ConnectionsResponse,
  type CreateBrandRequest,
  CreateBrandResponse,
  type CreateConnectionRequest,
  type CreateRunRequest,
  type Evidence,
  EvidenceResponse,
  type MetricSnapshot,
  MetricSnapshot as MetricSnapshotSchema,
  type MetricsRequest,
  PacksResponse,
  type PatchDossierRequest,
  type PatchPlanRequest,
  PlanResponse,
  type PostedRequest,
  type ProviderStatus,
  ProvidersResponse,
  type PublishPack,
  PublishPack as PublishPackSchema,
  type Question,
  QuestionsResponse,
  type RenderRequest,
  RenderResponse,
  ResultsResponse,
  type Review,
  ReviewsResponse,
  type Run,
  Run as RunSchema,
  RunsResponse,
  SpendResponse,
} from "@/contracts";
import { createMockClient } from "./mock/client";
import { DATA_MODE } from "./mode";
import { createSSEParser, openRunStream, type RunStreamHandlers } from "./sse";

export type ChatHandlers = {
  onToken: (text: string) => void;
  onQuestion?: (q: Question) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

/** Everything the cockpit reads or writes. Live = Lane A's /api routes; mock = in-browser fixtures. */
export interface DataClient {
  mode: "live" | "mock";
  brands(): Promise<BrandSummary[]>;
  brand(idOrSlug: string): Promise<Brand>;
  createBrand(req: CreateBrandRequest): Promise<{ brand: Brand; run: Run }>;
  patchDossier(brandId: string, patch: PatchDossierRequest): Promise<Brand>;
  connections(brandId: string): Promise<Connection[]>;
  connect(brandId: string, req: CreateConnectionRequest): Promise<Connection>;
  brandRuns(brandId: string): Promise<Run[]>;
  startRun(brandId: string, req?: CreateRunRequest): Promise<Run>;
  run(runId: string): Promise<Run>;
  cancelRun(runId: string): Promise<Run>;
  subscribeRun(runId: string, handlers: RunStreamHandlers, opts?: { lastEventId?: number; pace?: number }): () => void;
  evidence(runId: string): Promise<Evidence[]>;
  questions(runId: string): Promise<Question[]>;
  answer(runId: string, req: AnswersRequest): Promise<Question[]>;
  chat(runId: string, message: string, handlers: ChatHandlers): () => void;
  plan(runId: string): Promise<ChannelPlan>;
  patchPlan(runId: string, req: PatchPlanRequest): Promise<ChannelPlan>;
  concepts(runId: string): Promise<Concept[]>;
  regenerateKeyframes(conceptId: string, shotIdx?: number): Promise<Concept>;
  approveShots(conceptId: string, shotIdx: number[]): Promise<Concept>;
  render(conceptId: string, req: RenderRequest): Promise<{ concept: Concept; estimatedCostUsd: number }>;
  conceptAssets(conceptId: string): Promise<Asset[]>;
  conceptReviews(conceptId: string): Promise<Review[]>;
  blueprints(runId: string): Promise<Blueprint[]>;
  blueprint(id: string): Promise<z.infer<typeof BlueprintResponse>>;
  packs(runId: string): Promise<PublishPack[]>;
  packDownloadUrl(packId: string): string;
  markPosted(packId: string, req: PostedRequest): Promise<PublishPack>;
  addMetrics(packId: string, req: MetricsRequest): Promise<MetricSnapshot>;
  results(brandId: string): Promise<z.infer<typeof ResultsResponse>>;
  spend(runId?: string): Promise<z.infer<typeof SpendResponse>>;
  providers(): Promise<ProviderStatus[]>;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const DEV = process.env.NODE_ENV !== "production";

async function request<T>(schema: z.ZodType<T>, url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.json !== undefined ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } })?.error;
    throw new ApiRequestError(res.status, err?.code ?? "http_error", err?.message ?? `${res.status} ${res.statusText}`);
  }
  if (!DEV) return body as T;
  // Dev: validate against the contract so live/mock drift shows up immediately (BS4), but never break the screen.
  const parsed = schema.safeParse(body);
  if (!parsed.success) console.error(`[contract] ${init?.method ?? "GET"} ${url}`, parsed.error.issues.slice(0, 5));
  return (parsed.success ? parsed.data : body) as T;
}

export const liveClient: DataClient = {
  mode: "live",
  brands: () => request(BrandsResponse, API.brands()),
  brand: (id) => request(BrandResponse, API.brand(id)),
  createBrand: (req) => request(CreateBrandResponse, API.brands(), { method: "POST", json: req }),
  patchDossier: (id, patch) => request(BrandResponse, API.brandDossier(id), { method: "PATCH", json: patch }),
  connections: (id) => request(ConnectionsResponse, API.brandConnections(id)),
  connect: (id, req) => request(ConnectionSchema, API.brandConnections(id), { method: "POST", json: req }),
  brandRuns: (id) => request(RunsResponse, API.brandRuns(id)),
  startRun: (id, req = { kind: "full" }) => request(RunSchema, API.brandRuns(id), { method: "POST", json: req }),
  run: (id) => request(RunSchema, API.run(id)),
  cancelRun: (id) => request(RunSchema, API.runCancel(id), { method: "POST", json: {} }),
  subscribeRun: (id, handlers, opts) => {
    const url = opts?.pace ? `${API.runEvents(id)}?pace=${opts.pace}` : API.runEvents(id);
    return openRunStream(url, handlers, { lastEventId: opts?.lastEventId }).close;
  },
  evidence: (id) => request(EvidenceResponse, API.runEvidence(id)),
  questions: (id) => request(QuestionsResponse, API.runQuestions(id)),
  answer: (id, req) => request(QuestionsResponse, API.runAnswers(id), { method: "POST", json: req }),
  chat: (id, message, h) => {
    const ctrl = new AbortController();
    (async () => {
      const res = await fetch(API.runChat(id), {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ message }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);
      const parse = createSSEParser((event, data) => {
        const d = JSON.parse(data);
        if (event === "token") h.onToken(d.text);
        else if (event === "question") h.onQuestion?.(d);
        else if (event === "done") h.onDone?.();
        else if (event === "error") h.onError?.(d.message);
      });
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        parse(value);
      }
    })().catch((e) => {
      if (!ctrl.signal.aborted) h.onError?.(e instanceof Error ? e.message : "chat failed");
    });
    return () => ctrl.abort();
  },
  plan: (id) => request(PlanResponse, API.runPlan(id)),
  patchPlan: (id, req) => request(PlanResponse, API.runPlan(id), { method: "PATCH", json: req }),
  concepts: (id) => request(ConceptsResponse, API.runConcepts(id)),
  regenerateKeyframes: (id, shotIdx) =>
    request(ConceptSchema, API.conceptKeyframes(id), { method: "POST", json: { shotIdx } }),
  approveShots: (id, shotIdx) => request(ConceptSchema, API.conceptApprove(id), { method: "POST", json: { shotIdx } }),
  render: (id, req) => request(RenderResponse, API.conceptRender(id), { method: "POST", json: req }),
  conceptAssets: (id) => request(AssetsResponse, API.conceptAssets(id)),
  conceptReviews: (id) => request(ReviewsResponse, API.conceptReviews(id)),
  blueprints: (id) => request(BlueprintsResponse, API.runBlueprints(id)),
  blueprint: (id) => request(BlueprintResponse, API.blueprint(id)),
  packs: (id) => request(PacksResponse, API.runPacks(id)),
  packDownloadUrl: (id) => API.packDownload(id),
  markPosted: (id, req) => request(PublishPackSchema, API.packPosted(id), { method: "POST", json: req }),
  addMetrics: (id, req) => request(MetricSnapshotSchema, API.packMetrics(id), { method: "POST", json: req }),
  results: (id) => request(ResultsResponse, API.brandResults(id)),
  spend: (runId) => request(SpendResponse, runId ? `${API.spend()}?runId=${runId}` : API.spend()),
  providers: () => request(ProvidersResponse, API.providers()),
};

let mockClient: DataClient | undefined;

/** The active client. The mock store is created on first use so live mode never starts its timers. */
export function getClient(): DataClient {
  if (DATA_MODE === "live") return liveClient;
  if (!mockClient) {
    mockClient = createMockClient();
    // e2e specs set up state (post a pack, add metrics) through the same client the screens use
    if (typeof window !== "undefined") (window as unknown as { __nexusClient: DataClient }).__nexusClient = mockClient;
  }
  return mockClient;
}
