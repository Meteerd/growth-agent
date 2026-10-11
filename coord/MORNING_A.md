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
| all four | `run_<slug>_demo` | Deterministic demo runs (labelled demo), with locally built demo keyframes and review videos. |

## The 2-minute demo path
1. Portfolio: four brands; Hound and a.clinic show their flagship video (`heroVideo`) and "Live data, captured ..." on the latest run.
2. Hound: open the recorded research run and replay it (`/api/runs/run_mv4c9xtr8203508c41/events?pace=150`): crawl, Spiral and Apify sources, relevance filter, deconstruction, Manus task link, blueprints.
3. Reverse-engineer view: the winner's blueprint next to our remake, shot for shot (`concept_1d68be0a_1.shotMap`).
4. Consultation live: start a run on the recorded research (`POST /api/brands/hound/runs {"kind":"full","reuseResearchFrom":"recorded"}`), answer 2 or 3 questions in front of the judge (Claude, live). The rest of that run takes ~10 minutes, so for direction, studio and packs switch to `run_mv4e0ud7671d68be0a` which already finished.
5. Direction: ranked channels with six-axis scores, explicit weights, evidence links, "not now" with reasons.
6. Studio: the flagship video, its keyframes (brand images or photoreal frames), the two review rounds with per-shot scores.
7. Packs: download the zip; show the Manus landing page link on the Hound TikTok pack.
8. a.clinic in 20 seconds: same loop, Slovak content, Meta paid blocked by RX4 with the reason.

## Live vs demo (overnight)
- `LIVE_PROVIDERS` = anthropic, openai, firecrawl, youtube. fal, Apify, Manus, Spiral, Higgsfield ran only in smoke tests and the recorded live passes.
- Demo data is always labelled (`demo: true`, "Demo data" in the UI, "Demo keyframe" / "Demo render" burned into demo images and videos).

## Flagship videos (A17, the hero media)
- **Hound** `concept_1d68be0a_1`: 29 s, six photoreal phone-footage shots remaking a real TikTok myth-vs-fact winner ("Just let them cry it out"? ...), CTA shot holds a phone showing Hound's real beagle art. Review 83/100, every shot >= 80. `docs/renders/hound-flagship.jpg` / `.mp4`.
- **a.clinic** `concept_1e6575ad_1`: Slovak 4-step listicle remake: home, sticky notes, laptop and phone with a.clinic's real doctor art, local pharmacy, checklist, the a.clinic page. Review 82/100, every shot >= 80. `docs/renders/aclinic-flagship.jpg` / `.mp4`.
- How: Claude picks per shot a real brand image or a frame in the winner's look (photoreal for real-footage winners), OpenAI gpt-image-2 renders frames (brand art goes onto screens through an image-edit reference), fal Kling 2.1 animates the shots (screens stay still), ffmpeg composes captions, voiceover and end card, Claude reviews against the blueprint and an AI-tells rubric, weak shots are fixed (keep-best per shot). `pnpm flagship <conceptId> [--repair] [--sheet docs/renders/x.jpg]`.

## Known issues
- **fal is nearly at its cap** ($7.25 of $8, including a $1.00 conservative estimate for clips submitted by a process I stopped). New final renders fall back to animated stills when the cap is hit. Raise `BUDGET_USD_FAL` (event credits) before rendering more.
- **Sora**: the OpenAI video endpoint returns 404 for our key (model listed, API not enabled). `soraClip()` is ready if access is enabled.
- **Remotion** composition is in `remotion/` but timed out loading in headless Chrome here; the same Ad916 spec renders with sharp + ffmpeg (fast, no browser). `RENDERER=remotion` retries it.
- **Review scores move by up to ~20 points between reviews of an unchanged shot** (model judgment). The repair pass keeps the best version of each shot; the last review is the shipped cut.
- **Blueprint frames of third-party videos** exist only on this machine (`data/`, never committed). Other machines show placeholders; blueprint JSON is in the repo.
- **Evreon and Dynova** have demo data only (no live research pass tonight).
- In the recorded full runs the consultation questions were **skipped by script** (no human), so plans say "assuming ...". In the demo a person answers.
- `pnpm build` passes; Turbopack prints file-tracing warnings for dynamic asset paths (harmless locally).
- Starting the dev server resumes interrupted runs only if their heartbeat is stale and they were interrupted less than 6 hours ago (older ones are marked failed, never resumed, so no surprise spend).

## Spend per provider (ledger, 12 Oct 02:35; caps from .env)
| Provider | Spent | Cap |
|---|---|---|
| Anthropic | $7.01 | $150 |
| OpenAI | $7.33 | $60 |
| fal | $7.25 | $8 |
| Apify | $1.38 | $4 |
| Firecrawl | $0.05 | $3 |
| YouTube | $0 (free quota) | none |
| Spiral | credits (~20 ads analysed) | none |
| Manus | 3 lite tasks (credits) | 500 credits |
| Higgsfield | $0 (auth check only) | $8 |
