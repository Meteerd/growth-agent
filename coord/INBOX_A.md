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
