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

## 2026-10-12T00:00:10+0300 from A: A09 landed: consultation is live
- A new full run now pauses: run.status `waiting_input`, phase `consult`, `question` events stream (refId = question id); `GET /api/runs/:id/questions` lists them (kind, options, scale, defaultAnswer, why, evidenceIds, assumption).
- `POST /api/runs/:id/answers` {answers:[{questionId, value} | {questionId, skip:true}]} returns Question[]; you can send one at a time (one-question-at-a-time UI). When every required one is answered or skipped the run resumes by itself (status events running ... done). Answering a finished run returns 409 `run_finished`.
- `POST /api/runs/:id/chat` {message} -> SSE `token` {text} chunks, optional `question` (a new Question card), then `done` {messageId}. Live Claude, grounded in evidence ids (the text may cite ids like ev_hound_05: you can linkify them).

## 2026-10-12T00:18:05+0300 from A: the whole pipeline runs now (production, review, compliance, packs)
- A new full run goes intake -> research -> reverse_engineer -> consult (pause) -> direction -> production -> review -> compliance -> pack -> done. In demo mode it takes about 8 s after the answers.
- Studio: `GET /api/runs/:id/concepts` (remake concept has `blueprintId` + `shotMap`; variants have `variantOf`; `shots[i].keyframeAssetId`), `GET /api/concepts/:id/assets` (keyframe assets carry `shotIdx` and `url`; the video asset is `kind: "video"`, also on `concept.videoAssetId`), `POST /api/concepts/:id/keyframes` {shotIdx?}, `POST /api/concepts/:id/approve` {shotIdx: number[]}, `POST /api/concepts/:id/render` {tier} -> **202** {concept, estimatedCostUsd, lines[{provider,item,usd}]} (progress via run events `asset`/`error`; 409 if compliance failed or already rendering).
- `GET /api/concepts/:id/reviews` -> two rounds for the remake (per-shot scores, decision, regeneratedShots, assetId of the video that round watched). Demo reviews have `demo: true` and say so in `notes`.
- Videos/keyframes are served from `/api/assets/runs/<runId>/<conceptId>/...` (range requests work for <video>). Demo renders carry a "Demo render" badge burned in the corner.
- Packs: `GET /api/runs/:id/packs` (videoAssetId set when the concept was rendered; checklist; postAt suggestion). Zip download + mark posted + metrics land next (A13).

## 2026-10-12T00:21:28+0300 from A: A13 landed: packs export, posted, metrics, results
- `GET /api/packs/:id/download` -> zip (`video.mp4` when rendered, `images/NN.png` keyframes, `caption.txt`, `hashtags.txt`, `first-comment.txt`, `checklist.md`, `cover.jpg`). Header `X-Pack-Files` lists the files. 409 if the concept failed compliance.
- `POST /api/packs/:id/posted` {postedUrl, postedAt?} -> PublishPack (status posted). `POST /api/packs/:id/metrics` {views?, likes?, comments?, shares?, saves?, follows?, capturedAt?} -> 201 MetricSnapshot (400 if empty).
- `GET /api/brands/:id/results` -> {packs: PublishPack & {snapshots (oldest first)}, learnings}. Learnings appear only after 2+ posted packs have views (never invented); until then show "waiting for first metrics".

## 2026-10-12T00:33:28+0300 from A: real data + demo flow for the judge
- Real recorded research is coming for Hound (running now) and a.clinic: each appears as its own run with `dataset: "live_recorded"`, `demo: false`, `capturedAt` (show "Live data, captured <time>" instead of the Demo badge). It is the brand's latest run.
- **Demo flow I suggest:** start a new run on top of the recorded research so the judge sees real evidence and a live consultation: `POST /api/brands/hound/runs {"kind":"full","reuseResearchFrom":"recorded"}` -> 201 Run. It copies the evidence + blueprints, replays the intake/research/reverse_engineer events (stream them with `?pace=150` for the "gathering" moment), then pauses at consult with live Claude questions. 404 `no_research` if the brand has no recorded run (then use `"run_<slug>_demo"`).
- `POST /api/packs/:id/landing` -> 202 PublishPack with `landingUrl` (a Manus task link where Manus builds a matching landing page; we never publish it). 409 `manus_demo` when Manus is not live: hide or disable the button then.

## 2026-10-12T01:16 from Mete (human): PRIORITY: the design is rejected, redesign now (B18)
Mete looked at the screenshots: "I hate it. It looks too AI-ish." Dark glow + lime + serif italics + contour shader + glass is the generic AI-startup look. Read the new top section of docs/DESIGN.md ("the cutting room": paper, ink, one record-red accent, Inter Tight, real media first, edit-timeline reverse-engineer view, editorial Direction table). Do B18 before any other task, keep e2e green, re-screenshot everything. Lane A is also making the remake videos photoreal (A17); show the real renders as the hero media once they land.
## 2026-10-12T01:16:56+0300 from A: re your two requests (demo MP4s, test timeouts): both done
- Demo media: after the auto-seed (first API call) the engine now builds, in the background and at zero cost, the seeded remake concepts' keyframes (`concept_<slug>_1` shots get `keyframeAssetId`) and the review videos the fixtures point at (`/api/assets/demo/<slug>/concept_<slug>_1_r1.mp4` and `_r2.mp4`, Evreon `concept_evreon_2`). Takes ~10 to 20 s after first boot; `pnpm seed` builds them synchronously. Until then the 404 placeholder is still right.
- Tests: vitest `testTimeout` is now 120 s and `hookTimeout` 180 s for the full-pipeline tests (vitest.config.ts).
- Also: a finished render now updates its concept's ready packs (videoAssetId), so packs always carry the newest video.

## 2026-10-12T01:33:19+0300 from A: A17 flagship remakes are rendering now (hero media)
- `GET /api/brands` items get `heroVideo` {url, posterUrl, conceptId, runId, title} once a brand has a flagship render: real fal motion, made from the brand's own images where they fit (photoreal frames otherwise), reviewed shot by shot. Use it as the hero video on the portfolio card and brand home (poster first, then play). Hound lands in a few minutes, a.clinic after it; I will confirm here.
- Shots may now carry `source` ("brand_image"/"generated"), `imageRef` (file under /api/assets/brands/<slug>/), `style`, `motion` (the camera move). The studio can label a shot "your image, animated" vs "new frame".
- Flagship asset ids have `model` ending in `-flagship`; they are also `concept.videoAssetId`, so packs and the studio player pick them up automatically.

## 2026-10-12T02:19:25+0300 from A: Hound flagship landed (hero media)
- `GET /api/brands` -> hound.heroVideo = the flagship: 29 s, photoreal phone footage remaking a real TikTok winner shot for shot, the CTA shot shows Hound's real beagle art on a phone; review 83/100 with every shot >= 80. Poster at `heroVideo.posterUrl`.
- On my machine it is `/api/assets/runs/run_mv4e0ud7671d68be0a/concept_1d68be0a_1/flagship_r4_best_*.mp4`. On any other machine `pnpm seed` (or the first API call) imports the showcase run `run_mv4e0ud7671d68be0a` from `src/contracts/fixtures/live/showcase/hound.json` and serves the 720p copy at `/api/assets/showcase/hound-flagship.mp4` (the hero url there points at it).
- Contact sheet for your design work: `docs/renders/hound-flagship.jpg`. a.clinic flagship is rendering now.

## 2026-10-12T02:33:13+0300 from A: a.clinic flagship landed too (A17 done)
- aclinic.heroVideo = photoreal Slovak footage (laptop/phone/pharmacy), a.clinic's real doctor art on the screens, Slovak captions, 82/100 with every shot >= 80. Showcase run `run_mv4e8sfdbc1e6575ad`, concept `concept_1e6575ad_1`; 720p copy at `/api/assets/showcase/aclinic-flagship.mp4` on other machines. Contact sheet `docs/renders/aclinic-flagship.jpg`.
- Reviews for both flagships: `GET /api/concepts/<id>/reviews` (several rounds incl. "recompose"; the last one is the cut that ships).

## 2026-10-12T02:47:34+0300 from A: re "concepts lose blueprintId on runs that reuse research": fixed
- Production now links the remake to one of the run's own blueprints when the drafted id is unknown there (same shot count preferred; otherwise a proportional `shotMap`, every `blueprintShotIdx` valid for that blueprint). Your repro (reuseResearchFrom "recorded", demo providers, skip/answer, done) is now a test: the remake has `blueprintId` + `shotMap`.

## 2026-10-12T03:03:47+0300 from A: all four brands now have real recorded research
- Dynova (`run_mv4h0j4j04f07e6df3`, 67 real items, 3 blueprints) and Evreon (`run_mv4hced3d147369b5a`, 87 real items, 3 blueprints) joined Hound and a.clinic: each brand's latest `live_recorded` run is real data (Spiral, Apify TikTok/Instagram/Reddit/Meta Ad Library, YouTube, site). `reuseResearchFrom: "recorded"` works for all four. Full live runs on them are running now; I'll post their ids.
- FYI the seeded runs list per brand is now: demo run, recorded research run, (Hound/a.clinic) showcase full run. Sort by createdAt desc for "latest".

## 2026-10-12T03:20:11+0300 from A: Dynova and Evreon full live runs
- Dynova `run_mv4hicmqcb91d09027` (Turkish concepts, TikTok > Shorts > Reels > SEO) and Evreon `run_mv4htba4f3f352d515` (LinkedIn > communities > email; founder posts, demo clip). Both also ship as showcase runs (seeded on any machine). No flagship videos for these two (fal budget is nearly used).

## 2026-10-12T04:10+03:00 from A: Dynova has a flagship video now
- Dynova `concept_91d09027_1` (run `run_mv4hicmqcb91d09027`): 81/100, every shot >= 80, Turkish explainer remake, clips by Higgsfield (fal balance is out). `heroVideo` on `GET /api/brands` is set for Dynova on any machine after `pnpm seed` (showcase export with `docs/renders/dynova-flagship.mp4`). So three brands have hero media: Hound, a.clinic, Dynova. Evreon has none (B2B, LinkedIn-first; its concepts are founder posts and a demo clip).
- FYI a.clinic concept `concept_1e6575ad_4` shot 3 caption is shorter now ("Dotazník → video s lekárom → lekár rozhodne → kontroly").
