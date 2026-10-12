# Lane B tasks (cockpit UI, inside the one Next.js app)

Format: `- [ ] Bxx title` then acceptance checks. When done: `- [x] Bxx title (commit <hash>)`. Work top to bottom unless blocked; note reorders in STATUS_B.

## PRIORITY NOW (from Mete, 12 Oct 09:25): the submission package (Lane A stays on the videos)
The submission form (due 15:00) requires: team name; one-line description; a PUBLIC GitHub repo (private is rejected); a live project/demo link; how we used Manus; fal.ai use; Apify use; members (name, email, LinkedIn). Mete is on the pitch; you own this package.
- [ ] **B19a Manus, visibly and for real (event credits, Mete authorizes these calls):** run a Manus deep-research task for Dynova and Evreon (Hound and a.clinic already have one) and a Manus-built landing page for each of the four flagship packs, using the engine's existing Manus provider/scripts (do not edit Lane A's engine files; if a script is missing, ask Lane A in INBOX_A). Show every Manus task and page in the UI (Manus card) and list all links in docs/SUBMISSION.md.
- [ ] **B19b Live demo link:** a showcase build that runs with no backend (mock data mode backed by the real recorded showcase data + the flagship videos under public/), so it can be deployed to Vercel (or Netlify). Prove `pnpm build` passes in that mode; add the config; write the exact deploy commands for a human in docs/SUBMISSION.md (the human logs in and deploys). Keep it fast and free of console errors.
- [ ] **B19c Public repo export:** `scripts/export-public.sh <dir>` creates a clean snapshot (no git history) of the app: source, scripts, e2e, docs/PRODUCT_SPEC.md, docs/ARCHITECTURE.md, docs/DESIGN.md, docs/BRANDS.md, docs/renders, assets/brands, a new public README. Exclude: .env*, data/, logs/, demo/recordings/, node_modules, coord/, docs/archive, docs/event, docs/research, docs/VISION_VERBATIM.md, docs/DECISIONS.md, AGENTS.md, CLAUDE.md, any downloaded third-party media. Run a secret scan on the export (key patterns) and fail on any hit. The public README explains truthfully what the product does, how to run it, and exactly where Claude, Manus, fal, Apify, ElevenLabs, Gemini, Spiral and Firecrawl are used at runtime. Run the export at 13:40 after the freeze; a human creates the public repo and pushes it.
- [ ] **B19d docs/SUBMISSION.md:** draft answers for every form field, truthful, with real numbers and links (Manus task links, deploy link placeholder, repo link placeholder, the backup video). Manus answer = what Manus really does in the product. fal answer = Kling image-to-video for the remake shots. Apify answer = Meta Ad Library, TikTok, Instagram, Reddit, reviews scrapers (real counts per brand from the database).

## DONE PRIORITY (from Mete, 12 Oct 01:25): redesign, before anything else
- [x] **B18 Redesign to v2 "the cutting room"** (commit fa1277c) (docs/DESIGN.md top section; the v1 dark/glow/lime/serif/shader look is rejected as "too AI-ish")
  - New tokens (paper, ink, record red, flat beat colors), Inter Tight only + mono for numbers; delete the shader, glow, glass, grain, lime, Instrument Serif and orbit visuals from every screen and from `/lab`.
  - Rebuild the reverse-engineer view as an edit timeline (two synced viewers, V1/V2/T1/beat lanes, red playhead) and Direction as a ranked editorial table; landing with the real example strip.
  - Use real media wherever it exists (recorded live Hound/a.clinic runs, `assets/brands/`, renders); demo media must be visibly labelled.
  - Accept: all e2e green; new screenshots of every route (desktop + mobile) committed; a written self-audit in STATUS_B confirming zero banned elements per route.

## CORE

- [x] **B01 Wait for scaffold, then UI foundations** (commit fa070a7)
  - Sync every 3 to 5 min until Lane A's A01 (Next.js app at the repo root) is on main; meanwhile update `docs/DESIGN.md` with your motion plan per screen. Then: fonts via `next/font` (Instrument Serif, Inter Tight or Geist, JetBrains Mono or Geist Mono), root layout, Playwright installed and configured (`e2e/`, `playwright.config.ts`, script `e2e` in package.json, additive).
  - Accept: `pnpm build` succeeds; `pnpm e2e` runs one smoke test that loads `/` (output shown).

- [x] **B02 Design tokens + base layer** (commit 0e1fd56)
  - Tokens from `docs/DESIGN.md` as CSS variables + Tailwind theme; grain overlay; hairline grid; glass panel; custom scrollbars, selection, focus rings; Lenis smooth scroll; reduced-motion handling.
  - Accept: `/lab` page renders tokens (colors, type scale, spacing) and the base layers; screenshot committed.

- [x] **B03 Field shader** (commit 3b1666f)
  - R3F + custom GLSL domain-warped flow field; props: `activity` (0..1, animates intensity/speed), `accent`; cursor-reactive; DPR cap 1.5; pause on hidden; static gradient fallback.
  - Accept: `/lab` shows the shader with an activity slider; Playwright perf check: no long tasks > 200 ms after load on the landing page (or document measured numbers).

- [x] **B04 Component kit** (commit bbcbb80)
  - Glass Panel, Button (primary/ghost/quiet, magnetic primary), URL Input, Answer Chip (single/multi), Badge (status/demo/compliance), Tabs, Tooltip, Dialog, Sheet, Skeleton (glass shimmer), NumberTicker, MonoLabel, PhaseRail, EvidenceCard, CostMeter, StatusDot, ProviderTile, PhoneFrame player, Toasts. All on Radix primitives, fully restyled.
  - Accept: every component in `/lab` with states (default/hover/focus/disabled/loading); Vitest render tests for logic-bearing components.

- [x] **B05 Data client + mock mode** (commit e0a53be)
  - Typed client for `/api/...`, SSE wrapper, in-browser mock with scripted full run (~60 s), consult pause/resume, packs and results data. Switch via `NEXT_PUBLIC_DATA_MODE` (`mock` | `live`).
  - Accept: Vitest tests for the SSE wrapper (reconnect + Last-Event-ID) and mock run script; a dev page logs the full mock event stream.

- [x] **B06 Landing `/`** (commit e2e2310)
  - Hero with field shader + Instrument Serif headline + URL input; on submit, the vortex transition into `/brands/new` (or the run); short product story sections (the loop, the four brands, the honesty rules: no fake numbers, nothing posts without you); footer.
  - Accept: screenshots desktop + mobile; Lighthouse perf >= 80 on production build (report the score).

- [x] **B07 Portfolio `/brands` + Enter `/brands/new`** (commit 0316da3)
  - Living brand cards (vertical, countries, connections live/demo, last run, packs ready/posted, total views with ticker). New brand: URL in, live intake events, lands on brand home.
  - Accept: e2e: create a brand in mock mode and see it in the portfolio.

- [x] **B08 Brand home + Connect** (commit ceb08ab)
  - Dossier view with inline editing (PATCH), sources list, runs list, start run. Connect page: provider tiles with Live/Demo/Missing, per-brand config fields (non-secret ids only), honest copy about what each connection adds.
  - Accept: e2e: edit a dossier field and see it persist (mock); connect page shows all providers.

- [x] **B09 Run cockpit `/runs/[id]`** (commit 6fb47b9)
  - Phase rail with moving light, live event stream (typed-in tool calls, costs, warnings), evidence wall (cards by source, thumbnails, metrics, outlier/longevity badges, deconstruction on hover/expand), shader activity tied to run state.
  - Accept: e2e: mock run streams to completion with all phases lit; screenshot mid-run and finished.

- [x] **B10 Consultation `/runs/[id]/consult`** (commit 68a8da8)
  - One question at a time, large serif prompt, mono "why I'm asking", evidence chips, answer chips / text / scale / confirm, skip with assumption, progress constellation, free-text chat drawer streaming from `/runs/:id/chat`.
  - Accept: e2e: answer all questions in mock mode and the run resumes.

- [x] **B11 Direction `/runs/[id]/direction`** (commit 59e9cce)
  - Orbit map (brand center, channels at distance by score, size by priority, six-axis breakdown on hover, evidence drawer), ranked list view toggle, notNow ring with reasons, reorder/drop -> PATCH plan.
  - Accept: e2e: switch views, open a channel's evidence, drop a channel; screenshot.

- [x] **B12 Studio `/runs/[id]/studio`** (commit b515787)
  - Concept cards (hook, angle, channel, compliance badge, estimated cost), storyboard strip (9:16 keyframes per shot), approve/regenerate per shot, render draft/final with cost meter, PhoneFrame player for the MP4, compliance findings panel.
  - Accept: e2e: approve shots and trigger a render in mock mode; player shows the video (mock serves a sample MP4 or Lane A's demo render).

- [x] **B12b Reverse-engineer view (THE demo moment, see PRODUCT_SPEC 2.3b)** (commit 3240073)
  - `/runs/[id]/blueprints/[blueprintId]` (and reachable from the evidence wall and the studio): the original winning ad as a horizontal timeline of shots (frame thumbnails, time ranges, purpose color-coded: hook, problem, agitate, solution, demo, proof, offer, CTA), the hook zoomed in (first 3 s with what is seen/said/written and "why it stops the scroll"), transcript under the timeline, "why it wins" with its longevity/outlier numbers; below it, OUR remake aligned shot-for-shot via `shotMap` (our keyframes/clips), with the self-review score per shot and the round history; the format variants (static, carousel, text) as cards.
  - Handle missing frames gracefully (frames of third-party ads exist only on the machine that analyzed them): show a styled placeholder with the shot description.
  - Accept: e2e in mock mode opens a blueprint, scrubs the timeline, and shows the aligned remake with scores; screenshots desktop + mobile.

- [x] **B13 Packs `/runs/[id]/packs`** (commit c92a75c)
  - Ready-to-post cards per platform (cover, caption, hashtags, post time, checklist), download zip, copy caption, mark posted (URL), metrics entry form.
  - Accept: e2e: mark a pack posted and enter metrics.

- [x] **B14 Results `/brands/[slug]/results`** (commit 1819f15)
  - Posted packs with "posted X h ago" and live tickers, small-multiples chart per post (views over time), learnings list, honest empty state "Waiting for first metrics".
  - Accept: e2e: after metrics entry the chart and counters update.

- [x] **B15 Settings `/settings`** (commit c5c11d8)
  - Provider status (live/demo/key present/verified), budgets vs spent bars, spend ledger table, `PROVIDER_MODE` shown read-only.
  - Accept: screenshot.

- [x] **B16 E2E + screenshots** (commit b57e1fb)
  - Playwright full journey in mock mode; second project against the real API routes when they respond (`E2E_DATA=live`); screenshots of every route at 1440x900 and 390x844 into `e2e/screens/`.
  - Accept: `pnpm e2e` exits 0 (output shown); screenshots committed.

- [x] **B17 Polish + morning report** (commit fb19677)
  - Pass every screen against the quality bar in `docs/DESIGN.md`; fix spacing, motion timing, empty/loading states, mobile. Write `coord/MORNING_B.md`: how to run, what works (link screenshots), mock vs live status, known issues, and the 2-minute demo click path.

## STRETCH (after CORE, in this order)
- [x] **BS1** Presentation mode (commit 851c0e9) (`?present=1`): hides dev UI, enlarges type, replays a recorded live run at chosen speed for the pitch.
- [x] **BS2** Command palette (commit 39619ca) (Cmd+K): jump to brand/run/screen.
- [ ] **BS3** Page transitions (skipped on purpose: DESIGN v2 allows functional motion only and drops the vortex; see DECISIONS 12 Oct 02:15) (shared-element between portfolio card and brand home; vortex on run start).
- [x] **BS4** Live parity (commit 4440fc1): run the full journey against the real API routes and fix every mismatch (send contract requests to Lane A).
- [x] **BS5** Manus task card (commit 0acf539): when evidence has `source: manus_research`, show a card linking to the Manus task with its status.

## IMPROVE (self-generated)
- [x] **I01** (commit f426e42) Research-only runs (recorded live research) end with "0 packs ready to post". Accept: a done run without packs says research is complete with evidence and blueprint counts, and offers "Start a run on this research" (live: reuseResearchFrom = this run).
- [x] **I02** (commit f426e42) Blueprint cards show empty quotes when the hook has no spoken or written text. Accept: fall back to on-screen text, then the visual; never render an empty quote.
- [x] **I03** (commit f426e42) Run header spend sums event costs only ($0.40 shown, ledger says $1.02). Accept: header shows the larger of the event sum and run.costUsd.
- [x] **I04** (commit f426e42) Remake row for a blueprint with no remake shows faint "no shot" boxes. Accept: one designed band explains the remake appears after production.
- [x] **I05** (commit 0d4e1d4) Connect page shows engines and tools (Claude, OpenAI, Manus...) as "Missing, not connected for this brand" when the brand has no connection row; they are global. Accept: engine/tool tiles take their status from /api/providers (live/demo, key present), only connectors can be Missing; e2e asserts Claude is not Missing.
- [x] **I06** (commit 0d4e1d4) No designed 404 page or error boundary (Next defaults would show). Accept: `src/app/not-found.tsx` and `src/app/error.tsx` in the observatory style with a way back; e2e visits an unknown route.
- [x] **I07** Packs screen nested a second Page inside the run frame (double gutters, duplicate demo badge and cockpit button). Accept: one frame, header tightened; packs.spec passes. (commit 0d4e1d4)
- [x] **I08** (commit 4440fc1) Live run on recorded research: 3 blueprints, only one remade, and the cockpit listed a non-remade one first, so "open the side by side" led to an empty remake lane. Accept: remade blueprints first with a "Remade" marker and the concept title; live journey opens the remade one.
- [x] **I09** (commit 2db6a54) A Unicode domain (Turkish güzellik, Slovak ľ) became a punycode brand ("Xn--...") because the URL API returns ASCII hosts. Accept: normalizeUrl keeps the Unicode host, hosts display as typed, slugs fold diacritics (ı, ş, ğ, č, ľ...), unit tests + strings.spec at 390 px.
- [x] **I10** Reviews with repeated round numbers (regenerate passes) gave duplicate React keys (578 console errors on the live flagship blueprint). Accept: reviews keyed and selected by id, repeated rounds labelled "round 1 (2)"; live quality.spec clean.
- [x] **I11** The engine writes "not visible in analysis" into shot fields; the UI printed it as a caption. Accept: treated as missing everywhere in the reverse-engineer view.
- [x] **I12** The global overflow-wrap broke absolutely positioned ruler labels ("0" instead of "00:05.0"). Accept: labels are nowrap; visible in live-bp screenshot.
- [x] **I13** (commit 18645de) Flagship renders (A17) as hero media: landing shows the real winner next to our remake playing, portfolio cards play the flagship, brand home shows it; the original viewer falls back to the winner's real cover when analysis frames are not on this machine.
- [x] **I14** On machines without the remake's stored keyframes, the V2 lane showed brand art even when the real render exists. Accept: V2 thumbnails are taken from our own render (same-origin video, drawn offscreen) at each remade shot's midpoint; camera "not visible" hidden; hook never double-quoted.
- [x] **I15** (commit b9ed616) Studio storyboard showed cartoon brand art labelled "new frame" for photoreal flagship shots (keyframes not on this machine). Accept: storyboard frames come from the real render when stored keyframes are missing (never the mock placeholder), burned captions are not doubled, hooks never double-quoted, the winner link is not red.
- [x] **I16** (commit 60f531e) Record red used outside its job (phase labels and review lines in the stream, the Manus tile and link, not-found links, cost estimate stripes, approved state). Accept: red only on the primary action, the playhead and the recording dot; hooks unquoted in the cockpit.
- [x] **I17** (commit e337f0e) Dynova showcase run on live showed "92.71000000000001s", a 20-line engine prompt in Our shot, and the original's caption over its shot description when the frame is missing. Accept: durations rounded to tenths everywhere, long prompts clamped with a toggle, no overlap in either viewer at 1440 and 390.
- [x] **I18** (commit ddce973) The landing showed one brand's remake while three brands have flagship cuts. Accept: a "Same engine" section with the committed contact sheets for Hound, a.clinic and Dynova, real self-review scores from the showcase fixtures, rows open the side by side in live mode, loads in mock mode on a fresh clone (smoke.spec), fits 390 px.
