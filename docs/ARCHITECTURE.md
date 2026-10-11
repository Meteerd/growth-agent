# Architecture

Keep it small: **one Next.js app, one SQLite file, runs on localhost.** No separate server, no Docker, no cloud for the demo. Deploying (Vercel or Netlify) is a later step, not tonight.

## 1. Shape

```
 Next.js app (localhost:3000)
 ├── UI: src/app/(app)/...            pages, components, motion, shader            [Lane B]
 ├── API: src/app/api/...             route handlers (REST + SSE)                   [Lane A]
 ├── engine: src/engine/...           agent (Claude), phases, providers, ledger,    [Lane A]
 │                                    rules, video (Remotion), db (Drizzle)
 ├── contracts: src/contracts/...     Zod schemas + types + demo fixtures           [Lane A]
 └── data/ (git-ignored)              nexus.db (SQLite) + assets/ (images, mp4)
```

Long jobs (a GTM run) start from an API route and continue in the background inside the Node process (a small in-process job runner backed by the `runs`/`run_events` tables). Progress streams to the UI over SSE. This is fine for localhost; on Vercel it would need `after()`/queues, which is out of scope tonight.

## 2. Repo layout and ownership

| Path | Owner | Notes |
|---|---|---|
| `src/contracts/` | **Lane A** | Zod v4 schemas + inferred types + route constants + demo fixtures. Single source of truth for every shape below. Lane B imports it, never edits it. |
| `src/engine/` | **Lane A** | agent, phases, providers, ledger, rules, db schema, job runner, video (Remotion) |
| `src/app/api/` | **Lane A** | route handlers only; thin, call into `src/engine` |
| `drizzle/`, `drizzle.config.ts`, `remotion/` | **Lane A** | migrations, Remotion entry |
| `src/app/` (everything except `api/`), `src/components/`, `src/styles/`, `src/lib/client/`, `public/`, `e2e/` | **Lane B** | UI, design system, client data layer, mock mode, Playwright |
| `next.config.ts`, `postcss.config.*`, Tailwind config, `playwright.config.ts` | **Lane B** | |
| `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts` | **shared, additive** | Either lane may ADD dependencies or scripts; never remove or change the other lane's lines. On a merge conflict keep both sides' additions. |
| `coord/*`, `docs/DECISIONS.md`, `scripts/` | both | see `coord/PROTOCOL.md` |

**Bootstrap:** Lane A scaffolds the Next.js app at the repo root as task A01 in the first ~15 minutes and pushes it. Lane B does not scaffold; until A01 lands it prepares design work and syncs every few minutes.

## 3. Stack (decided; do not relitigate overnight)
- Next.js 15 App Router, React 19, TypeScript strict, pnpm, `src/` directory, Node runtime for API routes.
- Data: SQLite via Drizzle ORM + `@libsql/client` (`DATABASE_URL=file:./data/nexus.db`). Same driver can point at a hosted libSQL/Turso URL later for deployment.
- Agent: `@anthropic-ai/sdk` (tool runner + Zod tools, streaming, structured outputs, per-route effort). OpenAI SDK for images, TTS and transcription.
- Video: Remotion (`@remotion/renderer`, `@remotion/bundler`) rendering locally to `data/assets/`.
- UI: Tailwind CSS v4, Motion, GSAP, Lenis, React Three Fiber + drei + custom GLSL, Radix primitives (fully restyled), TanStack Query, Zustand.
- Tests: Vitest (unit, no live API calls), Playwright (e2e + screenshots).
- Scripts in `package.json`: `dev`, `build`, `start`, `check` (typecheck + lint + vitest, under ~3 min), `db:migrate`, `seed`, `e2e`, `smoke`.

## 4. Environment
All config from `.env` at the repo root (template `.env.example`); Next.js loads it automatically. Server-only keys are read only in `src/engine` (never exposed with `NEXT_PUBLIC_`). A provider is **live** only if its key is present AND its id is in `LIVE_PROVIDERS`; otherwise it is **demo** (labelled fixtures). Live calls stay within `BUDGET_USD_*`. Smoke scripts may force one live call for a non-listed provider with `--live`, still within its cap.

## 5. Data contracts (implement exactly in `src/contracts/`)
Names are camelCase in TS; DB columns snake_case. Every entity has `id` (uuid v7 or cuid2, string) and `createdAt` (ISO string) unless noted. `demo: boolean` marks fixture-derived rows.

```ts
type Vertical = 'telehealth_rx' | 'consumer_app' | 'health_wellness_dtc' | 'b2b_saas' | 'other'
type Channel = 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'x' | 'linkedin' | 'reddit'
  | 'meta_ads' | 'tiktok_ads' | 'google_ads' | 'email' | 'seo' | 'communities' | 'app_store'
type Phase = 'intake' | 'research' | 'consult' | 'direction' | 'production' | 'compliance' | 'pack' | 'measure'
type ProviderId = 'anthropic' | 'openai' | 'firecrawl' | 'apify' | 'manus' | 'fal' | 'higgsfield' | 'youtube' | 'spiral'
  | 'revenuecat' | 'posthog' | 'stripe' | 'paddle' | 'meta' | 'instagram'

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

## 6. HTTP API (Next.js route handlers under `src/app/api/`, same origin, JSON)
All paths below are prefixed with `/api` (e.g. `GET /api/brands`). Route handlers run on the Node runtime (`export const runtime = 'nodejs'`).
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
| GET | `/assets/[...path]` | | files from `ASSETS_DIR` (route handler streaming local files) |
| ALL | `/mcp` (stretch) | MCP Streamable HTTP | tools: `list_brands`, `get_dossier`, `update_dossier`, `get_rule_pack`, `search_evidence`, `get_channel_plan`, `log_results`, `get_learnings` |

Errors: `{error: {code, message}}` with proper HTTP status.

## 7. Engine internals (Lane A)
- `src/engine/providers/<name>.ts`: each exports `{id, isLive(), estimateCost(input), call(input)}`; the demo implementation returns fixtures from `src/contracts/fixtures/`. Every live call is recorded in the spend ledger and refused past its cap (`BudgetExceededError` -> `warning` RunEvent; that step continues in demo).
- `src/engine/agent/`: phase runners (`intake`, `research`, `consult`, `direction`, `production`, `compliance`, `pack`, `measure`), each a Claude tool-runner loop with a narrow tool set and a structured final output. Every tool call emits RunEvents. Prompts in `src/engine/agent/prompts/*.md`.
- Rule packs: `src/engine/rules/<pack>.md` from `docs/BRANDS.md`.
- Seed: `pnpm seed` creates the four brands from `src/contracts/fixtures/brands.ts`.
- Live smoke tests (`pnpm smoke <provider>`): one minimal real call per provider, saved to `src/contracts/fixtures/live/<provider>/` so demo mode can replay real data.

## 8. UI internals (Lane B)
- `src/lib/client/api.ts`: typed fetch client using `src/contracts` schemas; `src/lib/client/sse.ts`: EventSource wrapper with reconnect + `Last-Event-ID`.
- `NEXT_PUBLIC_DATA_MODE=mock` swaps in `src/lib/client/mock/` (in-browser mock built from contract fixtures, including a scripted SSE-like run that plays a full GTM run in ~60 s), so every screen works before Lane A's routes exist. Mock data shows a "Demo data" badge. Default for the demo is `live` (real API routes).
- Playwright e2e runs in mock mode always, and against the real API routes when they respond. Screenshots of every screen at 1440x900 and 390x844 into `e2e/screens/` (committed) for the morning review.

## 9. Later (not tonight)
Deploy to Vercel or Netlify: hosted libSQL (Turso) or Postgres for data, object storage for assets, background runs via `after()`/a queue, video render kept local or moved to Remotion Lambda.
