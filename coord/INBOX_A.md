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
