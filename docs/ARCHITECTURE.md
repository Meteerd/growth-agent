# Architecture

## 1. Shape

```
 apps/web (Next.js cockpit, port 3100)  ── REST + SSE ──>  apps/engine (Hono API + job runner, port 4100)
        │                                                     │
        └── mock mode: in-app fixtures from @nexus/contracts  ├── Postgres 17 (docker, port 5433) via Drizzle
                                                              ├── data/assets (local files served at /assets)
                                                              ├── agent: Claude (@anthropic-ai/sdk tool runner)
                                                              ├── providers: Apify, Manus, fal, Higgsfield, OpenAI,
                                                              │              ElevenLabs, RevenueCat, PostHog, Stripe,
                                                              │              Paddle, Meta/Instagram, YouTube, Spiral
                                                              ├── video: @nexus/video (Remotion) assembly
                                                              └── MCP server at /mcp (Streamable HTTP) exposing brand tools
```

## 2. Repo layout and ownership

| Path | Owner | Notes |
|---|---|---|
| `packages/contracts/` | **Lane A** | Zod v4 schemas + inferred TS types + route constants + demo fixtures. Single source of truth for every shape below. |
| `apps/engine/` | **Lane A** | Hono server, Drizzle schema + migrations, job runner, agent, providers, ledger, MCP server |
| `packages/video/` | **Lane A** | Remotion compositions + render function |
| `docker-compose.yml`, root `package.json` scripts, `pnpm-workspace.yaml`, `tsconfig.base.json` | **Lane A** | Lane B requests changes through `coord/INBOX_A.md` |
| `apps/web/` | **Lane B** | Next.js App Router cockpit, design system, mock engine, Playwright e2e |
| `packages/ui/` (optional) | **Lane B** | Only if B wants to split the design system out |
| `docs/DESIGN.md` | **Lane B** | Keep updated with the real tokens |
| `coord/*`, `docs/DECISIONS.md` | both, append-only | Each lane writes only its own STATUS/TASKS; INBOX files are written by the *other* lane |

## 3. Stack (decided; do not relitigate overnight)
- Node 22+ (machines have Node 26), pnpm workspaces, TypeScript strict everywhere, ESM.
- Root scripts: `pnpm dev` (engine + web in parallel), `pnpm check` (typecheck + lint + unit tests for all packages; must stay under ~3 minutes), `pnpm db:up` (docker compose up -d db), `pnpm db:migrate`, `pnpm seed`, `pnpm e2e`.
- **Engine:** Hono + `@hono/node-server`, Drizzle ORM + `postgres` driver, Postgres 17 in Docker (`docker-compose.yml`, service `db`, port 5433, user/pass/db `nexus`). Job runner: pg-boss (or a small DB-backed queue if pg-boss fights you). SSE via Hono streaming. Zod validation on every route. Vitest.
- **Agent:** `@anthropic-ai/sdk`, tool runner with Zod tools, streaming, `output_config.effort` set per route (interview chat: `low`; extraction/deconstruction: `medium`; strategy/channel plan/compliance: `high`). Structured outputs for every machine-read result. Refusal handling and the server-side `fallbacks` option per the `claude-api` skill. OpenAI SDK only for images/TTS/fallback.
- **MCP:** `@modelcontextprotocol/sdk` Streamable HTTP server mounted at `/mcp` on the engine.
- **Video:** Remotion (`@remotion/renderer`, `@remotion/bundler`) for assembly; ffmpeg optional fallback (not installed on Mete's machine; `brew install ffmpeg` is allowed).
- **Web:** Next.js 15 App Router, React 19, Tailwind CSS v4, Motion (framer-motion successor), GSAP (+ ScrollTrigger), Lenis, React Three Fiber + drei + custom GLSL, Radix primitives (restyled; do NOT ship default shadcn look), TanStack Query, Zustand, Recharts or visx for charts, Playwright for e2e.

## 4. Environment
All config from `.env` at the repo root (template `.env.example`). Both apps load it (engine via `dotenv`; Next via `@next/env` or explicit loading in `next.config`). A provider is **live** only if its key is present AND its id is in `LIVE_PROVIDERS` (comma list); otherwise it is **demo**. Live calls stay within `BUDGET_USD_*`. Smoke scripts may force one live call for a non-listed provider with an explicit `--live` flag, still within its cap.

## 5. Data contracts (implement exactly in `packages/contracts`)
Names are camelCase in TS; DB columns snake_case. Every entity has `id` (uuid v7 or cuid2, string) and `createdAt` (ISO string) unless noted. `demo: boolean` marks fixture-derived rows.

```ts
type Vertical = 'telehealth_rx' | 'consumer_app' | 'health_wellness_dtc' | 'b2b_saas' | 'other'
type Channel = 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'x' | 'linkedin' | 'reddit'
  | 'meta_ads' | 'tiktok_ads' | 'google_ads' | 'email' | 'seo' | 'communities' | 'app_store'
type Phase = 'intake' | 'research' | 'consult' | 'direction' | 'production' | 'compliance' | 'pack' | 'measure'
type ProviderId = 'anthropic' | 'bedrock' | 'openai' | 'apify' | 'manus' | 'fal' | 'higgsfield' | 'elevenlabs' | 'deepgram'
  | 'tavus' | 'sync' | 'firecrawl' | 'browser_use' | 'youtube' | 'spiral' | 'revenuecat' | 'posthog' | 'stripe' | 'paddle' | 'meta' | 'instagram'

Brand { id, slug, name, url, vertical: Vertical, countries: string[] /*ISO-2*/, languages: string[] /*BCP-47*/,
  rulePack: string /*e.g. 'eu_rx_telehealth'*/, dossier: BrandDossier, demo: boolean, createdAt, updatedAt }

BrandDossier { oneLiner: string, positioning: string, offers: {name, price?, notes?}[],
  personas: {name, pains: string[], desires: string[], objections: string[], whereTheyAre: string[]}[],
  voice: {tone: string, do: string[], dont: string[]}, proof: string[],
  claimsAllowed: string[], claimsForbidden: string[],
  visual: {colors: string[], logoUrl?: string, fonts?: string[]}, competitors: {name, url}[],
  gaps: string[] /*what we still don't know*/, sources: {url, fetchedAt}[] }

Connection { id, brandId, provider: ProviderId, status: 'live' | 'demo' | 'missing' | 'error',
  config: Record<string,string> /*non-secret ids only*/, lastSyncAt?: string, summary?: string, error?: string }

Run { id, brandId, kind: 'full' | 'research_only' | 'production_only', status: 'queued' | 'running' | 'waiting_input' | 'done' | 'failed' | 'cancelled',
  phase: Phase, costUsd: number, startedAt?, finishedAt?, error?: string, demo: boolean }

RunEvent { id: number /*monotonic per run, used as SSE id*/, runId, ts, phase: Phase,
  type: 'phase_started' | 'phase_completed' | 'thinking' | 'tool_call' | 'tool_result' | 'evidence' | 'question'
      | 'plan' | 'concept' | 'asset' | 'compliance' | 'pack' | 'cost' | 'warning' | 'error' | 'log',
  title: string, detail?: string, refId?: string /*id of the entity created*/, costUsd?: number, data?: unknown }

Evidence { id, brandId, runId, source: 'website' | 'meta_ad_library' | 'tiktok' | 'instagram' | 'youtube' | 'reddit'
    | 'google_maps' | 'app_store' | 'play_store' | 'trustpilot' | 'spiral' | 'manus_research' | 'revenuecat' | 'posthog' | 'stripe' | 'paddle' | 'meta_ads',
  kind: 'ad' | 'post' | 'video' | 'thread' | 'review' | 'page' | 'metric' | 'research',
  url?: string, title: string, author?: string, thumbnailUrl?: string, mediaUrl?: string, text?: string,
  metrics: {views?, likes?, comments?, shares?, followers?, daysRunning?, outlierScore?, rating?},
  deconstruction?: {hook?: string, format?: string, angle?: string, beats?: {t: number, what: string}[], emotion?: string, cta?: string, lengthSec?: number, language?: string},
  tags: string[], capturedAt, demo: boolean }

Question { id, runId, order: number, kind: 'single' | 'multi' | 'text' | 'scale' | 'confirm',
  prompt: string, why: string, evidenceIds: string[], options?: {id, label, hint?}[], defaultAnswer?: unknown,
  required: boolean, answer?: unknown, answeredAt?: string, skipped?: boolean, assumption?: string }

ChannelPlan { id, runId, brandId, version: number, summary: string,
  weights: {audience, provenWins, productionFit, complianceRisk, speedToSignal, modelFit},
  channels: ChannelRec[], notNow: {channel: Channel, reason: string, evidenceIds: string[]}[], createdAt }
ChannelRec { channel: Channel, priority: number, score: number /*0-100*/, scores: {audience, provenWins, productionFit, complianceRisk, speedToSignal, modelFit},
  mode: 'organic' | 'paid' | 'both', rationale: string, evidenceIds: string[], formats: string[], cadence: string,
  firstSteps: string[], kpis: string[], targets: string[] /*subreddits, hashtags, creator types*/ }

Concept { id, runId, brandId, channel: Channel, format: 'ugc_talking_head' | 'faceless_broll' | 'product_demo' | 'founder_story'
    | 'listicle' | 'myth_vs_fact' | 'static' | 'carousel' | 'text_post',
  title: string, hook: string, angle: string, language: string, shots: Shot[], caption: string, hashtags: string[],
  cta: string, remakesEvidenceIds: string[], compliance: 'pending' | 'pass' | 'warn' | 'fail', estimatedCostUsd: number,
  status: 'draft' | 'keyframes' | 'approved' | 'rendering' | 'rendered' | 'failed', createdAt }
Shot { idx: number, durationSec: number, visualPrompt: string, onScreenText?: string, voiceover?: string,
  keyframeAssetId?: string, clipAssetId?: string, approved: boolean }

Asset { id, brandId, conceptId?, kind: 'keyframe' | 'clip' | 'voice' | 'music' | 'video' | 'image' | 'cover',
  url: string /*served by engine /assets/...*/, provider: ProviderId | 'local', model?: string, costUsd: number,
  width?, height?, durationSec?, demo: boolean, createdAt }

ComplianceCheck { id, targetType: 'concept' | 'caption' | 'shot' | 'pack', targetId, rulePack: string,
  status: 'pass' | 'warn' | 'fail', findings: {ruleId: string, severity: 'info' | 'warn' | 'block', message: string, excerpt?: string}[], createdAt }

PublishPack { id, conceptId, brandId, platform: Channel, videoAssetId?: string, imageAssetIds: string[], caption: string,
  hashtags: string[], firstComment?: string, postAt?: string, checklist: string[],
  status: 'ready' | 'posted', postedUrl?: string, postedAt?: string, createdAt }

MetricSnapshot { id, packId, capturedAt, views?, likes?, comments?, shares?, saves?, follows?, source: 'manual' | 'api' }
Learning { id, brandId?: string /*null = global*/, insight: string, evidence: string, confidence: 'low' | 'medium' | 'high', createdAt }
SpendEntry { id, provider: ProviderId, runId?, usd: number, units?: string, note: string, ts }
ProviderStatus { provider: ProviderId, mode: 'live' | 'demo', keyPresent: boolean, verified: boolean, budgetUsd?: number, spentUsd: number, note?: string }
```

## 6. HTTP API (engine, JSON, base `http://localhost:4100`)
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/health` | | `{ok, version, providers: ProviderStatus[]}` |
| GET | `/brands` | | `Brand[]` (with counts: runs, packsReady, packsPosted, totalViews) |
| POST | `/brands` | `{url, name?, vertical?, countries?, languages?}` | `{brand, run}` (intake run started) |
| GET | `/brands/:id` | | `Brand` |
| PATCH | `/brands/:id/dossier` | partial `BrandDossier` | `Brand` |
| GET/POST | `/brands/:id/connections` | POST `{provider, config?}` | `Connection[]` / `Connection` |
| POST | `/brands/:id/runs` | `{kind}` | `Run` |
| GET | `/brands/:id/runs` | | `Run[]` |
| GET | `/runs/:id` | | `Run` |
| GET | `/runs/:id/events` | SSE; honours `Last-Event-ID` | stream of `RunEvent` (event name = `type`) |
| POST | `/runs/:id/cancel` | | `Run` |
| GET | `/runs/:id/evidence` | `?source=&kind=` | `Evidence[]` |
| GET | `/runs/:id/questions` | | `Question[]` |
| POST | `/runs/:id/answers` | `{answers: {questionId, value?, skip?}[]}` | `Question[]` (run resumes when all required are answered or skipped) |
| POST | `/runs/:id/chat` | `{message}` | SSE: `token` events (assistant text), `question` events (new Question), `done` |
| GET | `/runs/:id/plan` | | `ChannelPlan` (latest version) |
| PATCH | `/runs/:id/plan` | `{channels?: reorder/drop}` | `ChannelPlan` (new version) |
| GET | `/runs/:id/concepts` | | `Concept[]` |
| POST | `/concepts/:id/keyframes` | `{shotIdx?}` (regenerate one or all) | `Concept` |
| POST | `/concepts/:id/approve` | `{shotIdx[]}` | `Concept` |
| POST | `/concepts/:id/render` | `{tier: 'draft' | 'final'}` | `{concept, estimatedCostUsd}` (async; progress via run events) |
| GET | `/concepts/:id/assets` | | `Asset[]` |
| GET | `/runs/:id/packs` | | `PublishPack[]` |
| GET | `/packs/:id/download` | | zip |
| POST | `/packs/:id/posted` | `{postedUrl, postedAt?}` | `PublishPack` |
| POST | `/packs/:id/metrics` | `{views?, likes?, ...}` | `MetricSnapshot` |
| GET | `/brands/:id/results` | | `{packs: (PublishPack & {snapshots: MetricSnapshot[]})[], learnings: Learning[]}` |
| GET | `/spend` | `?runId=` | `{entries: SpendEntry[], byProvider: Record<ProviderId, number>}` |
| GET | `/providers` | | `ProviderStatus[]` |
| GET | `/assets/*` | | static files from `ASSETS_DIR` |
| ALL | `/mcp` | MCP Streamable HTTP | tools: `list_brands`, `get_dossier`, `update_dossier`, `get_rule_pack`, `search_evidence`, `get_channel_plan`, `log_results`, `get_learnings` |

Errors: `{error: {code, message}}` with proper HTTP status. CORS allows `http://localhost:3100`.

## 7. Engine internals (Lane A)
- `providers/<name>.ts`: each exports `{id, isLive(), estimateCost(input), call(input)}`; demo implementation returns fixtures from `packages/contracts/fixtures/<provider>/`. Live implementation records every call in the ledger and refuses when the cap would be exceeded (throws `BudgetExceededError`, surfaced as a `warning` RunEvent, run continues in demo for that step).
- `agent/`: phase runners (`intake`, `research`, `consult`, `direction`, `production`, `compliance`, `pack`, `measure`), each a Claude tool-runner loop with a narrow tool set and a structured final output. Every tool call emits RunEvents. Prompts live in `agent/prompts/*.md` (versioned text, not inline strings).
- Rule packs: `apps/engine/rules/<pack>.md` + parsed rule ids, loaded into the compliance prompt.
- Seed: `pnpm seed` creates the four brands from `docs/BRANDS.md` data (copy into `packages/contracts/fixtures/brands.ts`).
- Live smoke tests (`pnpm --filter @nexus/engine smoke:<provider>`): one minimal real call per provider (e.g. 20-item Apify run, one fal 5 s draft clip, one OpenAI image, one Manus `lite` task, one short Claude call), saving the response to `packages/contracts/fixtures/live/<provider>/` so demo mode can replay real data. Run each at most once per night unless it failed.

## 8. Web internals (Lane B)
- `lib/engine/client.ts`: typed client from `@nexus/contracts`; `lib/engine/sse.ts`: EventSource wrapper with reconnect + `Last-Event-ID`.
- `NEXT_PUBLIC_ENGINE_MODE=mock` swaps in `lib/engine/mock/` (in-browser or route-handler mock server built from contracts fixtures, including a scripted SSE run that plays a full GTM run in ~60 s). Mock data shows a "Demo data" badge.
- Playwright e2e runs against mock mode (always) and against the real engine when it is up (`E2E_ENGINE=live`). Screenshots of every screen at 1440x900 and 390x844 into `apps/web/e2e/screens/` (committed, small PNGs) for the morning review.
