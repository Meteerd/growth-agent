# STATUS lane A

## Now
- Time: 2026-10-12 04:05 +03
- Current task: IMPROVE loop (all CORE + STRETCH + A17 checked); MORNING_A kept current
- Last sync: 03:55 exit 0, main UPDATED, checks PASS
- Blockers:
  - fal account balance exhausted (403 locked) at 03:24; motion falls back to Higgsfield ($6 of $8 used). Top up fal (event credits).
  - REVENUECAT, POSTHOG, STRIPE, PADDLE, META keys missing: connectors demo.
- Next 3: MORNING_A final details -> eval and edge cases from IMPROVE_LOOP -> keep syncing
- Spend so far (ledger, USD, 04:05): anthropic 10.56 / 150, openai 9.54 / 60, fal 7.25 / 8 (balance out), higgsfield 6.00 / 8, apify 2.33 / 4, firecrawl 0.07 / 3, youtube 0, manus 3 lite tasks

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
