# STATUS lane B

## Now
- Time: 2026-10-12 00:25 +0300
- Current task: improvement loop (coord/IMPROVE_LOOP.md)
- Last sync: 00:15 exit 0, main UPDATED, checks PASS
- Blockers: none. @/contracts v1.1.0 on main; Lane A API routes (brands, runs + SSE, consult, chat, plan) are on main.
- Next 3: edge cases (slow network, SSE drop, long strings, keyboard) -> visual polish of the reverse-engineer view -> re-screenshot
- Spend so far (USD per provider): 0 (Lane B makes no provider calls)
- Done so far: B01 to B15 incl. B12b, BS5, I01 to I04 (B11, B13, B14, B15 built by Lane B subagents in worktrees, merged after review).
- ack re "concepts lose blueprintId on runs that reuse research": fixed (INBOX_B 02:47).
- ack Hound flagship landed (INBOX_B 02:19) and a.clinic flagship landed too (INBOX_B 02:33): heroVideo used on landing, portfolio and brand home.
- ack A17 flagship remakes are rendering now (INBOX_B 01:33): heroVideo on brand home and portfolio, studio labels shot source.
- ack PRIORITY: the design is rejected, redesign now (B18) (INBOX_B 01:16): B18 before anything else. ack re your two requests (demo MP4s, test timeouts): both done (INBOX_B 01:16).
- ack real data + demo flow for the judge (INBOX_B 00:33): show "Live data, captured <time>" for dataset live_recorded; brand home offers a run on recorded research; packs get the Manus landing button (hidden on 409 manus_demo).
- ack the whole pipeline runs now (INBOX_B 00:18) and A13 landed: packs export, posted, metrics, results (INBOX_B 00:21): studio uses keyframe assets by shotIdx, 202 render with cost lines; packs and results already target these routes.
- ack run until 07:00, never finish early (INBOX_B 23:52): coord/IMPROVE_LOOP.md read; will run it after STRETCH. ack blueprints have real frames now (INBOX_B 23:57): placeholders kept for 404 frames.
- ack A09 landed: consultation is live (INBOX_B 00:00): consult UI posts one answer at a time and handles 409 run_finished.
- ack A03 landed: real /api/brands (INBOX_B 23:37). ack A05 landed: runs + SSE live (INBOX_B 23:40).
- ack A02 landed, contracts + fixtures on main (INBOX_B 23:28). ack contracts v1.1.0: blueprints + reviews (INBOX_B 23:31).
- ack new signature screen: Reverse-engineer view (B12b) (INBOX_B 23:24): planned after B12, budgeted as the main demo moment. ack A01 landed (INBOX_B 23:17). ack real brand assets added (INBOX_B 23:12).

## B18 self-audit (v2 bans, 02:02)
Automated: e2e/bans.spec.ts checks computed styles of every element for the DESIGN.md v2 hard bans (backdrop blur, italics, Instrument Serif, gradient text, lime, non-inset blurred shadows outside floating menus, canvas shaders, infinite ambient animations). Result on the synced tree: 14 of 14 routes with zero hits (/, /brands, /brands/new, /brands/hound, /brands/hound/connect, /brands/hound/results, /runs/run_hound_demo, /consult, /direction, /studio, /packs, /blueprints/bp_hound_1, /settings, /lab). Manual pass on every screenshot in e2e/screens: no shader, grain, grid, glass, glow, neon, orbit, serif or italic anywhere; record red only on the primary action, the playhead and the recording dot; mono only on numbers, ids and timecodes (stream log lines are timecoded and stay mono); media is the largest object on landing, portfolio, reverse-engineer, studio and packs. Full pnpm e2e: 71 passed, 10 live-only skipped.

## Design notes (boot, 11 Oct 23:16; measured with a throwaway Playwright probe of computed styles on linear.app, vercel.com, resend.com, rauno.me, igloo.inc)
1. Dark is never pure black: Linear's body is `rgb(8,9,10)`, cool and close to our `#06070A`. Resend uses true `#000` but lifts it with a soft diagonal light beam, so the depth comes from light, not from a grey surface.
2. Display type is tight: Linear sets 72/72 and 64/64 (line-height 1.0) at -0.022em; Vercel goes to -0.06em (64px with -3.84px). For Instrument Serif at 96px we should use line-height about 1.0 and about -0.01em only; serifs crowd faster than grotesks.
3. Resend pairs a serif display (Domaine, 96/96, -0.01em) with a white-to-grey vertical gradient fill on the headline. That serif-plus-gradient move is the closest match to our "observatory" headline. Copy the idea (bone to 62% bone), not the font.
4. UI text lives at 12 to 15 px. Linear's most common sizes are 12, 13, 14 and 15 px, with micro text at 10 px. Body tracking is slightly negative (-0.13 to -0.18 px). Nothing in the chrome is above 16 px. Our 13 to 15 px UI and 11 px mono labels are right.
5. Mono is a second voice, not decoration: Linear uses Berkeley Mono on about 20% of text nodes and Resend uses Commit Mono on about half. Use JetBrains or Geist Mono for every number, id, timestamp, cost and label, at the same visual weight as the sans.
6. Hairlines carry the structure: Linear's dominant border is `1px rgba(255,255,255,0.08)`, with 0.12 for emphasis and 0.05 for quiet. That matches our hairline token. Add a 0.12 "hairline-strong" and a 0.05 "hairline-faint".
7. Panels layer depth with stacked inset shadows rather than a single border: an inset `0 0 0 0.5px rgba(255,255,255,0.08)` plus an inset `0 0 12px rgba(0,0,0,0.2)` plus an outer `0 2px 32px rgba(0,0,0,0.25)`. Our glass panel should do the same: inner light edge, inner falloff, outer lift. Blur is rare: Linear has one `blur(20px)` element (the nav) and Resend a few `blur(25px)` ones. Keep backdrop-filter to 2 or 3 layers per screen and let the shader behind them be the "matter".
8. Micro-interactions are fast and long reveals are slow. Linear: 100 ms (about 240 elements) and 160 ms for hover, 400 to 700 ms for reveals. Vercel: 100 to 150 ms with a few 1 to 1.2 s hero reveals. Plan: hover and press at 120 to 160 ms; state changes at 300 to 450 ms with our `cubic-bezier(0.22,1,0.36,1)`; orchestrated sequences at 600 to 900 ms.
9. Easing: Linear's default is `cubic-bezier(0.25,0.46,0.45,0.94)` and its drawers use `cubic-bezier(0.32,0.72,0,1)`. Vercel and Resend use the Material standard `(0.4,0,0.2,1)`. Our expo-out `(0.22,1,0.36,1)` reads more premium for entrances; add `(0.32,0.72,0,1)` for sheets and drawers.
10. Spacing is dense inside components and generous between them. Gaps are 4, 6 and 8 px inside clusters (Linear about 200 uses, Vercel about 160), then 48 to 64 px between sections, inside a container of about 1250 to 1450 px max. Use a 4 px base with 4/6/8/12/16 for components and 48/64/96/128 for sections.
11. Radius is mixed on purpose: Linear uses full pills for buttons and chips, 8 to 12 px for cards and 4 px for small cells. Resend uses 16 px for cards and pills. This confirms our 2 / 14 / full scheme. Pills get a 1 px gradient border (Resend's announcement pill), a good fit for the demo badge and the live-run chip.
12. Linear's hero was blank 3.5 s after domcontentloaded (content is revealed after load), and igloo.inc rendered nothing in headless Chromium. Lesson for us: a staged reveal must never leave a blank frame or an empty screenshot. Render the static layout first (SSR text plus the static gradient), animate in from it, and give Playwright screenshots a "settled" wait.

## Log (one line per finished task, newest last)
- 23:17 boot: env verified, toolchain ready, lane-b created, first sync exit 0, design notes written.
- 23:22 B01 done (fa070a7): fonts, root layout, Playwright + smoke (1 passed), motion plan in DESIGN.md.
- 23:35 B02 done (0e1fd56): tokens.css + Tailwind theme, grid with ruler, grain, glass/glass-flat, skeleton, scrollbars, focus, Lenis, reduced motion, /lab + screenshots.
- 23:36 B03 done (3b1666f): raw WebGL2 field (R3F dropped, see DECISIONS), /lab activity/vortex/accent controls. Perf (Playwright, dev server): 1 long task after load, max 102 ms (limit 200).
- 23:43 B04 done (bbcbb80): 17 components on Radix (restyled) in /lab with states; vitest for phaseStates, costSegments, normalizeUrl, format (check: 40 tests pass). Placeholder MP4 public/media/sample.mp4 is visibly labelled DEMO RENDER.
- 23:51 B05 done (e0a53be): DataClient live + mock, SSE wrapper, TanStack hooks, /lab/stream. vitest: sse reconnect/Last-Event-ID/dedupe/end, parser, mock pacing 60 s, pause/resume, brand create, post + metrics (8 tests). e2e mock-stream passed.
- 23:58 B06 done (e2e2310): landing + app header. Lighthouse (prod build, perf only): 89 (FCP 0.8 s, LCP 3.8 s, TBT 10 ms, CLS 0). Screenshots e2e/screens/landing-*.png.
- 00:02 B07 done (0316da3): /brands living cards + /brands/new. e2e portfolio.spec: 4 seeded cards, create from landing then see it in portfolio, invalid URL blocked (3 passed).
- 00:09 B08 done (ceb08ab): brand frame, dossier inline edit, runs, sources, connect. e2e brand.spec: dossier edit persists across navigation, connect lists all 15 providers, unknown brand state (3 passed).
- 00:15 B09 done (6fb47b9; the web work landed in the commit titled 'coord: B09 checked' after a git add pathspec error): cockpit. e2e cockpit.spec: run from brand home streams to the consult pause, answers resume it, run-done with 9 phases lit; replay of the finished demo run (2 passed).
- 00:25 B10 done: consultation. e2e consult.spec: answer all six (one skipped with assumption), run resumes and finishes; chat drawer streams (2 passed).
- 00:25 B13 (c92a75c), B14 (1819f15), B15 (c5c11d8) merged from subagent worktrees. Post-merge e2e: packs 3, results 2, settings 1 passed; packs unknown-run test updated to the run-level not-found state.
- 00:35 B12b done (3240073): reverse-engineer view. e2e blueprint.spec: open from cockpit, timeline aligned (6 vs 6 shots), scores, click-scrub to CTA, arrow/Home keys, hook, review rounds, variants; mobile no overflow; unknown id state (3 passed). vitest align.test (5).
- 00:40 B12 done (b515787): studio. e2e studio.spec: approve one shot then all, render draft, player gets the MP4; X text post preview with 280 counter (2 passed).
- 00:45 Integration (0acf539): DatasetBadge for live_recorded runs, brand home starts on recorded research (?pace=150) with Fresh research option, Manus landing action on packs, BS5 Manus card (e2e asserts it on the Hound demo run).
- 00:54 Live parity: e2e/live.spec.ts against Lane A's real routes with LIVE_PROVIDERS empty and NEXUS_TEST=1 (zero spend): 10 passed. Found and fixed I01 to I04 (f426e42) on the recorded live Hound run.
- 00:54 B11 merged (59e9cce): direction orbit map, radar, drawer, ranked list, reorder/drop. Post-merge direction.spec 2 passed.
- Loop log: tested recorded live run cockpit + blueprint in live mode / found research-only run said 0 packs, empty hook quotes, header spend low, faint remake row / fixed in f426e42.
- 01:06 B16 done (b57e1fb): pnpm e2e exit 0 (55 passed, 10 live-only skipped, 4.0 min); journey.spec full loop 1 passed (56 s); screenshots of 14 routes x 2 sizes + cockpit mid/finished in e2e/screens. Live project: E2E_DATA=live e2e/live.spec.ts 10 passed (00:50).
- Loop log 01:17: reviewed every mobile screenshot / Connect marked global engines Missing, no 404 or error page, packs nested Page / fixed I05 to I07 in 0d4e1d4; brand.spec 4 passed, packs.spec 3 passed.
- 02:02 B18 done (fa1277c): v2 the cutting room on every screen (foundation 2c06889, edit timeline, editorial direction table 5ad92e7, portfolio/consult/packs/results/settings from a worktree agent). Fixed two of my own sweep bugs on the way (trimmed string spaces, lost shadow- prefix) with targeted repairs.
- 02:06 B17 done (fb19677): coord/MORNING_B.md written; Lighthouse v2 landing 97 (FCP 0.9 s, LCP 2.6 s, TBT 30 ms, CLS 0.001); all CORE tasks checked.
- 02:21 BS1 (presentation mode), BS2 (Cmd+K palette) done; BS3 skipped on purpose (v2 motion rules); BS4 done (4440fc1): journey.spec passes in live mode against Lane A's routes (NEXUS_TEST=1, LIVE_PROVIDERS empty, zero spend). Found I08 (remade blueprint not first) and an engine gap (concepts lose blueprintId on reused research), reported to INBOX_A.
- Loop log 02:36: quality.spec (14 routes: zero console errors/warnings, fit at 768, back/forward) all green first try; strings.spec found I09 (Unicode domain became a punycode brand) and a long-name overflow at 390 px (implicit auto grid tracks + truncate); fixed in 2db6a54 with url.ts helpers, global overflow-wrap, grid-cols-1 on 38 grids.
- Loop log 02:55: live mode on Lane A's flagship showcase runs / found duplicate review keys (I10), raw 'not visible in analysis' captions (I11), collapsed ruler labels from my overflow-wrap fix (I12) / fixed in 18645de; landing, portfolio and brand home now lead with the photoreal flagship remakes (I13). quality.spec 15/15 live and mock.
