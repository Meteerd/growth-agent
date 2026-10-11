# Lane A tasks (engine)

Format: `- [ ] Axx title` then acceptance checks. When done: `- [x] Axx title (commit <hash>)`. Work top to bottom unless blocked; note reorders in STATUS_A.

## CORE

- [ ] **A01 Monorepo bootstrap** (target: first 20 min)
  - Root `package.json` (private, `packageManager` pnpm, scripts: `dev`, `check`, `db:up`, `db:migrate`, `seed`, `e2e`, `smoke`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `tsconfig.base.json` (strict, ESM, NodeNext or Bundler as appropriate), Biome config, `docker-compose.yml` (Postgres 17, port 5433, `nexus`/`nexus`/`nexus`, healthcheck, named volume).
  - `pnpm check` must work even when a workspace has no tests yet, and finish in under ~3 minutes as the repo grows (use `pnpm -r --parallel` where safe).
  - Accept: `pnpm install` ok; `pnpm check` exits 0; `pnpm db:up` then `docker compose ps` shows db healthy. Sync and tell Lane B in `INBOX_B.md`.

- [ ] **A02 @nexus/contracts** (target: within first 60 min)
  - Zod v4 schemas + inferred types for every entity in `docs/ARCHITECTURE.md` section 5; enums exported as const arrays; route constants and request/response schemas for section 6; SSE event schema.
  - Fixtures: the four brands from `docs/BRANDS.md` (full dossiers), and one complete demo run per brand (Hound and a.clinic rich: 30+ evidence across 5+ sources with deconstructions and plausible but clearly-demo metrics flagged `demo: true`; 6 questions with whys; a channel plan with scores, evidence links and notNow; 4 concepts with shot lists; packs). Evreon and Dynova lighter but complete.
  - Build so Next.js can import it (ESM, `exports` map, types). 
  - Accept: unit test parses every fixture with its schema; `pnpm --filter @nexus/contracts build` ok. Sync; message Lane B with import instructions.

- [ ] **A03 Engine skeleton + DB**
  - Hono app, env loading from repo-root `.env`, CORS for `http://localhost:3100`, error format, request logging to `logs/engine.log`.
  - Drizzle schema + migrations for all entities; `pnpm db:migrate`; `pnpm seed` inserts the four brands (idempotent).
  - Routes: `/health`, `/providers`, `/brands` (GET/POST), `/brands/:id`, `PATCH /brands/:id/dossier`, connections, `/assets/*` static.
  - Accept: `curl localhost:4100/health` ok; `curl localhost:4100/brands` returns 4 brands; Vitest route tests with a test DB (or pglite) pass.

- [ ] **A04 Providers framework + spend ledger**
  - Provider interface, registry, live/demo resolution (key present AND id in `LIVE_PROVIDERS`; smoke `--live` override), `SpendEntry` writes, `BudgetExceededError`, `/spend`.
  - Accept: unit tests: demo returns fixture; live call blocked when estimate exceeds remaining cap; ledger sums per provider.

- [ ] **A05 Runs, job runner, SSE**
  - Run state machine (`queued` -> `running` -> `waiting_input` -> `running` -> `done`/`failed`/`cancelled`), phase progression, RunEvent persistence with monotonic ids, `GET /runs/:id/events` SSE with `Last-Event-ID` resume and heartbeat, cancel.
  - Accept: `curl -N localhost:4100/runs/<id>/events` streams a demo run; reconnect with `Last-Event-ID` resumes without duplicates (test).

- [ ] **A06 Claude agent core**
  - Anthropic wrapper (model from env, per-route effort, streaming, structured outputs, refusal handling, server-side fallbacks per the skill, usage -> ledger cost using the model's price), tool runner helper that emits RunEvents, prompt loader, recorded-response mode for tests (no live calls in `pnpm check`).
  - Accept: unit tests with recorded responses; one live smoke (`pnpm --filter @nexus/engine smoke:anthropic`) within cap, output saved to fixtures/live.

- [ ] **A07 Intake phase**
  - Crawl the site (direct fetch + readability; Apify website crawler or Firecrawl when live), extract dossier fields + visual identity with structured output, record sources, never overwrite operator-edited fields (track `editedBy`).
  - Accept: demo intake for all four brands produces dossiers matching schema; live intake on houndapp.xyz (one call) recorded.

- [ ] **A08 Research phase**
  - Providers: Apify ads library (EU countries for a.clinic), TikTok, Instagram, Reddit, Google Maps / app reviews; YouTube search; Manus deep-research task (structured output, poll, keep `task_url`); RevenueCat/PostHog/Stripe/Paddle summaries. Normalize to Evidence; outlier score; longevity tiers; batch deconstruction with Claude.
  - Accept: demo run yields >= 30 evidence from >= 5 sources for Hound and a.clinic; unit tests for outlier score and longevity; Manus provider tested against recorded fixture.

- [ ] **A09 Consult phase + chat**
  - Gap-driven question generation (5 to 9, each with `why` + evidence ids), `waiting_input` until answered/skipped, `POST /runs/:id/answers`, `POST /runs/:id/chat` SSE (tokens + new question cards), answers written into dossier with provenance.
  - Accept: demo run pauses at consult and resumes after answers (test); chat streams tokens (curl -N).

- [ ] **A10 Direction phase**
  - Score all candidate channels on the six axes with explicit weights; structured ChannelPlan with rationale, evidence ids, formats, cadence, first steps, KPIs, targets (named subreddits, hashtags); notNow with reasons; versioned PATCH.
  - Accept: a.clinic plan puts `meta_ads` in notNow citing RX4; Evreon plan ranks LinkedIn first and does not recommend TikTok in top 3; Hound plan includes TikTok/Reels and named subreddits (tests on demo fixtures + one live recorded run).

- [ ] **A11 Production phase + video**
  - Concepts for top channels (3 to 6), shot lists, keyframes (OpenAI image or fal; demo: locally generated branded frames via `sharp`/SVG, labelled demo), approve endpoints, render draft/final (fal/Higgsfield image-to-video when live; demo: Remotion Ken Burns from keyframes), TTS, Remotion assembly to MP4, cost estimate before render.
  - Accept: demo render produces a real playable 1080x1920 MP4 for one Hound concept (ffprobe or Remotion metadata output shown); cost estimate endpoint returns numbers from the provider price table.

- [ ] **A12 Compliance**
  - Rule packs from `docs/BRANDS.md` into `apps/engine/rules/`, checker with structured output, auto-revise up to 2 times, blocks render/export on fail.
  - Accept: tests: an a.clinic caption mentioning "Ozempic" fails RX1; a Hound script promising "cure separation anxiety in 7 days" fails P1; clean versions pass.

- [ ] **A13 Packs, metrics, results, learnings**
  - PublishPack per concept/platform, zip download (mp4 + caption.txt + hashtags + checklist.md + cover.jpg), mark posted, manual metrics, `/brands/:id/results`, learnings after metrics.
  - Accept: download a zip and list its contents in the output; results endpoint returns snapshots ordered by time.

- [ ] **A14 MCP server**
  - `/mcp` Streamable HTTP with the tools in ARCHITECTURE section 6.
  - Accept: an MCP client script lists tools and calls `list_brands` successfully.

- [ ] **A15 Live smoke tests + real dataset**
  - One live smoke per provider with a key (Anthropic, OpenAI, Deepgram, Firecrawl, Apify, Manus, fal, Higgsfield, ElevenLabs, Tavus, sync.), each within cap, recorded. Deepgram: transcribe 3 competitor videos from the evidence set so deconstructions carry verbatim hooks. Then one live research pass for Hound and a.clinic with small limits, recorded as their default dataset (flag `demo: false`, `capturedAt`). Update `docs/APIS.md` with every verified detail.
  - Accept: `/spend` shows totals under caps; recorded fixtures exist; STATUS_A lists spend per provider.

- [ ] **A16 Engine e2e**
  - `pnpm --filter @nexus/engine test:e2e`: full run through every phase for all four brands in demo mode, asserting schemas, phase order, compliance outcomes and that a video asset exists for at least one Hound concept.
  - Accept: command exits 0 (output shown).

- [ ] **A17 Morning report**
  - `coord/MORNING_A.md` + root `README.md` "Run it" section: exact commands from a fresh clone to a working app (`pnpm i`, `cp .env.example .env`, `pnpm db:up`, `pnpm db:migrate`, `pnpm seed`, `pnpm dev`), what is live vs demo, spend, known issues, and the 2-minute demo path for the pitch.

## STRETCH (after CORE, in this order)
- [ ] **AS1** Manus landing page: for a chosen concept, a Manus task builds a campaign landing page; store the site link via `website.status`; show it in the pack.
- [ ] **AS2** One real fal draft render (cheapest tier) for one Hound concept within the fal cap; save as asset; keep the demo render as fallback.
- [ ] **AS3** Instagram insights reader (Business account) behind a connection; manual entry stays the default.
- [ ] **AS4** Optional auto-post adapter (Upload-Post or Zernio), disabled by default, explicit human click only.
- [ ] **AS5** Cross-brand learnings promotion (pattern holds in 2+ brands).
- [ ] **AS6** Prompt caching audit: verify `cache_read_input_tokens > 0` on repeated phase calls.
- [ ] **AS7** Harden: retries with backoff on provider 429/5xx, run resume after engine restart.
- [ ] **AS8** Deepgram in research by default: transcribe top outlier videos (audio) and store transcripts on Evidence; deconstruction uses them.
- [ ] **AS9** Talking-head format via Tavus (presenter video from script) and sync. (lip-sync/localize SK/CZ/ES), behind caps, demo fallback.
- [ ] **AS10** Langfuse tracing of every Claude call and tool call (only if keys present).
- [ ] **AS11** Bedrock fallback engine: if the Anthropic API returns auth/credit/rate errors repeatedly, route Claude calls through Amazon Bedrock (`@anthropic-ai/bedrock-sdk` Mantle client per the claude-api skill) when AWS keys exist.
