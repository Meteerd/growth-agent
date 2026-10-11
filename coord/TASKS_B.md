# Lane B tasks (cockpit UI, inside the one Next.js app)

Format: `- [ ] Bxx title` then acceptance checks. When done: `- [x] Bxx title (commit <hash>)`. Work top to bottom unless blocked; note reorders in STATUS_B.

## CORE

- [ ] **B01 Wait for scaffold, then UI foundations**
  - Sync every 3 to 5 min until Lane A's A01 (Next.js app at the repo root) is on main; meanwhile update `docs/DESIGN.md` with your motion plan per screen. Then: fonts via `next/font` (Instrument Serif, Inter Tight or Geist, JetBrains Mono or Geist Mono), root layout, Playwright installed and configured (`e2e/`, `playwright.config.ts`, script `e2e` in package.json, additive).
  - Accept: `pnpm build` succeeds; `pnpm e2e` runs one smoke test that loads `/` (output shown).

- [ ] **B02 Design tokens + base layer**
  - Tokens from `docs/DESIGN.md` as CSS variables + Tailwind theme; grain overlay; hairline grid; glass panel; custom scrollbars, selection, focus rings; Lenis smooth scroll; reduced-motion handling.
  - Accept: `/lab` page renders tokens (colors, type scale, spacing) and the base layers; screenshot committed.

- [ ] **B03 Field shader**
  - R3F + custom GLSL domain-warped flow field; props: `activity` (0..1, animates intensity/speed), `accent`; cursor-reactive; DPR cap 1.5; pause on hidden; static gradient fallback.
  - Accept: `/lab` shows the shader with an activity slider; Playwright perf check: no long tasks > 200 ms after load on the landing page (or document measured numbers).

- [ ] **B04 Component kit**
  - Glass Panel, Button (primary/ghost/quiet, magnetic primary), URL Input, Answer Chip (single/multi), Badge (status/demo/compliance), Tabs, Tooltip, Dialog, Sheet, Skeleton (glass shimmer), NumberTicker, MonoLabel, PhaseRail, EvidenceCard, CostMeter, StatusDot, ProviderTile, PhoneFrame player, Toasts. All on Radix primitives, fully restyled.
  - Accept: every component in `/lab` with states (default/hover/focus/disabled/loading); Vitest render tests for logic-bearing components.

- [ ] **B05 Data client + mock mode**
  - Typed client for `/api/...`, SSE wrapper, in-browser mock with scripted full run (~60 s), consult pause/resume, packs and results data. Switch via `NEXT_PUBLIC_DATA_MODE` (`mock` | `live`).
  - Accept: Vitest tests for the SSE wrapper (reconnect + Last-Event-ID) and mock run script; a dev page logs the full mock event stream.

- [ ] **B06 Landing `/`**
  - Hero with field shader + Instrument Serif headline + URL input; on submit, the vortex transition into `/brands/new` (or the run); short product story sections (the loop, the four brands, the honesty rules: no fake numbers, nothing posts without you); footer.
  - Accept: screenshots desktop + mobile; Lighthouse perf >= 80 on production build (report the score).

- [ ] **B07 Portfolio `/brands` + Enter `/brands/new`**
  - Living brand cards (vertical, countries, connections live/demo, last run, packs ready/posted, total views with ticker). New brand: URL in, live intake events, lands on brand home.
  - Accept: e2e: create a brand in mock mode and see it in the portfolio.

- [ ] **B08 Brand home + Connect**
  - Dossier view with inline editing (PATCH), sources list, runs list, start run. Connect page: provider tiles with Live/Demo/Missing, per-brand config fields (non-secret ids only), honest copy about what each connection adds.
  - Accept: e2e: edit a dossier field and see it persist (mock); connect page shows all providers.

- [ ] **B09 Run cockpit `/runs/[id]`**
  - Phase rail with moving light, live event stream (typed-in tool calls, costs, warnings), evidence wall (cards by source, thumbnails, metrics, outlier/longevity badges, deconstruction on hover/expand), shader activity tied to run state.
  - Accept: e2e: mock run streams to completion with all phases lit; screenshot mid-run and finished.

- [ ] **B10 Consultation `/runs/[id]/consult`**
  - One question at a time, large serif prompt, mono "why I'm asking", evidence chips, answer chips / text / scale / confirm, skip with assumption, progress constellation, free-text chat drawer streaming from `/runs/:id/chat`.
  - Accept: e2e: answer all questions in mock mode and the run resumes.

- [ ] **B11 Direction `/runs/[id]/direction`**
  - Orbit map (brand center, channels at distance by score, size by priority, six-axis breakdown on hover, evidence drawer), ranked list view toggle, notNow ring with reasons, reorder/drop -> PATCH plan.
  - Accept: e2e: switch views, open a channel's evidence, drop a channel; screenshot.

- [ ] **B12 Studio `/runs/[id]/studio`**
  - Concept cards (hook, angle, channel, compliance badge, estimated cost), storyboard strip (9:16 keyframes per shot), approve/regenerate per shot, render draft/final with cost meter, PhoneFrame player for the MP4, compliance findings panel.
  - Accept: e2e: approve shots and trigger a render in mock mode; player shows the video (mock serves a sample MP4 or Lane A's demo render).

- [ ] **B13 Packs `/runs/[id]/packs`**
  - Ready-to-post cards per platform (cover, caption, hashtags, post time, checklist), download zip, copy caption, mark posted (URL), metrics entry form.
  - Accept: e2e: mark a pack posted and enter metrics.

- [ ] **B14 Results `/brands/[slug]/results`**
  - Posted packs with "posted X h ago" and live tickers, small-multiples chart per post (views over time), learnings list, honest empty state "Waiting for first metrics".
  - Accept: e2e: after metrics entry the chart and counters update.

- [ ] **B15 Settings `/settings`**
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
