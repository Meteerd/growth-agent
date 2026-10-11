# Lane B tasks (cockpit UI, inside the one Next.js app)

Format: `- [ ] Bxx title` then acceptance checks. When done: `- [x] Bxx title (commit <hash>)`. Work top to bottom unless blocked; note reorders in STATUS_B.

## PRIORITY NOW (from Mete, 12 Oct 01:25): redesign, before anything else
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
- [ ] **BS4** Live parity: run the full journey against the real API routes and fix every mismatch (send contract requests to Lane A).
- [x] **BS5** Manus task card (commit 0acf539): when evidence has `source: manus_research`, show a card linking to the Manus task with its status.

## IMPROVE (self-generated)
- [x] **I01** (commit f426e42) Research-only runs (recorded live research) end with "0 packs ready to post". Accept: a done run without packs says research is complete with evidence and blueprint counts, and offers "Start a run on this research" (live: reuseResearchFrom = this run).
- [x] **I02** (commit f426e42) Blueprint cards show empty quotes when the hook has no spoken or written text. Accept: fall back to on-screen text, then the visual; never render an empty quote.
- [x] **I03** (commit f426e42) Run header spend sums event costs only ($0.40 shown, ledger says $1.02). Accept: header shows the larger of the event sum and run.costUsd.
- [x] **I04** (commit f426e42) Remake row for a blueprint with no remake shows faint "no shot" boxes. Accept: one designed band explains the remake appears after production.
- [x] **I05** (commit 0d4e1d4) Connect page shows engines and tools (Claude, OpenAI, Manus...) as "Missing, not connected for this brand" when the brand has no connection row; they are global. Accept: engine/tool tiles take their status from /api/providers (live/demo, key present), only connectors can be Missing; e2e asserts Claude is not Missing.
- [x] **I06** (commit 0d4e1d4) No designed 404 page or error boundary (Next defaults would show). Accept: `src/app/not-found.tsx` and `src/app/error.tsx` in the observatory style with a way back; e2e visits an unknown route.
- [x] **I07** Packs screen nested a second Page inside the run frame (double gutters, duplicate demo badge and cockpit button). Accept: one frame, header tightened; packs.spec passes. (commit 0d4e1d4)
- [ ] **I08** Live run on recorded research: 3 blueprints, only one remade, and the cockpit listed a non-remade one first, so "open the side by side" led to an empty remake lane. Accept: remade blueprints first with a "Remade" marker and the concept title; live journey opens the remade one.
