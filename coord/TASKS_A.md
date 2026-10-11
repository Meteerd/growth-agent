# Lane A tasks (engine, inside the one Next.js app)

Format: `- [ ] Axx title` then acceptance checks. When done: `- [x] Axx title (commit <hash>)`. Work top to bottom unless blocked; note reorders in STATUS_A.

## PRIORITY NOW (from Mete, 12 Oct 01:25): remakes must look like real winning ads
- [x] **A17 Realistic remakes (not panned illustrations)** (commit e7ce7d0; Hound concept_1d68be0a_1 83/100 shots 85,86,81,84,85,80; a.clinic concept_1e6575ad_1 82/100 shots 80,83,82,85,80,80; contact sheets docs/renders/*-flagship.jpg; Sora not available on our key, fal Kling 2.1 used; fal $7.25 of $8)
  - Problem: renders are brand illustrations with Ken Burns + captions ("Demo keyframe"/"Demo render"). Winning ads in these niches are mostly real-looking phone footage (UGC, POV, talking head). A cartoon remake of a phone-filmed TikTok misses the point.
  - Keyframes must match the blueprint's visual style: if the original is phone-filmed real footage, generate photoreal, phone-camera-looking frames (natural light, handheld framing, real homes, real dogs/people, no plastic AI look) with the OpenAI image model at high quality; use `assets/brands/` only as references for the product itself (app screens, logo, packaging) and the end card. Illustrated style only when the original winner is animated.
  - Motion: animate final keyframes with fal image-to-video (Kling/Seedance) within the fal cap; check whether OpenAI's video API (Sora) is available on our key and, if so, use it for clips within the OpenAI cap (OpenAI credits are plentiful). Record which worked in docs/APIS.md.
  - Mete, 01:30: "take the images that we have and turn them into actual videos that are actually good, based on the existing ads and competitors". So per shot, in this order: (1) if a real brand image in `assets/brands/<brand>/` fits the shot (product, app, packaging, clinic/doctor illustration, Dynova lab/product photos), animate THAT image with fal image-to-video into a proper moving shot that follows the blueprint's camera move and timing (not a Ken Burns pan); (2) otherwise generate a new frame matched to the winner's style (photoreal for footage, reusing brand images as references), then animate it. The final cut must feel like the competitor's winning ad, made with our brand's real material.
  - Self-review rubric adds: "passes as native, real footage for this platform; no AI tells (warped hands/paws, garbled text, plastic skin, impossible physics)". Regenerate failing shots.
  - Produce one flagship final video each for Hound and a.clinic from their real recorded blueprints, set them as the default renders shown in the cockpit, and commit small preview frames (not the media of third-party ads).
  - Accept: contact sheet (one frame per shot) of both flagship videos saved under `docs/renders/` and described in STATUS_A; review scores >= 80 on every shot; spend within caps.

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

- [x] **A07 Intake phase** (commit 5d937a2)
  - Crawl the site with Firecrawl when live (fallback: direct fetch + readability), extract dossier fields + visual identity with structured output, record sources, never overwrite operator-edited fields.
  - Accept: demo intake for all four brands produces valid dossiers; one live intake of houndapp.xyz recorded.

- [x] **A08 Research phase** (commit 200a8f2)
  - Spiral as the primary Meta/TikTok ad source (brand winners, ad transcripts, creative analysis, EU reach), Apify ads library as fallback; Apify for organic TikTok, Instagram, Reddit, reviews; YouTube Shorts search; Manus deep-research task (structured output, poll, keep `task_url`); optional connectors. Normalize to Evidence; outlier score; longevity tiers; OpenAI transcription of top outlier videos when live; batched deconstruction with Claude.
  - Accept: demo run yields >= 30 evidence from >= 5 sources for Hound and a.clinic; unit tests for outlier score and longevity; Manus provider tested against a recorded fixture.

- [x] **A08b Reverse-engineering engine (commit 1049c67)**
  - `reverse_engineer` phase: pick top 3 to 5 winning videos from evidence; download to `data/media/`; `ffmpeg-static` for scene detection (`select='gt(scene,0.3)'`), frame sampling (dense in first 3 s) and audio; OpenAI transcription with timestamps; Claude vision over ordered frames + transcript -> `Blueprint` (structured output). Emit `blueprint` RunEvents.
  - Demo mode: analyze a synthetic test video you generate locally (Remotion or ffmpeg: colored scenes with text cards and a TTS line), never a downloaded third-party video in tests. Real blueprints come from the A14 live pass.
  - Accept: unit test detects the scene cuts of the synthetic video within +/- 0.2 s; a blueprint for it validates against the schema with correct shot count and hook text; `GET /api/runs/[id]/blueprints` returns it.

- [x] **A09 Consult phase + chat** (commit 60d584e)
  - Gap-driven questions (5 to 9, each with `why` + evidence ids), run waits in `waiting_input`, `POST /api/runs/[id]/answers`, `POST /api/runs/[id]/chat` SSE (tokens + new question cards), answers written into the dossier with provenance.
  - Accept: demo run pauses at consult and resumes after answers (test); chat streams tokens (curl -N).

- [x] **A10 Direction phase** (commit 66c5b5a)
  - Score all candidate channels on the six axes with explicit weights; ChannelPlan with rationale, evidence ids, formats, cadence, first steps, KPIs, targets (named subreddits, hashtags); notNow with reasons; versioned PATCH.
  - Accept: a.clinic plan puts `meta_ads` in notNow citing RX4; Evreon ranks LinkedIn first and has no TikTok in its top 3; Hound includes TikTok/Reels and named subreddits.

- [x] **A11 Production phase + video** (commit 0bb219d)
  - Concepts for top channels (3 to 6), shot lists, keyframes (OpenAI image when live; demo: locally generated branded frames via `sharp`/SVG, labelled demo), approve endpoints, render draft/final (fal image-to-video when live; demo: Remotion Ken Burns), OpenAI TTS voiceover, Remotion assembly to MP4, cost estimate before render.
  - Accept: demo render produces a playable 1080x1920 MP4 for one Hound concept (show its metadata); cost estimate returns numbers from the provider price table.

- [x] **A11b Remake from blueprint + every winning format** (commit 0bb219d)
  - Production builds concepts from blueprints: same structure, timing, shot types and hook mechanism, our brand's product/claims/visuals (`assets/brands/`), `shotMap` to the blueprint; then format variants (`variantOf`) for each channel the plan picked (9:16 video, 4:5 static, carousel, text post).
  - Accept: for one Hound blueprint, a 9:16 concept whose shots map 1:1 to blueprint purposes, plus at least one static and one text variant; all pass compliance.

- [x] **A11c Self-review loop (the agent watches our own video)** (commit 0bb219d)
  - After each render: sample frames + transcript of our MP4, Claude vision scores against the blueprint and the rubric in PRODUCT_SPEC 2.3b step 6, `Review` per round; regenerate the weakest shots (keyframe or clip) and re-render, max 2 rounds, within caps; final decision recorded.
  - Accept: demo run produces at least 2 review rounds for one concept with per-shot scores, and the second round's lowest-scoring shot was regenerated (show the review JSON).

- [x] **A12 Compliance** (commit 0bb219d)
  - Rule packs from `docs/BRANDS.md` into `src/engine/rules/`, checker with structured output, auto-revise up to 2 times, blocks render/export on fail.
  - Accept: tests: an a.clinic caption naming "Ozempic" fails RX1; a Hound script promising "cure separation anxiety in 7 days" fails P1; clean versions pass.

- [x] **A13 Packs, metrics, results, learnings** (commit f82aa47)
  - PublishPack per concept/platform, zip download (mp4 + caption.txt + hashtags + checklist.md + cover.jpg), mark posted, manual metrics, `GET /api/brands/[id]/results`, learnings after metrics.
  - Accept: download a zip and list its contents; results return snapshots ordered by time.

- [x] **A14 Live smoke tests + real dataset** (commit fc358d7; smokes recorded for anthropic, openai, firecrawl, youtube, fal, higgsfield (auth), spiral/apify/manus via the live passes; Hound 73 + a.clinic 82 real evidence items recorded as default datasets; /api/spend $5.62 total, all under caps)
  - `pnpm smoke <provider> --live` for anthropic, openai, firecrawl, youtube, apify, manus, fal, spiral, higgsfield, each within cap, recorded. Then one live research pass for Hound and a.clinic with small limits, INCLUDING reverse-engineering 3 real winning videos per brand into blueprints (Spiral/Apify media; media stays in `data/`, only blueprint JSON is committed), recorded as their default dataset (`demo: false`, `capturedAt`). Update `docs/APIS.md` with every verified detail.
  - Accept: `/api/spend` totals under caps; recorded fixtures exist; STATUS_A lists spend per provider.

- [x] **A15 Engine e2e** (commit 5cb9e8d)
  - `pnpm test:engine-e2e`: full run through every phase for all four brands in demo mode, asserting schemas, phase order, compliance outcomes, at least one blueprint per brand, a remake concept with a shotMap, at least one Review, and that an MP4 exists for at least one Hound concept.
  - Accept: command exits 0 (output shown).

- [ ] **A16 Morning report**
  - `coord/MORNING_A.md` + README "Run it": exact commands from a fresh clone (`pnpm i`, `cp .env.example .env`, `pnpm db:migrate`, `pnpm seed`, `pnpm dev`), live vs demo, spend, known issues, and the 2-minute demo path.

## STRETCH (after CORE, in this order)
- [x] **AS1** Manus landing page for a chosen concept (Manus builds it; store the link via `website.status`; show it in the pack). (pack_0569d023_1 landingUrl https://manus.im/app/495LAe3t6NDkJcXULHZL4T; website.status: unpublished, "Hound: Calm alone time, practiced daily"; commit 705f13c)
- [x] **AS2** One real fal draft render (cheapest tier) for one Hound concept within the fal cap; keep the demo render as fallback. (6 Kling 2.1 standard clips, $1.50; 23 s 1080x1920 non-demo MP4 for concept_0569d023_1 in run_mv4cox1z4e0569d023; commit 8747d6c)
- [x] **AS3** Harden: retries with backoff on 429/5xx; resume interrupted runs from the DB on server restart. (fetchRetry + SDK retries; stale-run resume on first API call; commit 05d4764)
- [x] **AS4** Prompt caching check: `cache_read_input_tokens > 0` on repeated phase calls. (verified live: repeated blueprint calls read 2,321 cached tokens, re-run intake 2,515; commit 05d4764)
- [x] **AS5** Cross-brand learnings (pattern holds in 2+ brands). (commit 05d4764)
- [x] **AS6** MCP endpoint at `/api/mcp` with the brand tools. (commit 1083355)

## IMPROVE (self-generated)
- [x] **I01** outputSchema dropped object properties named like JSON-schema keywords (`format`, `pattern`, `default`), so Claude never saw the deconstruction `format` field and the live pass crashed. Fixed + regression test (commit 7e2b4d5 range, see git log "fix outputSchema").
- [x] **I02** Claude structured output: one validation retry with the errors spelled out, then a clean failure; deconstruction failures are non-fatal (warning).
- [x] **I03** Spiral ad details returned 1 of 10 ads (uuids must be comma-separated); days running now from start/end dates, EU reach kept as a tag (not mislabelled as views).
- [x] **I04** Manus "waiting" on its own sub-agents (`cascadeJobCall`) was read as "needs an answer"; only ask-user waits count now. Test with the recorded event shape.
- [x] **I05** Off-topic live evidence (cats, politics on Reddit; generic Meta ads): per-source Claude relevance filter (keeps when unsure), Reddit scoped to a subreddit.
- [x] **I06** Live passes mixed demo items (bundle website + app-store reviews) into real data; recorded exports keep only real items.
- [x] **I07** Blueprints of single-take ads came out as 1 shot: lower-threshold re-detection, even frame sampling, beat-based splitting in the prompt (1 -> 3 shots on the same ads).
- [x] **I08** Keyframes and fal clips generated one by one (~30 s and ~70 s each live): now 3 in parallel.
- [x] **I09** An unreachable or failing site killed the run at intake: now Firecrawl -> direct fetch (20 s timeout) -> continue with warnings. Test (commit 797b8e9).
- [x] **I10** Unicode brand names (Slovak, Turkish) produce clean slugs. Test (commit 797b8e9).
- [x] **I11** A crashed script left its run "running" and a stale queued run would be auto-resumed (and spend) on the next server start: resume only stale runs, live-pass marks failures, stale runs cancelled.
- [x] **I12** Captions were missing on fal clip shots (they were burned into the still the clip replaces) and drifted with the Ken Burns zoom: compositor now overlays a fixed caption layer. Regression test (commit 8747d6c).
- [x] **I13** A leftover smoke-test run (queued) was resumed by the stale-run hook and started spending: smokes now close their runs, and runs interrupted more than 6 hours ago are failed instead of resumed. Test (commit fc358d7).
- [x] **I14** The live plan cited skipped questions as "because you said ..." (they are assumptions). Digest now marks them NOT ANSWERED with the working assumption, prompts say "assuming ...", and `pnpm eval-run` fails on misattribution.
- [x] **I15** A pack kept pointing at the draft video after a later final render: finished renders now update the concept's ready packs. Test.
- [x] **I16** Live runs skipped the consultation: Claude marked every question optional, so the run never paused, and the old digest passed each question's default answer off as the operator's. Questions are now always required (the operator can skip), unanswered ones are digested as NOT ANSWERED, and `pnpm eval-run` fails a run that never consulted.
- [x] **I17** The dev server's resume hook judged staleness by the last event only; a long Claude call in another process (scripts, a second server) could get the same run driven twice. Runs now keep a file heartbeat while driven, and resume skips runs with a fresh heartbeat. Test.
- [x] **I18** API sweep over the real local data (198 requests across every route for all brands and runs): 0 errors, all under 3 s.
- [x] **I19** Flagship round 1 for Hound scored 64: transparent brand webp art rendered as black bars, and photo/cartoon shots alternated. Frames now flatten onto the brand color, wide art is contained not cropped, the sourcing prompt keeps one look per cut and puts brand art on screens/posters via an image-edit reference.
- [x] **I20** OpenAI image edit rejected the brand reference ("unsupported mimetype application/octet-stream") and crashed the flagship: references are sent as PNG buffers with an explicit type, and a refused edit falls back to plain generation with a warning.
- [x] **I21** Long Slovak captions were truncated after 4 lines (lost words in a.clinic shots): captions now shrink to fit (58 to 36 px) and never cut text; flagship builds tighten on-screen lines to <= 7 words first; the production prompt caps on-screen text at 8 words. Emoji are stripped from burned captions (the font has no emoji glyphs). Tests.
