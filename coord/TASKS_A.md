# Lane A tasks (engine, inside the one Next.js app)

Format: `- [ ] Axx title` then acceptance checks. When done: `- [x] Axx title (commit <hash>)`. Work top to bottom unless blocked; note reorders in STATUS_A.

## CORE

- [x] **A01 Scaffold the app** (commit 8e73900)
  - `pnpm create next-app` at the repo root (TypeScript, App Router, `src/` dir, Tailwind, ESLint off in favour of Biome, import alias `@/*`), keep existing `docs/`, `coord/`, `scripts/`, `.env.example`. Add Biome, Vitest. `package.json` scripts: `dev`, `build`, `start`, `check` (tsc --noEmit + biome + vitest run, under ~3 min), `db:migrate`, `seed`, `e2e` (placeholder until Lane B adds Playwright), `smoke`.
  - Create empty owned folders with a README line each: `src/contracts`, `src/engine`, `src/app/api`. Do not build UI pages beyond the default (Lane B owns them).
  - Accept: `pnpm install`, `pnpm check` and `pnpm build` exit 0; `pnpm dev` serves http://localhost:3000. Sync, then write in `coord/INBOX_B.md`: "A01 landed, app scaffolded, you can start".

- [x] **A02 Contracts** (commit 563ebb7, blueprint/review extension 4134c2f)
  - `src/contracts/`: Zod v4 schemas + inferred types for every entity in `docs/ARCHITECTURE.md` section 5; enums as const arrays; request/response schemas and route constants for section 6; SSE event schema.
  - Fixtures: the four brands from `docs/BRANDS.md` (full dossiers) and one complete demo run per brand (Hound and a.clinic rich: 30+ evidence across 5+ sources with deconstructions and clearly-demo metrics flagged `demo: true`; 6 questions with whys; a channel plan with scores, evidence links and notNow; 4 concepts with shot lists; packs). Evreon and Dynova lighter but complete.
  - Accept: Vitest parses every fixture with its schema. Sync; tell Lane B in INBOX_B how to import (`@/contracts`).

- [x] **A03 DB + brands API** (commit cd8945c)
  - Drizzle + `@libsql/client`, SQLite at `DATABASE_URL` (`file:./data/nexus.db`), schema for all entities, migrations in `drizzle/`, `pnpm db:migrate`, idempotent `pnpm seed` (four brands).
  - Routes: `GET/POST /api/brands`, `GET /api/brands/[id]`, `PATCH /api/brands/[id]/dossier`, connections, `GET /api/providers`, `GET /api/assets/[...path]`.
  - Accept: `curl localhost:3000/api/brands` returns 4 brands; Vitest route/service tests on a temp SQLite file pass.

- [x] **A04 Providers + spend ledger** (commit d887d0d)
  - Provider interface, registry, live/demo resolution (key present AND id in `LIVE_PROVIDERS`; smoke `--live` override), `SpendEntry` writes, `BudgetExceededError`, `GET /api/spend`.
  - Accept: unit tests: demo returns fixture; live call blocked past cap; ledger sums per provider.

- [x] **A05 Runs, job runner, SSE** (commit cb7e886)
  - In-process job runner (survives within the dev server process; resumable from DB on restart is stretch), Run state machine (`queued` -> `running` -> `waiting_input` -> `running` -> `done`/`failed`/`cancelled`), RunEvent persistence with monotonic ids, `GET /api/runs/[id]/events` SSE with `Last-Event-ID` resume and heartbeat, cancel.
  - Accept: `curl -N localhost:3000/api/runs/<id>/events` streams a demo run; reconnect with `Last-Event-ID` resumes without duplicates (test).

- [x] **A06 Claude agent core** (commit 41584f1)
  - Anthropic wrapper (model from env, per-route effort, streaming, structured outputs, refusal handling, usage -> ledger cost), tool-runner helper emitting RunEvents, prompt loader, recorded-response mode for tests (no live calls in `pnpm check`).
  - Accept: unit tests with recorded responses; `pnpm smoke anthropic` makes one live call within cap and saves it to fixtures/live.

- [ ] **A07 Intake phase**
  - Crawl the site with Firecrawl when live (fallback: direct fetch + readability), extract dossier fields + visual identity with structured output, record sources, never overwrite operator-edited fields.
  - Accept: demo intake for all four brands produces valid dossiers; one live intake of houndapp.xyz recorded.

- [ ] **A08 Research phase**
  - Spiral as the primary Meta/TikTok ad source (brand winners, ad transcripts, creative analysis, EU reach), Apify ads library as fallback; Apify for organic TikTok, Instagram, Reddit, reviews; YouTube Shorts search; Manus deep-research task (structured output, poll, keep `task_url`); optional connectors. Normalize to Evidence; outlier score; longevity tiers; OpenAI transcription of top outlier videos when live; batched deconstruction with Claude.
  - Accept: demo run yields >= 30 evidence from >= 5 sources for Hound and a.clinic; unit tests for outlier score and longevity; Manus provider tested against a recorded fixture.

- [ ] **A08b Reverse-engineering engine (HIGH PRIORITY, the heart of the product, see PRODUCT_SPEC 2.3b)**
  - `reverse_engineer` phase: pick top 3 to 5 winning videos from evidence; download to `data/media/`; `ffmpeg-static` for scene detection (`select='gt(scene,0.3)'`), frame sampling (dense in first 3 s) and audio; OpenAI transcription with timestamps; Claude vision over ordered frames + transcript -> `Blueprint` (structured output). Emit `blueprint` RunEvents.
  - Demo mode: analyze a synthetic test video you generate locally (Remotion or ffmpeg: colored scenes with text cards and a TTS line), never a downloaded third-party video in tests. Real blueprints come from the A14 live pass.
  - Accept: unit test detects the scene cuts of the synthetic video within +/- 0.2 s; a blueprint for it validates against the schema with correct shot count and hook text; `GET /api/runs/[id]/blueprints` returns it.

- [ ] **A09 Consult phase + chat**
  - Gap-driven questions (5 to 9, each with `why` + evidence ids), run waits in `waiting_input`, `POST /api/runs/[id]/answers`, `POST /api/runs/[id]/chat` SSE (tokens + new question cards), answers written into the dossier with provenance.
  - Accept: demo run pauses at consult and resumes after answers (test); chat streams tokens (curl -N).

- [ ] **A10 Direction phase**
  - Score all candidate channels on the six axes with explicit weights; ChannelPlan with rationale, evidence ids, formats, cadence, first steps, KPIs, targets (named subreddits, hashtags); notNow with reasons; versioned PATCH.
  - Accept: a.clinic plan puts `meta_ads` in notNow citing RX4; Evreon ranks LinkedIn first and has no TikTok in its top 3; Hound includes TikTok/Reels and named subreddits.

- [ ] **A11 Production phase + video**
  - Concepts for top channels (3 to 6), shot lists, keyframes (OpenAI image when live; demo: locally generated branded frames via `sharp`/SVG, labelled demo), approve endpoints, render draft/final (fal image-to-video when live; demo: Remotion Ken Burns), OpenAI TTS voiceover, Remotion assembly to MP4, cost estimate before render.
  - Accept: demo render produces a playable 1080x1920 MP4 for one Hound concept (show its metadata); cost estimate returns numbers from the provider price table.

- [ ] **A11b Remake from blueprint + every winning format**
  - Production builds concepts from blueprints: same structure, timing, shot types and hook mechanism, our brand's product/claims/visuals (`assets/brands/`), `shotMap` to the blueprint; then format variants (`variantOf`) for each channel the plan picked (9:16 video, 4:5 static, carousel, text post).
  - Accept: for one Hound blueprint, a 9:16 concept whose shots map 1:1 to blueprint purposes, plus at least one static and one text variant; all pass compliance.

- [ ] **A11c Self-review loop (the agent watches our own video)**
  - After each render: sample frames + transcript of our MP4, Claude vision scores against the blueprint and the rubric in PRODUCT_SPEC 2.3b step 6, `Review` per round; regenerate the weakest shots (keyframe or clip) and re-render, max 2 rounds, within caps; final decision recorded.
  - Accept: demo run produces at least 2 review rounds for one concept with per-shot scores, and the second round's lowest-scoring shot was regenerated (show the review JSON).

- [ ] **A12 Compliance**
  - Rule packs from `docs/BRANDS.md` into `src/engine/rules/`, checker with structured output, auto-revise up to 2 times, blocks render/export on fail.
  - Accept: tests: an a.clinic caption naming "Ozempic" fails RX1; a Hound script promising "cure separation anxiety in 7 days" fails P1; clean versions pass.

- [ ] **A13 Packs, metrics, results, learnings**
  - PublishPack per concept/platform, zip download (mp4 + caption.txt + hashtags + checklist.md + cover.jpg), mark posted, manual metrics, `GET /api/brands/[id]/results`, learnings after metrics.
  - Accept: download a zip and list its contents; results return snapshots ordered by time.

- [ ] **A14 Live smoke tests + real dataset**
  - `pnpm smoke <provider> --live` for anthropic, openai, firecrawl, youtube, apify, manus, fal, spiral, higgsfield, each within cap, recorded. Then one live research pass for Hound and a.clinic with small limits, INCLUDING reverse-engineering 3 real winning videos per brand into blueprints (Spiral/Apify media; media stays in `data/`, only blueprint JSON is committed), recorded as their default dataset (`demo: false`, `capturedAt`). Update `docs/APIS.md` with every verified detail.
  - Accept: `/api/spend` totals under caps; recorded fixtures exist; STATUS_A lists spend per provider.

- [ ] **A15 Engine e2e**
  - `pnpm test:engine-e2e`: full run through every phase for all four brands in demo mode, asserting schemas, phase order, compliance outcomes, at least one blueprint per brand, a remake concept with a shotMap, at least one Review, and that an MP4 exists for at least one Hound concept.
  - Accept: command exits 0 (output shown).

- [ ] **A16 Morning report**
  - `coord/MORNING_A.md` + README "Run it": exact commands from a fresh clone (`pnpm i`, `cp .env.example .env`, `pnpm db:migrate`, `pnpm seed`, `pnpm dev`), live vs demo, spend, known issues, and the 2-minute demo path.

## STRETCH (after CORE, in this order)
- [ ] **AS1** Manus landing page for a chosen concept (Manus builds it; store the link via `website.status`; show it in the pack).
- [ ] **AS2** One real fal draft render (cheapest tier) for one Hound concept within the fal cap; keep the demo render as fallback.
- [ ] **AS3** Harden: retries with backoff on 429/5xx; resume interrupted runs from the DB on server restart.
- [ ] **AS4** Prompt caching check: `cache_read_input_tokens > 0` on repeated phase calls.
- [ ] **AS5** Cross-brand learnings (pattern holds in 2+ brands).
- [ ] **AS6** MCP endpoint at `/api/mcp` with the brand tools.
