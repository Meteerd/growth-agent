# INBOX for Lane A (engine). Written by Lane B. Append only.

## 2026-10-11T23:12 from Mete (human): real brand assets added
Real logos and brand imagery for all four brands are now in `assets/brands/<aclinic|hound|dynova|evreon>/` with a README (style notes and usage rules). Use them as image references for keyframes/statics and as logos on end cards; seed `visual.logoUrl` and colors from them.

## 2026-10-11T23:24 from Mete (human): PRIORITY: reverse-engineering is the heart of the product
Read docs/PRODUCT_SPEC.md 2.3b now. The agents must WATCH winning videos (frames + transcript via Claude vision), output shot-by-shot `Blueprint`s, remake the same ad for our brand in every winning format, then WATCH our own render and fix weak shots (`Review`, max 2 rounds). Contracts changed in docs/ARCHITECTURE.md section 5 and 6 (new `Blueprint`, `BlueprintShot`, `Review`; new phases `reverse_engineer` and `review`; new RunEvent types `blueprint`, `review`; Concept gets `blueprintId`, `shotMap`, `variantOf`, `aspect`; 3 new endpoints). Put these into src/contracts in A02 (fixtures too: one blueprint per brand, aligned remake, two review rounds). New tasks A08b, A11b, A11c; A14 and A15 extended. Treat A08b as high priority after A08.

## 2026-10-11T23:52 from Mete (human): run until 07:00, never finish early
Read coord/IMPROVE_LOOP.md now and follow it whenever CORE and STRETCH are done or blocked. You never idle, never wait for the clock, never answer the goal check without doing work. Test, find the weakest thing, fix it, add a test, sync, repeat, until `date` shows 07:00. Cover the edge cases listed for your lane.

## 2026-10-12T00:49:39+03:00 from B: demo render MP4 missing on a fresh clone
- On my machine (fresh DB, auto-seeded), `GET /api/assets/demo/hound/concept_hound_1_r2.mp4` (and the r1 file) return 404, so the studio player and the self-review player show my "not available on this machine" state for the seeded demo run. Request: have the seed (or first request) render or copy a small demo MP4 for each seeded remake concept, so the Hound demo run plays a real video on the judging laptop. If that is not possible, tell me and I will keep the placeholder.
- FYI live parity: with LIVE_PROVIDERS empty, every cockpit screen renders against your real routes with zero console errors (e2e/live.spec.ts, 10 passed). Brand home now starts runs with reuseResearchFrom "recorded" and opens the cockpit with ?pace=150; it falls back to a plain run on 404.

## 2026-10-12T01:08:49+03:00 from B: two engine tests time out under full pnpm check on my machine
- `src/engine/__tests__/consult.test.ts` (demo run pauses at consult ... resumes) and `src/engine/__tests__/direction.test.ts` (a.clinic meta_ads not now, RX4) hit the 30 s test timeout during `pnpm check` (load average about 10 here). Run alone they pass (10 tests, 48 s total), so it is timing, not logic. Request: give the full-pipeline tests their own timeout (e.g. 90 s) or run them with `describe.sequential`/fewer workers, so `pnpm check` stays green on slower laptops. I did not touch your files; my sync retried.

## 2026-10-12T01:16 from Mete (human): PRIORITY: remakes must look like real winning ads (A17)
The renders are our cartoon brand illustrations panned with captions. The winners we remake are real phone footage. Do A17 now (top of TASKS_A): photoreal keyframes matched to each blueprint's style, real motion via fal (and OpenAI video if available on our key), a stricter self-review for AI tells, and one flagship Hound + one a.clinic final video set as default renders. Tell Lane B when they land so the cockpit shows them as hero media. Lane B is redesigning the UI (docs/DESIGN.md v2).

## 2026-10-12T01:16 from Mete (human): A17 addendum: start from our real images
Turn the brand images we already have (`assets/brands/`) into real video shots with image-to-video, following the winning ad's structure, camera moves and timing; generate new frames only where no real image fits. See the addendum in A17.

## 2026-10-12T02:16:17+03:00 from B: concepts lose blueprintId on runs that reuse research (demo providers)
- Repro (zero spend): `NEXUS_TEST=1 LIVE_PROVIDERS= pnpm dev`, then `POST /api/brands/hound/runs {"kind":"full","reuseResearchFrom":"recorded"}`, answer the questions, wait for done. `GET /api/runs/<id>/blueprints` returns 3 blueprints (`bp_..._421f3f`), but every concept from `GET /api/runs/<id>/concepts` has `blueprintId: null` and no `shotMap` (variants keep `variantOf`). So the reverse-engineer view of that run shows "the remake lands here" instead of the side by side.
- Request: in production, set the remake concept's `blueprintId` (+ `shotMap`) to the re-scoped blueprint id of the run. The UI already lists remade blueprints first with a "Remade" marker once that link exists.

## 2026-10-12T04:20+03:00 from B: Dynova heroVideo missing on a machine that imported the Dynova showcase before the flagship existed
- On the Lane B laptop, `GET /api/brands` gives `heroVideo: null` for Dynova with the existing `data/nexus.db`; with a fresh `DATABASE_URL` it is set. Cause: `importShowcase` (src/engine/live/showcase.ts:111) returns early when the run already exists, so the flagship asset rows and the copy from `docs/renders/` never happen on a DB that imported the earlier Dynova showcase.
- Ask: upsert the bundle's assets (and copy the files) even when the run is already there, so `pnpm dev` or `pnpm seed` on an older DB picks the flagship up. The demo laptop may well have an older DB. No UI change needed; the portfolio, brand home and studio pick `heroVideo` up as soon as it is set.

## 2026-10-12T04:33+03:00 from B: FYI, dynova showcase JSON has a lone surrogate escape
- `src/contracts/fixtures/live/showcase/dynova.json` around column 71522 holds `\ud835` with no low surrogate (a scraped ad caption in styled Unicode, cut mid-character). `JSON.parse` accepts it, so the engine is fine, but Turbopack refuses to `import` the file ("unexpected end of hex escape"). Lane B now reads the showcase files with `fs` (landing "Same engine" section), so nothing is blocked. If you sanitise scraped text on export, dropping unpaired surrogates would keep the fixture importable.

## 2026-10-12T07:26 from Mete (human): A18 video quality is the top priority
Mete watched the flagships. Hound: excellent. a.clinic: the zoom shakes the whole frame (zoompan jitter in compose.ts), no music, bad caption placement, and the reviewer still gave it 82. Read A18 at the top of TASKS_A. Do the code and unit tests now (no renders while the lid is closed); renders at the event with fal credits and the ElevenLabs key.

## 2026-10-12T07:35 from Mete (human): A18 waits for the event
Do not start A18 now. It happens at the event, after Mete claims the fal credits and adds the ElevenLabs key. Until your 08:45 freeze, only light, safe work; do not touch the video pipeline.

## 2026-10-12T07:36 from Mete (human): A18 adds a video watcher (Gemini)
At the event, A18 also adds a Gemini provider that watches whole videos with audio, for winners and for our own renders (plain-language critique + per-shot scores into the regenerate loop). Still do not start before Mete says go.

## 2026-10-12T09:00 from Mete (human): captions copy the winner's text style; Hound gets new captions
The grey box with an orange underline looks bad. For every flagship (Hound included), read the winner's on-screen text style from its frames (Gemini + Claude vision): font look, weight, size, color, stroke/shadow/box, case, position, animation. Store it in the blueprint and render our captions in that style with a bundled free font. Hound keeps its clips but is re-composed with new captions + ElevenLabs voice, music, SFX. Review compares caption style against the winner. Part of A18, before re-renders.

## 2026-10-12T09:01 from Mete (human): captions must be LIVELY
Word-by-word or phrase pop-in synced to the ElevenLabs word timestamps, spoken word highlighted, quick bouncy entrances, emphasis on key words; still in the winner's text style. Render per frame (sharp/canvas/Remotion), smooth, no jitter. Review fails static or out-of-sync captions.

## 2026-10-12T09:22+03:00 from B: the shapes the cockpit will read for today's media (all optional, additive)
The UI will light up each of these as soon as it appears; nothing breaks while they are missing. If you name things differently, just tell me the names in INBOX_B and I adapt.
- Voice per brand: `GET /api/brands` item `voice?: { name, voiceId, language, persona?, sampleUrl }` (sampleUrl = a short local MP3 under /api/assets, played by a button on the brand card, brand home and studio).
- Dubbed versions: `heroVideo.dubs?: [{ language: "cs" | "es" | ..., url, posterUrl? }]` and the same `dubs` on the concept's video asset if that is easier (I read either). The video gets a language toggle (EN / ES, SK / CS).
- Music and sound: on the concept, `audio?: { music?: { label, prompt?, url? }, sfx?: [{ t, label }], voice?: { name, voiceId } }`. The studio marks music on the timeline and SFX at their times.
- Gemini critique: on a review round, `reviewer?: "claude" | "gemini"`, `critique?: string` (plain language), per-shot scores in the existing `perShot`. For winners, on the blueprint: `watch?: { summary, music?, sound?, pacing?, textStyle? }`.
- Please keep every media file local (served from /api/assets): the demo must run with the venue Wi-Fi down. FYI Lane B now caches third-party covers locally at `/thumb?u=` (data/thumbs), fonts are self-hosted, and `demo/offline-check.sh` proves the pitch path with every non-loopback DNS lookup refused.

## 2026-10-12T09:38 from Mete (human): showcase clips for the landing page
After the four flagships pass review, make a set of 8 to 12 short showcase clips (4 to 8 s each, 9:16 and 16:9 crops) for the landing page's video wall: people talking to camera with lip sync in each brand's language (ElevenLabs voice; use a fal lipsync/talking-avatar model if available, otherwise skip that type), dogs (Hound), a.clinic scenes, Dynova lab/kit shots, Evreon clinic-paperwork shots. Real motion only (no zoompan), live captions where there is speech, within the caps. Export compressed 720p MP4 + poster JPG into public/showcase/ (small files) and list them in coord/INBOX_B.md as they land.

## 2026-10-12T09:55 from Mete (human): Camplan, a live app making ~$80K/month (Viktor), call at ~11:40
We will run the whole system on Camplan with its real data: RevenueCat, PostHog, Databricks, and Higgsfield (which Camplan already uses for video). This is our strongest proof for the judges. When you have a gap in the video work (Hound first), prepare the connectors, read-only:
1. RevenueCat (API v2, secret key + REVENUECAT_PROJECT_ID): overview metrics (active subscriptions, trials, MRR/revenue, conversion), by country/product where available.
2. PostHog (POSTHOG_API_KEY personal key + POSTHOG_PROJECT_ID + POSTHOG_HOST): top funnels/conversion, top referrers or sources, key events trend.
3. Databricks (DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID): SQL Statement Execution API, read-only queries; list tables first, then summarize the revenue/acquisition tables Viktor points to. New provider, keep it small.
Each connector: `pnpm smoke <provider> --live` once keys are in .env, a compact "business truth" summary into the brand's evidence, demo fixture fallback. Then onboard Camplan as a brand (URL from Viktor), run research (Spiral is strong for apps) and a flagship remake.
PRIVACY: Camplan's numbers stay on this laptop. Mark the brand private: exclude it from the public showcase build and from the public export unless Mete says Viktor approved. Never put its keys anywhere but .env.
## 2026-10-12T10:08+03:00 from B: B21 ready (read-only public build for AWS)
Exact commands (Ubuntu x64, Node 22, from `main`; full notes, systemd unit and Caddyfile in `deploy/README.md`):
```bash
corepack enable && pnpm install --frozen-lockfile
export NEXT_PUBLIC_READONLY=1 LIVE_PROVIDERS= DATABASE_URL=file:./data/showcase.db PORT=3000 NEXT_TELEMETRY_DISABLED=1
pnpm build
pnpm start
```
- No `.env` and no keys on the server. `NEXT_PUBLIC_READONLY=1` must be set for the build too (it is baked in). `src/proxy.ts` answers every POST/PATCH/PUT/DELETE under `/api` with 403 `read_only` and a plain message; the header says "Read-only showcase".
- Verified here on a fresh database and asset folder (`next start`, read-only build): `e2e/showcase.spec.ts` 3 passed: every change refused, spend unchanged, all ~50 screens of the four showcase runs (cockpit, consult, direction, studio, packs, every blueprint, brand home, connect, results, settings, landing) with zero console errors and no 5xx. Check on the server with `E2E_DATA=live E2E_PORT=3000 E2E_READONLY=1 pnpm exec playwright test e2e/showcase.spec.ts`.
- Linux natives are in the lockfile (libsql, sharp, Next SWC linux-x64) and `pnpm-workspace.yaml` allows the sharp and ffmpeg-static install scripts.
- Third-party analysis frames now go through `/frames/...` (Lane B route): served when present, 204 otherwise, so other machines show the shot description without a 404.
- Suggestion for the demo laptop too: `pnpm build && pnpm start` (without NEXT_PUBLIC_READONLY) instead of `pnpm dev`. No HMR, so the dev reload loop cannot happen, and the first paint of every screen is instant. Live runs and the consultation work the same.
- B19a (Mete and Emir authorized): real Manus tasks started from Lane B with `demo/manus.ts` (your provider through callProvider, nothing edited): deep research Dynova https://manus.im/app/eEWu4CdQDEQGnGW9Hm946o, Evreon https://manus.im/app/SSX4iUHYkXZNTAPR868qW6; landing pages for pack_1d68be0a_1, pack_1e6575ad_1, pack_91d09027_1, pack_f352d515_1. Results are recorded in `src/lib/client/manus-tasks.json`, which the cockpit's Manus card and the pack's landing block read on every machine.

## 2026-10-12T10:00 from Mete (human): A19 steer the video (variants fal+Higgsfield, revise by chat with clarifying questions, versions)
Read A19 at the top of TASKS_A. Order: finish the Hound render, then A19 (contract first, announce in INBOX_B), then the other flagships, then Camplan connectors.

## 2026-10-12T10:12+03:00 from B: B21 ready, please deploy
- SSH from Lane B's laptop stops at "Host key verification failed" (this machine has never connected to 63.181.87.203), so please run `deploy/aws/deploy.sh main` from Mete's session. main has B21 (`NEXT_PUBLIC_DATA_MODE=showcase` = read-only proxy for every POST/PATCH/PUT/DELETE under /api with a friendly message, recorded-covers-only `/thumb` cache, `/frames` 204 for missing analysis frames).
- Verified locally with the exact server env (`NEXT_PUBLIC_DATA_MODE=showcase`, `LIVE_PROVIDERS=` empty, fresh DATABASE_URL and ASSETS_DIR, `next build && next start`): `e2e/showcase.spec.ts` 3 passed (every change refused, spend unchanged, ~50 screens of the four showcase runs with zero console errors and no 5xx) and `OFFLINE_MODE=showcase demo/offline-check.sh` exit 0 (pitch path with every non-loopback DNS lookup refused in the server and every non-localhost request aborted in the browser).
- FYI the engine still runs ffmpeg in the background on the first seed in showcase mode (demo-run media, posters). It worked here; if you want it off on the server, gate it on `NEXT_PUBLIC_DATA_MODE === "showcase"` in your seed.
- Lane B will verify the live URL with Playwright (desktop + mobile) once you post "deployed" in INBOX_B.
