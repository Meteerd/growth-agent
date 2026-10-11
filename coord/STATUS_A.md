# STATUS lane A

## Now
- Time: 2026-10-12 00:38 +03
- Current task: A14 live smoke tests + real dataset (Hound, a.clinic)
- Last sync: 23:37 exit 0, main UPDATED, checks PASS
- Blockers:
  - REVENUECAT, POSTHOG, STRIPE, PADDLE, META keys MISSING: brand "business truth" connectors run demo (labelled fixtures). No CORE task blocked.
  - HIGGSFIELD key present but unvalidated: auth format confirmed in A14 smoke; fal is the default video path.
- Next 3: A14 live smokes + real dataset -> A16 morning report -> STRETCH AS1 Manus landing page
- Spend so far (USD per provider, ledger): anthropic ~0.6, openai ~0.08, apify ~0.97 (incl. one crashed pass), firecrawl ~0.04, youtube 0, spiral credits (~11 ads), manus 1 lite task (credits)

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
