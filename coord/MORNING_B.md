# Morning report, Lane B (the cockpit)

Written 12 Oct 2026, 02:10 +03, updated through the night (see the log at the bottom of `coord/STATUS_B.md`).

## The short version
- Every screen in PRODUCT_SPEC section 4 works, in mock mode and against Lane A's real API routes.
- The UI is the **v2 "cutting room"** design Mete asked for at 01:16 (paper, ink, one record-red accent, Inter Tight, real media first). The v1 dark/glow/lime/serif look is gone from every route; an automated audit (`e2e/bans.spec.ts`) proves it on all 14 routes.
- `pnpm check` green, `pnpm e2e` green (71 passed, 10 live-only skipped), live parity spec green (10 passed), Lighthouse 97 on the landing page.
- Lane B spent $0. It never calls a provider; live-mode checks ran with `LIVE_PROVIDERS` empty.

## How to run
```bash
pnpm install
pnpm dev                                   # http://localhost:3000, live mode: Lane A's engine in the same app
NEXT_PUBLIC_DATA_MODE=mock pnpm dev        # in-browser fixtures only, no engine, no network
```
- Default is live (real `/api` routes). The DB auto-migrates and seeds on the first request; the recorded live research for Hound and a.clinic is imported with it.
- The header shows **Mock data** (dashed) or **Engine** (live). Runs on recorded data say **Live data, captured X ago**; demo fixtures say **Demo data**.
- `?pace=150` on a run URL replays its stream slowly (live), and the cockpit's **Replay the run** does the same for a finished run.

Tests:
```bash
pnpm check                                 # typecheck + biome + vitest (on a slow laptop: VITEST_MAX_WORKERS=3 pnpm check)
pnpm e2e                                   # Playwright, mock mode, starts its own dev server on :3100
```
Live parity (read-only, zero spend): stop other dev servers (Next allows one per folder), then
```bash
NEXUS_TEST=1 LIVE_PROVIDERS= NEXT_PUBLIC_DATA_MODE=live pnpm exec next dev -p 3200
```
and in a second terminal
```bash
E2E_DATA=live E2E_PORT=3200 pnpm exec playwright test e2e/live.spec.ts
```

## The 2-minute demo click path
1. **`/`** (5 s): the headline, then the real example strip: real winning posts the agent found for Hound on 11 Oct, and what Nexus made for Hound below.
2. **Portfolio** (10 s): four real brands led by their own imagery; numbers below are real (zero until posts are marked posted).
3. **Hound > Start a run** (20 s): in live mode it builds on the recorded research and replays it paced (`?pace=150`): the cockpit fills the evidence wall by source (73 real items), the Manus deep-research card links to the real Manus task, blueprints appear.
4. **The cockpit says "The agent has N questions"** > **Start the consultation** (25 s): answer 3 questions live (letters A, B, C pick options), skip one to show the stated assumption. The run resumes on its own.
5. **Reverse-engineer** (30 s, the moment): from the cockpit's "Winning videos taken apart" card. Two viewers play together (Original left, Our remake right), the red playhead runs over V1/V2/T1/beat lanes, scores per remade shot sit on V2. Click a shot, show "Why it wins" with the numbers, the hook card, and the self-review rounds.
6. **Direction** (15 s): the ranked editorial table; open TikTok for the evidence; point at **Not now** (struck through, with the reason; for a.clinic, Meta paid with the LegitScript reason).
7. **Studio** (10 s): storyboard keyframes (labelled "your image, animated" / "new frame"), approve, render with the estimate shown first.
8. **Packs > Results** (10 s): copy caption, mark posted with the post URL, enter the first numbers; results shows them, never invented ("Waiting for first metrics" before that).

## What works (screenshots in `e2e/screens/`, every route at 1440x900 and 390x844)
| Screen | Route | Screenshot | Proven by |
|---|---|---|---|
| Landing | `/` | `landing-desktop.png`, `landing-mobile.png` | smoke, screens, perf (no long task after load), Lighthouse 97 |
| Portfolio | `/brands` | `portfolio-*.png` | portfolio.spec (4 seeded cards, create from landing, invalid URL) |
| Enter | `/brands/new` | `enter-*.png` | portfolio.spec (intake stream, lands in portfolio) |
| Brand home | `/brands/[slug]` | `brand-home-*.png` | brand.spec (dossier edit persists), hero video when Lane A renders one |
| Connect | `/brands/[slug]/connect` | `connect-*.png` | brand.spec (all 15 providers; engines never "Missing") |
| Run cockpit | `/runs/[id]` | `cockpit-*.png`, `cockpit-midrun-desktop.png`, `cockpit-finished-desktop.png` | cockpit.spec (stream to consult pause, resume, 9 phases done, replay, Manus card) |
| Consultation | `/runs/[id]/consult` | `consult-*.png` | consult.spec (all kinds, skip with assumption, chat drawer streams) |
| Reverse-engineer | `/runs/[id]/blueprints/[bp]` | `reverse-engineer-*.png`, `blueprint-*.png` | blueprint.spec (aligned lanes, scores, scrub by click and keys, hook, review rounds, variants, mobile) |
| Direction | `/runs/[id]/direction` | `direction-*.png` | direction.spec (table, drawer with six axes and evidence, drop to Not now, reorder, a.clinic on mobile) |
| Studio | `/runs/[id]/studio` | `studio-*.png` | studio.spec (approve, render draft, player gets the MP4, text post preview) |
| Packs | `/runs/[id]/packs` | `packs-*.png` | packs.spec (mark posted, metrics, copy caption) |
| Results | `/brands/[slug]/results` | `results-*.png` | results.spec (empty state, then counters and chart update with snapshots) |
| Providers | `/settings` | `settings-*.png` | settings.spec (every provider, empty ledger) |
| Lab | `/lab`, `/lab/stream` | `lab-*.png` | mock-stream.spec (full scripted run with the consult pause) |
| Full loop | all of the above | | journey.spec: brand, run, consult, reverse-engineer, direction, studio, packs, results in one session |

Other things that exist: designed 404 and error boundary, loading/empty/error states on every screen, keyboard paths (consult letters, timeline arrows and Home/End, Enter submits, Esc closes), reduced motion respected (the playhead autoplay is skipped).

## Mock vs live
- **Mock** (`NEXT_PUBLIC_DATA_MODE=mock`): an in-browser store built from `@/contracts` fixtures; a scripted run plays in about 60 s (20 s in e2e) and pauses at the consultation until answers are posted. Mock state lasts one page load (client navigation keeps it). Mock never shows the placeholder video as a render.
- **Live** (default): every screen verified against Lane A's routes with real seeded data (`e2e/live.spec.ts`, 10 passed, zero console errors). Found and fixed on the recorded live Hound run: research-only runs, empty hook lines, header spend, the remake-pending lane (I01 to I04).
- Third-party frames: analysed ad frames live under `/api/assets/frames/...` only on the machine that ran the analysis (Lane A's). Elsewhere every frame falls back to a dark card that describes the shot; the landing falls back to the real post thumbnails.

## Known issues
- Lane A's full-pipeline tests were close to the 30 s timeout on this laptop under full parallelism; Lane A raised the timeouts at 01:16. If `pnpm check` ever times out there, `VITEST_MAX_WORKERS=3 pnpm check` passes.
- Mock mode resets on a full reload by design (shortcut noted in `src/lib/client/mock/client.ts`).
- The flagship renders (A17) appear as the brand-home hero video and in the studio player once Lane A has rendered them; until then the studio shows keyframes or labelled brand art.

## Spend
Lane B: $0 on every provider (no provider calls from the cockpit; live checks ran with `LIVE_PROVIDERS` empty and `NEXUS_TEST=1`).
