# Lane B tasks (cockpit UI, inside the one Next.js app)

Format: `- [ ] Bxx title` then acceptance checks. When done: `- [x] Bxx title (commit <hash>)`. Work top to bottom unless blocked; note reorders in STATUS_B.

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

- [ ] **B11 Direction `/runs/[id]/direction`**
  - Orbit map (brand center, channels at distance by score, size by priority, six-axis breakdown on hover, evidence drawer), ranked list view toggle, notNow ring with reasons, reorder/drop -> PATCH plan.
  - Accept: e2e: switch views, open a channel's evidence, drop a channel; screenshot.

- [ ] **B12 Studio `/runs/[id]/studio`**
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

- [ ] **B16 E2E + screenshots**
  - Playwright full journey in mock mode; second project against the real API routes when they respond (`E2E_DATA=live`); screenshots of every route at 1440x900 and 390x844 into `e2e/screens/`.
  - Accept: `pnpm e2e` exits 0 (output shown); screenshots committed.

- [ ] **B17 Polish + morning report**
  - Pass every screen against the quality bar in `docs/DESIGN.md`; fix spacing, motion timing, empty/loading states, mobile. Write `coord/MORNING_B.md`: how to run, what works (link screenshots), mock vs live status, known issues, and the 2-minute demo click path.

## STRETCH (after CORE, in this order)
- [ ] **BS1** Presentation mode (`?present=1`): hides dev UI, enlarges type, replays a recorded live run at chosen speed for the pitch.
- [ ] **BS2** Command palette (Cmd+K): jump to brand/run/screen.
- [ ] **BS3** Page transitions (shared-element between portfolio card and brand home; vortex on run start).
- [ ] **BS4** Live parity: run the full journey against the real API routes and fix every mismatch (send contract requests to Lane A).
- [ ] **BS5** Manus task card: when evidence has `source: manus_research`, show a card linking to the Manus task with its status.
