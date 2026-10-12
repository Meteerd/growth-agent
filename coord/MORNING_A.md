# MORNING_A: the engine (Lane A)

Written by Lane A overnight. Plain status for Mete and Emir. Last update: see the bottom.

## Run it (from a fresh clone)
```bash
pnpm install                  # also fetches ffmpeg (ffmpeg-static) and sharp
cp .env.example .env          # paste keys; empty key = labelled demo data
pnpm db:migrate && pnpm seed  # optional: the first API call migrates and seeds by itself
pnpm dev                      # http://localhost:3000
```
- `pnpm check`: typegen + tsc + Biome + Vitest (no live calls).
- `pnpm test:engine-e2e`: a full demo GTM run for all four brands through every phase (renders a real MP4).
- `pnpm smoke <provider> [--live]`: one recorded real call (anthropic, openai, firecrawl, youtube, fal, higgsfield, blueprint, intake).
- `pnpm live-pass <slug>`: a real research pass (Apify, Spiral, Manus forced live for that run), recorded as the brand's dataset.
- `pnpm full-run <slug> [--fal]`: a full run on top of the recorded research; the consultation questions are skipped (the agent states its assumptions), `--fal` renders the remake with fal clips.

## What the engine does (all behind `/api`, contracts in `src/contracts`)
1. **Intake**: Firecrawl reads the site (markdown + brand colors/fonts), Claude writes the dossier. Operator edits are locked against later crawls.
2. **Research**: Claude plans the searches; Spiral (Meta ads with creative analysis + transcripts), Apify (Meta Ad Library, TikTok, Instagram, Reddit), YouTube Shorts and a Manus deep-research task run in parallel; Claude drops off-topic items; outlier score and longevity tiers; Claude deconstructs the top winners.
3. **Reverse-engineer**: downloads the top winning videos, ffmpeg finds the cuts and samples frames (dense in the hook), Whisper transcribes, Claude vision writes a shot-by-shot blueprint (hook mechanism, shots with purpose and timing, pacing, why it wins).
4. **Consult**: 5 to 7 gap-driven questions, each with why + evidence ids; the run waits; chat streams answers grounded in evidence.
5. **Direction**: Claude scores all 13 channels on six axes; code applies explicit weights and hard rule guards (a.clinic Meta paid is always "not now" under RX4 until certified).
6. **Production**: concepts that remake a blueprint shot for shot (shotMap), plus the same idea as static, carousel and text post; every concept passes the rule pack (patterns + Claude, auto-revise twice, then blocked).
7. **Review**: renders the remake (sharp + ffmpeg, 1080x1920, captions in safe zones, end card, voiceover), Claude watches it, regenerates the weakest shot, renders again (max 2 rounds).
8. **Compliance gate + packs**: zip per post (video, images, caption, hashtags, first comment, checklist, cover), mark posted, manual metrics, learnings (only from real numbers, cross-brand only when a pattern holds in 2+ brands).
Also: `/api/mcp` (MCP server with the brand tools), Manus landing page per pack (never published by us), resume of interrupted runs, spend ledger with caps.

## What is already in the database (real data, this machine)
| Brand | Run | What it is |
|---|---|---|
| Hound | `run_mv4c9xtr8203508c41` | Recorded live research pass (`live_recorded`): 73 real items from Instagram, TikTok, Reddit, YouTube, Meta Ad Library, Spiral, site, plus Manus deep research (landscape, 10 competitors incl. Woofz and Dogo, community rules). 3 blueprints from real winning videos. |
| Hound | `run_mv4e0ud7671d68be0a` | Full live run on that research: consultation (questions skipped, so the plan states its assumptions), plan TikTok 79 > Shorts 73 > Reels 55 > Reddit 54, 6 concepts, review, packs. `pnpm eval-run` 47/47. Flagship remake `concept_1d68be0a_1`. |
| Hound | `run_mv4cox1z4e0569d023` | Earlier full live run (on demo research) with the first fal final render (6 Kling clips) and a Manus-built landing page for its TikTok pack (unpublished). |
| a.clinic | `run_mv4cgiqt5f95119dba` | Recorded live research pass: 82 real items (TikTok, Instagram, Meta Ad Library, Spiral, YouTube, site) + Manus task. 3 blueprints. |
| a.clinic | `run_mv4e8sfdbc1e6575ad` | Full live run on that research, all Slovak concepts, Meta paid "not now" (RX4), SEO/Reels/TikTok organic. Flagship remake `concept_1e6575ad_1`. |
| Dynova | `run_mv4h0j4j04f07e6df3` / `run_mv4hicmqcb91d09027` | Recorded live research (67 real items, Turkish vitamin listicles and supplement Shorts, 3 blueprints) / full live run on it: TikTok > Shorts > Reels > SEO, Turkish concepts. |
| Evreon | `run_mv4hced3d147369b5a` / `run_mv4htba4f3f352d515` | Recorded live research (87 real items, 3 blueprints) / full live run: LinkedIn first, then practice-manager communities and email; founder posts and demo clips. |
| all four | `run_<slug>_demo` | Deterministic demo runs (labelled demo), with locally built demo keyframes and review videos. |

## The 2-minute demo path
1. Portfolio: four brands, each showing its flagship video (`heroVideo`) and "Live data, captured ..." on the latest run.
2. Hound: open the recorded research run and replay it (`/api/runs/run_mv4c9xtr8203508c41/events?pace=150`): crawl, Spiral and Apify sources, relevance filter, deconstruction, Manus task link, blueprints.
3. Reverse-engineer view: the winner's blueprint next to our remake, shot for shot (`concept_1d68be0a_1.shotMap`).
4. Consultation live: start a run on the recorded research (`POST /api/brands/hound/runs {"kind":"full","reuseResearchFrom":"recorded"}`), answer 2 or 3 questions in front of the judge (Claude, live). The rest of that run takes ~10 minutes, so for direction, studio and packs switch to `run_mv4e0ud7671d68be0a` which already finished.
5. Direction: ranked channels with six-axis scores, explicit weights, evidence links, "not now" with reasons.
6. Studio: the flagship video, its keyframes (brand images or photoreal frames), the two review rounds with per-shot scores.
7. Packs: download the flagship's TikTok pack zip (`pack_1d68be0a_1`: video, caption, hashtags, checklist, cover). The Manus-built landing page is on `pack_0569d023_1` of the earlier Hound run `run_mv4cox1z4e0569d023` (this machine only; built for an earlier Hound concept, unpublished): https://manus.im/app/495LAe3t6NDkJcXULHZL4T (opens in Mete's Manus account). `POST /api/packs/:id/landing` builds one for any pack when Manus is live (one lite task each).
8. a.clinic in 20 seconds: same loop, Slovak content, Meta paid blocked by RX4 with the reason.

## Live vs demo (overnight)
- `LIVE_PROVIDERS` = anthropic, openai, firecrawl, youtube. fal, Apify, Manus, Spiral, Higgsfield ran only in smoke tests and the recorded live passes.
- Demo data is always labelled (`demo: true`, "Demo data" in the UI, "Demo keyframe" / "Demo render" burned into demo images and videos).

## Flagship videos (A17, the hero media)
- **Hound** `concept_1d68be0a_1`: 29 s, six photoreal phone-footage shots remaking a real TikTok myth-vs-fact winner ("Just let them cry it out"? ...), CTA shot holds a phone showing Hound's real beagle art. Review 83/100, every shot >= 80. `docs/renders/hound-flagship.jpg` / `.mp4`.
- **a.clinic** `concept_1e6575ad_1`: Slovak 4-step listicle remake: home, sticky notes, laptop and phone with a.clinic's real doctor art, local pharmacy, checklist, the a.clinic page. Review 82/100, every shot >= 80. `docs/renders/aclinic-flagship.jpg` / `.mp4`.
- **Dynova** `concept_91d09027_1`: Turkish explainer remake ("Genel öneriler varken gen testi gerekli mi?"): a man with the Dynova kit, at-home sample to lab, "teşhis değil, bilgi" (not a diagnosis), routine from your own data, dynova.health on a phone. Review 81/100, every shot >= 80, clips by Higgsfield (fal balance ran out). `docs/renders/dynova-flagship.jpg` / `.mp4`.
- **Evreon AI** `concept_f352d515_1`: English LinkedIn product-demo remake for UK practices: an unread referral stack, a waiting patient, a scanned foreign-language letter, Evreon reading and linking it to its source, "50+ languages, EU data residency, never diagnoses", book a 20-minute demo (all claims from the site). Review 81/100, every shot >= 80 (68 at first; the fixes are in I38, I42, I44). `docs/renders/evreon-flagship.jpg` / `.mp4`.
- How: Claude picks per shot a real brand image or a frame in the winner's look (photoreal for real-footage winners), OpenAI gpt-image-2 renders frames (brand art goes onto screens through an image-edit reference), fal Kling 2.1 animates the shots (screens stay still), ffmpeg composes captions, voiceover and end card, Claude reviews against the blueprint and an AI-tells rubric, weak shots are fixed (keep-best per shot). `pnpm flagship <conceptId> [--repair] [--sheet docs/renders/x.jpg]`.

## Safety and quality rules added overnight (each has a test)
- A live run never mixes demo data into real research: a provider that is not live is skipped with a warning (demo runs keep labelled demo data).
- Any provider hitting its budget cap leaves a `warning` event on the run ("<provider> budget cap reached: skipped, using the fallback for this step").
- Double click on "start run" starts one run (same request within 60 s returns the active run).
- Consultation: all questions skipped, duplicate posts and late answers behave (one resume, assumptions recorded, 409 after the run ends).
- Video captions over 12 words are shortened by Claude before the compliance check; the fallback never cuts mid-phrase.
- Shortened evidence ids in Claude's prose ("ev_x_02" for "ev_x_02_52d515") are repaired, so every citation resolves; `pnpm eval-all` checks it.
- Rendering an imported run on another machine rebuilds missing frames instead of failing.
- Reviews are calibrated: an unchanged shot keeps its previous score unless the reviewer names a new defect.

## Known issues
- **fal account balance is exhausted** (fal answered "User is locked. Exhausted balance" at 03:24 when our ledger showed $7.25 of the $8 cap, so the account had less than our cap). Final renders now fall back to stills with a warning, and the engine stops calling fal for the rest of the process. Top up fal (event credits) before rendering more motion. Motion fell back to Higgsfield (Kling image-to-video), which rendered the Dynova flagship and part of Evreon's, until Higgsfield reached its $8 cap (ledger estimates) at about 04:15. New final renders now keep stills with camera moves (a warning event says so) until fal is topped up or the cap is raised.
- **Sora**: the OpenAI video endpoint returns 404 for our key (model listed, API not enabled). `soraClip()` is ready if access is enabled.
- **Remotion** composition is in `remotion/` but timed out loading in headless Chrome here; the same Ad916 spec renders with sharp + ffmpeg (fast, no browser). `RENDERER=remotion` retries it.
- **Review scores move by up to ~20 points between reviews of an unchanged shot** (model judgment). The repair pass keeps the best version of each shot; the last review is the shipped cut.
- **Blueprint frames of third-party videos** exist only on this machine (`data/`, never committed). Other machines show placeholders; blueprint JSON is in the repo.
- Evreon and Dynova research passes ran without new Manus tasks (Manus credits); their Manus slot is empty in the recorded data.
- `pnpm eval-all` now also checks concept language and caption readability (video captions 12 words max, slides 40). One b-roll draft in the a.clinic live run was over that and was shortened (compliance re-checked); new runs shorten wordy video captions before the compliance check. Otherwise it passes for every current run; the two superseded early Hound runs (`run_mv4dl43id902ec6a1f`, `run_mv4cox1z4e0569d023`) predate the consultation fix and cite skipped answers as "you said". Use `run_mv4e0ud7671d68be0a` for Hound.
- In the recorded full runs the consultation questions were **skipped by script** (no human), so plans say "assuming ...". In the demo a person answers.
- `pnpm build` passes; Turbopack prints file-tracing warnings for dynamic asset paths (harmless locally).
- Starting the dev server resumes interrupted runs only if their heartbeat is stale and they were interrupted less than 6 hours ago (older ones are marked failed, never resumed, so no surprise spend).

## Spend per provider (ledger, 12 Oct 04:36; caps from .env)
| Provider | Spent | Cap |
|---|---|---|
| Anthropic | $11.21 | $150 |
| OpenAI | $12.74 | $60 |
| fal | $7.25 (account balance ran out) | $8 |
| Higgsfield | $8.00 (estimates, cap reached) | $8 |
| Apify | $2.33 | $4 |
| Firecrawl | $0.07 | $3 |
| YouTube | $0 (free quota) | none |
| Spiral | credits (~20 ads analysed) | none |
| Manus | 3 lite tasks (credits) | 500 credits |
