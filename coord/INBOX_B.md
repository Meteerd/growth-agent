# INBOX for Lane B (cockpit). Written by Lane A. Append only.

## 2026-10-11T23:12 from Mete (human): real brand assets added
Real logos and brand imagery for all four brands are now in `assets/brands/<aclinic|hound|dynova|evreon>/` with a README (style notes and usage rules). Use them in the cockpit: brand cards, dossier header, portfolio. Serve them via a copy under `public/brands/` (your path) or ask Lane A for an asset route.

## 2026-10-11T23:17:28+0300 from A: A01 landed, app scaffolded, you can start
- Next.js 16.4.0 + React 19.3 at the repo root, App Router, `src/`, Tailwind 4 (via @tailwindcss/turbopack), alias `@/*` -> `src/*`.
- `pnpm check` = `next typegen && tsc --noEmit && biome check . && vitest run` (Biome 2.5, 2-space, double quotes, lineWidth 120; run `pnpm format` to autofix). Vitest picks up `src/**/*.test.ts`.
- I removed `cacheComponents`/`partialPrefetching` from next.config.ts (default dynamic behaviour, fewer surprises with SSE/SQLite routes) and added `serverExternalPackages` for libsql/sharp/remotion. next.config.ts is yours from now on; keep `serverExternalPackages`.
- Note: Next 16 ships breaking changes; docs are in `node_modules/next/dist/docs/` (see AGENTS.md).
- Next from me: `src/contracts` (schemas + fixtures) within the hour; import everything from `@/contracts`.

## 2026-10-11T23:24 from Mete (human): new signature screen: Reverse-engineer view (B12b)
Read docs/PRODUCT_SPEC.md 2.3b and the new task B12b plus signature moment 0 in docs/DESIGN.md. The product's core: the agent watches a winning ad, dissects it shot by shot (Blueprint), remakes it for our brand (aligned via shotMap) and reviews its own render (Review scores). New types arrive in @/contracts with Lane A's A02; until then mirror docs/ARCHITECTURE.md section 5. This screen is the most important demo moment; budget real time for it.

## 2026-10-11T23:28:37+0300 from A: A02 landed, contracts + fixtures on main
Import everything from `@/contracts` (pure TS + Zod 4, safe in client components):
- Schemas + types (same name for both): `Brand`, `BrandSummary` (GET /api/brands item: Brand + `counts` + `lastRun`), `BrandDossier`, `Connection`, `Run`, `RunEvent`, `Evidence`, `Question`, `ChannelPlan`, `ChannelRec`, `Concept`, `Shot`, `Asset`, `ComplianceCheck`, `PublishPack`, `MetricSnapshot`, `Learning`, `SpendEntry`, `ProviderStatus`. Enums as const arrays + labels: `CHANNELS`, `CHANNEL_LABELS`, `PHASES`, `SCORE_AXES`, `SCORE_AXIS_LABELS`, `PROVIDER_IDS`, `PROVIDER_INFO` (label/usedFor/role), `PRODUCT_NAME`.
- Routes: `API.brands()`, `API.brand(idOrSlug)` (brand routes accept the slug too), `API.runEvents(id)`, ... and request/response schemas (`CreateBrandRequest`, `AnswersRequest`, `ResultsResponse`, `SpendResponse`, ...). Errors are `{error:{code,message}}`.
- SSE (`/api/runs/:id/events`): `id` = RunEvent.id, `event` = RunEvent.type, `data` = RunEvent JSON; `: ping` every 15 s; final `event: end` data `{status}`. Additive event type `status` carries `data.status` (running / waiting_input / done ...). Chat SSE: `token` {text}, `question` Question, `done`, `error`.
- Fixtures for your mock: `SEED_BRANDS`, `DEMO_RUNS[slug]` (slugs: hound, aclinic, dynova, evreon) = `{brand, run, connections, evidence, questions, plan, concepts, compliance, packs, assets, events}`. `events` is a complete ordered RunEvent log (~100 to 140 events) you can replay with delays; it pauses logically at the `status: waiting_input` event in consult. Hound and a.clinic: 32 evidence from 9 sources, 6 questions with `why` + `evidenceIds`, plan with `scores`, `weights`, `notNow`, `considered` (every channel scored), 4 concepts (3 with shot lists, 1 text post with `body`), compliance checks incl. one fail-then-revised example (`attempt` 0 fail, 1 pass), 4 packs.
- All demo rows have `demo: true` (show the "Demo data" badge). Seed brands themselves are real (`demo: false`).
- Logos/reference images: `brand.dossier.visual.logoUrl` / `referenceImages` point at `/api/assets/brands/<slug>/<file>`; I serve `assets/brands/` from that route in A03. Until then, your own copy under `public/brands/` works.
- Full list of additive fields beyond ARCHITECTURE §5 is in `coord/CONTRACT_CHANGES.md`. Need a change? Write it here in INBOX_A; contract requests are my top priority at each task boundary.
Next from me: A03 SQLite + `/api/brands` (real routes), then A05 SSE run stream in demo mode.

## 2026-10-11T23:31:38+0300 from A: contracts v1.1.0: blueprints + reviews (Mete's reverse-engineering spec)
- New in `@/contracts`: `Blueprint`, `BlueprintShot`, `Review`, enums `ASPECTS`, `SHOT_TYPES`, `SHOT_PURPOSES`, `BLUEPRINT_STRUCTURES`. PHASES is now intake, research, **reverse_engineer**, consult, direction, production, **review**, compliance, pack, measure. New event types `blueprint` and `review` (refId = blueprint / review id).
- Concept: `blueprintId`, `shotMap` ({shotIdx, blueprintShotIdx}[]), `variantOf` (concept id), `aspect`. Routes: `API.runBlueprints(runId)`, `API.blueprint(id)` (returns Blueprint + its `evidence`), `API.conceptReviews(conceptId)`.
- Fixtures: `DEMO_RUNS[slug].blueprints` (one per brand, shot-by-shot, `whyItWins`) and `.reviews` (two rounds on the remake concept: round 1 `regenerate` with `regeneratedShots`, round 2 `accept`). The remake concept is `concept_<slug>_1` (Evreon: `concept_evreon_2`); its shots map 1:1 to the blueprint shots, so the side-by-side timeline is `blueprint.shots[i]` next to `concept.shots[shotMap[i].shotIdx]`. Hound also has `concept_hound_5` (4:5 static) and `concept_hound_6` (X text) with `variantOf: "concept_hound_1"`.
- Review videos point at `/api/assets/demo/<slug>/<conceptId>_r1.mp4` / `_r2.mp4`; those files are produced by my demo renderer (A11), so expect 404 until then. Blueprint `frames` are [] in fixtures (local files only).

## 2026-10-11T23:37:11+0300 from A: A03 landed: real /api/brands + friends
- Live now (same origin): `GET /api/brands` (BrandSummary[]: Hound, a.clinic, Dynova, Evreon in that order, with counts + lastRun), `POST /api/brands` {url,...} -> 201 {brand, run}, `GET /api/brands/:idOrSlug`, `PATCH /api/brands/:id/dossier` (operator edits get locked against crawls, see `dossier.provenance`), `GET/POST /api/brands/:id/connections`, `GET /api/providers`, `GET /api/health`, `GET /api/assets/brands/<slug>/<file>` (brand images, range requests ok).
- The DB auto-migrates and auto-seeds on first API call, so `pnpm dev` on a fresh clone just works (data in `data/nexus.db`, git-ignored). `pnpm db:migrate` and `pnpm seed` exist too. Each brand already has its demo run (`run_<slug>_demo`) in the DB.
- Next: A04 provider ledger + `/api/spend`, then A05 run routes + SSE (`/api/runs/:id/events`), which replays the demo run events.

## 2026-10-11T23:40:45+0300 from A: A05 landed: runs + SSE live
- `GET /api/runs/:id/events` streams RunEvents (format in my 23:29 message). Resume with the `Last-Event-ID` header (EventSource does this automatically) or `?lastEventId=N`. Final frame `event: end` data `{status}`; the server then closes, so close your EventSource on `end` or it will reconnect and get `end` again.
- **Demo playback:** `/api/runs/run_hound_demo/events?pace=250` replays the stored demo run with 250 ms between events (max 5000). Good for the run cockpit without spending anything.
- Also live: `POST /api/brands/:id/runs` {kind} -> 201 Run, `GET /api/brands/:id/runs`, `GET /api/runs/:id`, `POST /api/runs/:id/cancel`, `GET /api/runs/:id/{evidence,questions,plan,concepts,packs,blueprints}`, `GET /api/blueprints/:id` (+evidence), `GET /api/concepts/:id/{assets,reviews}`. Seeded demo run ids: `run_hound_demo`, `run_aclinic_demo`, `run_dynova_demo`, `run_evreon_demo`.
- New runs started now finish immediately (pipeline not wired yet); the real phases land over the next tasks.

## 2026-10-11T23:52 from Mete (human): run until 07:00, never finish early
Read coord/IMPROVE_LOOP.md now and follow it whenever CORE and STRETCH are done or blocked. You never idle, never wait for the clock, never answer the goal check without doing work. Test, find the weakest thing, fix it, add a test, sync, repeat, until `date` shows 07:00. Cover the edge cases listed for your lane.

## 2026-10-11T23:57:19+0300 from A: blueprints have real frames now
- Live blueprints carry `frames: [{t, url}]` with url `/api/assets/frames/<key>/<t>.jpg` (served by my assets route; files exist only on the machine that analyzed the video, so keep the styled placeholder for 404s as planned). Demo fixtures still have `frames: []`.
- A real example to design against: `src/contracts/fixtures/live/anthropic/blueprint_synthetic.json` (Claude vision on a locally generated test video: 5 shots, hook ends 2.53 s, per-shot purpose/onScreenText/voiceover).
- New run phases now actually run in order: intake -> research -> reverse_engineer, then the rest passes through until I land consult (next).
