# STATUS lane A

## Now
- Time: 2026-10-12 11:58 +03 (event day); 12:00 REVIEW CHECKPOINT: no new renders until Mete's beat-by-beat notes. Freeze 13:30; Mete wants Hound, a.clinic, Dynova finished on main by 13:20.
- Focus (Mete 11:15): Camplan > Hound > a.clinic > Dynova; Evreon gets no more work.
- Current: Dynova shot 1 persona fix (same woman as shot 0, A19 revision); English versions of a.clinic/Dynova (secondary "en" dubs, market language stays primary per Mete 11:30); English 6-10 s talking heads (ElevenLabs Aurora lip sync); Camplan waits for Viktor's keys + URL (CONNECTOR_BRAND=camplan set).
- Last sync: 11:18 exit 0, main UPDATED, checks PASS.
- Voices (assets/voices.json, ElevenLabs library, 3 takes each, Gemini listened): a.clinic sk "Hope - Natural, Clear and Calm" (OYTbf65OHHFELVut7v2H); Hound en-GB "Lucy - Fresh & Casual" (lcMyyd2HUfFzxdCaC4Ta); Dynova tr "Fili - Warm Turkish Female" (FDs1ZX5J4e4f2c2erxtW); Evreon en-GB "Archer - Conversational" (Fahco4VZzobUeiPqni1S). English versions reuse the same voice (persona continuity), eleven_multilingual_v2.
- Flagship reviews (Claude frames + Gemini whole video with sound, calibrated to the winner, stricter wins): Hound 78 (76/82/81/82/77/80), a.clinic v2 70, Dynova v2 68, Evreon 69 (frozen, no more work).
- Talking-head tool: ElevenLabs Creatify Aurora (/v1/flows/video, image + the ElevenLabs speech audio drives the lips) chosen over fal Kling AI Avatar (v2 standard/pro kept as fallback); quality on par in the side-by-side, keeps the whole presenter in ElevenLabs.
- Decisions today (conflicts resolved toward the pitch): premium caption spec over the winners' raw text style (Mete 10:53; the review judges against the target spec); market language primary, English as a dub (Mete 11:30 overrides 11:24); measured shake overrides Gemini's "handheld drift" shake; Gemini winner baseline < 40 is not used to calibrate.

## Camplan runbook (private brand, local only)
1. Keys in .env: REVENUECAT_API_KEY (+ REVENUECAT_PROJECT_ID), POSTHOG_API_KEY + POSTHOG_PROJECT_ID (+ POSTHOG_HOST us/eu), DATABRICKS_HOST/TOKEN/WAREHOUSE_ID (+ CATALOG/SCHEMA); CONNECTOR_BRAND=camplan (set). Add `revenuecat,posthog,databricks,spiral,apify,manus` to LIVE_PROVIDERS.
2. `pnpm smoke revenuecat --live`, `pnpm smoke posthog --live`, `pnpm smoke databricks --live` (print only, nothing recorded).
3. Onboard in the cockpit (Add brand, Camplan URL) or `POST /api/brands {url}`: intake + live research (Spiral first) + business evidence (RevenueCat/PostHog/Databricks) start; answer the consult; direction; studio.
4. `pnpm watch-winners <conceptId>`, `pnpm voices camplan` (add a camplan brief in scripts/voices.ts), `pnpm flagship-a18 <conceptId> --mode voice_led --animate-all --screen-cta --rounds 2`, compliance, pack. Never `export-showcase` it (refused unless PUBLIC_OK_BRANDS=camplan).

## Log (one line per finished task, newest last)
- 23:17 A01 done: Next.js 16.4 scaffold, check/build/dev OK
- 23:28 A02 done: contracts v1.0.0 + 4 brands + 4 demo runs, 20 tests
- 23:28 ack real brand assets added (INBOX_A 23:12): logos/colors seeded into dossiers (colors sampled from logo files), referenceImages listed; served via /api/assets/brands in A03
- 23:31 ack PRIORITY: reverse-engineering is the heart of the product (INBOX_A 23:24): contracts v1.1.0 with Blueprint/Review + fixtures landed; A08b/A11b/A11c queued in order
- 23:37 A03 done: Drizzle/libSQL schema + migration, idempotent seed (auto on first API call), brand/dossier/connections/providers/health/assets routes, 8 route tests
- 23:38 A04 done: callProvider gate + ledger (caps, reservations), price table, /api/spend, 6 tests
- 23:40 A05 done: run state machine, SSE (resume, heartbeat, pace replay), cancel, read routes; curl -N verified
- 23:43 A06 done: Claude wrapper + recorded tests; live smoke anthropic $0.0031 recorded to fixtures/live/anthropic/smoke.json
- 23:48 A07 done: pipeline + intake; live intake houndapp.xyz $0.069 recorded (fixtures/live/intake/hound.json, firecrawl/houndapp_xyz.json)
- 23:53 A08 done: research phase + providers; demo yields 32 evidence/9 sources for Hound and a.clinic; YouTube live smoke recorded (free)
- 23:57 A08b done: reverse-engineering engine; synthetic video cuts within 0.07 s; live vision blueprint $0.056 recorded
- 00:00 A09 done: consult pause/resume via answers, chat SSE live-verified (grounded in evidence ids)
- 00:02 A10 done: direction with explicit weights + RX4 guard; acceptance for a.clinic/Evreon/Hound in tests; PATCH versions
- 00:18 A11, A11b, A11c, A12 done: full demo run for Hound in 7.6 s through all 9 phases; remake 6 shots 1:1 to blueprint, static+text variants, 2 review rounds (shot 3: 58 -> 95 after regeneration), 23 s 1080x1920 MP4 with audio; compliance RX1/P1 tests
- 00:21 A13 done: zip (video+images+caption+hashtags+checklist+cover), posted, metrics, results, learnings
- 00:21 ack run until 07:00, never finish early (INBOX_A 23:52): IMPROVE_LOOP read; will run it after STRETCH
- 00:24 A15 done: pnpm test:engine-e2e 15/15 in 27 s (A14 deferred until after A15 so the real-data pass runs on the finished pipeline; noted per protocol)
- 00:38 A14 in progress: smokes recorded for anthropic, openai (gpt-image-2 + tts + whisper), firecrawl, youtube, spiral (via pass), apify (via pass), manus (via pass, task still running); Hound real dataset recorded (73 evidence/8 sources/3 blueprints); a.clinic pass running. Bugs found and fixed by the live pass: outputSchema dropped a property named `format`; Spiral uuids format; Manus sub-agent wait misread; off-topic items (relevance filter added); demo items mixed into live passes
- 01:08 A14 done (see TASKS). AS2 done: fal final render of the Hound remake (6 clips, $1.50). Live full Hound run on recorded research passes eval-run 49/49. AS3-AS6 done.
- 01:16 ack demo render MP4 missing on a fresh clone (INBOX_A 00:49): demo keyframes + review MP4s built after seed. ack two engine tests time out under full pnpm check (INBOX_A 01:08): timeouts raised to 120 s / 180 s
- 01:46 ack PRIORITY: remakes must look like real winning ads (A17) and A17 addendum (INBOX_A 01:16): flagship builder landed (shot sourcing from brand images, photoreal frames, fal motion, AI-tells review); Sora not available on our key (404); Hound flagship rendering with 6 photoreal frames
- 02:33 A17 done. Flagships: Hound concept_1d68be0a_1 (run_mv4e0ud7671d68be0a) 83/100, shots 85/86/81/84/85/80: six photoreal phone-footage shots (beagle at the door, keys, chew toy, hand on head) remaking a real TikTok myth-vs-fact winner, CTA shot holds a phone showing Hound's real beagle art. a.clinic concept_1e6575ad_1 (run_mv4e8sfdbc1e6575ad) 82/100, shots 80/83/82/85/80/80: Slovak home footage, sticky-note 4 steps, laptop/phone with a.clinic's real doctor art, local pharmacy, checklist, phone with the a.clinic page. Contact sheets in docs/renders/. Sora unavailable (404), fal Kling 2.1 used.
- 02:47 ack concepts lose blueprintId on runs that reuse research (INBOX_A 02:16): fixed with fallback linking + test
- 03:29 IMPROVE: fresh-clone check OK; Dynova + Evreon live research and full runs; eval-all all green on current runs; fal balance exhausted (circuit breaker added)
- 04:05 IMPROVE I29-I31: Dynova flagship 81/100 (every shot >= 80, Higgsfield clips) exported as showcase; wordy video captions shortened before compliance; clause-safe fallback; eval checks language + readability; tests for motion fallback, flagship repair, tightened-caption compliance
- 04:24 IMPROVE I32-I40: cap warnings for every provider, double-click-safe run creation, consultation edge tests, render heals missing files, shortened evidence ids repaired, live runs never mix demo data, shot sourcing + review calibration prompts, API sweep 315/0
- 04:33 ack Dynova heroVideo missing on a machine that imported the Dynova showcase before the flagship existed (INBOX_A 04:20): importShowcase refreshes older imports + test (I43). Evreon flagship 80/100 exported (I44).
- 04:50 ack FYI, dynova showcase JSON has a lone surrogate escape (INBOX_A 04:33): fixture writers drop unpaired surrogates, both Dynova fixtures cleaned (I49).
- 07:12 IMPROVE: repaired shortened evidence ids in older plans where unambiguous (plan_0569d023_v1); run_mv4dl43id902ec6a1f keeps 3 eval failures (superseded, documented).
- 07:16 HOLD: Mete asked (after 07:14) not to run ffmpeg while the laptop lid is closed. The final sync (pnpm check renders test videos with ffmpeg) waits until he is back. Main is green as of 04:54; only MORNING_A/STATUS_A edits are pending on lane-a. The 07:14 sync failed only because demo-media.test.ts timed out while the machine slept.
- 07:23 new goal from Mete (internet back): sync first. The 07:20 sync failed again on demo-media.test.ts (renders 8 videos, 121 s under load); gave that test its own 300 s timeout (6df632d); 07:23 sync exit 0, main green. Light work only until 08:45, then FROZEN.
- STOPPED by Mete at 07:41, A18 paused for the event. Last work commit abe91d4 (A18 so far: shake fix + metric, native captions, audio mix with music bed/ducking/-14 LUFS, measured review caps; not started: ElevenLabs provider, Gemini watcher, re-renders). Resumes at the event with coord/GOAL_A_EVENT.txt.
- 10:24 A18: Hound flagship landed (same clips, ElevenLabs voice/music/SFX, live serif captions in the winner's style, real houndapp.xyz CTA), 77/100; A19 contract/routes/engine + test; business connectors (RevenueCat v2, PostHog HogQL, Databricks SQL, read-only, CONNECTOR_BRAND-bound, private export guard).
- 11:05-11:18 A18: premium captions (Plus Jakarta Sans, spring-in, brand accent; Hound keeps a refined black box) on all four flagships; a.clinic v2 (new pharmacy shot) 70, Dynova v2 (woman presenter shot 0) 68, Hound 78 + whimper SFX + es re-dub; exports + INBOX_B "new render on main". Business connectors hardened (warnings, CONNECTOR_BRAND check, Databricks polling + strict read-only guard, PostHog sequential, tests).
- 11:58 12:00 checkpoint: final cuts on main (captions centred + never across a cut + readable pace); Hound 74-79, a.clinic SK 60 (hard product gate rejects: product only at the end), Dynova TR 64; talking heads EN 7.4/8.5/9.8 s, Gemini lip sync 95 each (Aurora x2, Kling Pro x1); coord/REVIEW_1200.md + coord/WINNERS_1200.md (subagent re-search: Hound Zigzag 275 d/9 variants, @betternaturedogtraining 145k, Woofz 79 variants; a.clinic HealthifyRx 125 d, MeAgain 51 d, Hers 52 d; Dynova AG1 carousel 229 d/18 variants, ZOE 62 d, TR organic partly on-category). Waiting for Mete's notes. Carousel subagent still running.
