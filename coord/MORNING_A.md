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

## The 2-minute demo path
(to be filled in below with the exact run ids once the overnight live runs finish)

## Live vs demo (overnight)
- `LIVE_PROVIDERS` = anthropic, openai, firecrawl, youtube. fal, Apify, Manus, Spiral, Higgsfield ran only in smoke tests and the recorded live passes.
- Demo data is always labelled (`demo: true`, "Demo data" in the UI, "Demo keyframe" / "Demo render" burned into demo images and videos).

## Known issues
(filled in at the end of the night)

## Spend per provider
(filled in at the end of the night from `/api/spend`)
