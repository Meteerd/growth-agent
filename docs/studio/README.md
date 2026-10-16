# Rekampols Studio

The operator app for paid-social **statics and carousels**. You give it a brand's website, and it does the following:

- builds the brand kit;
- finds the competitors that advertise in your markets;
- pulls the static and carousel ads they are running now;
- takes them apart;
- writes a playbook of what wins;
- makes new ads that rebuild those structures for your brand, written natively, checked against the brand's rules, rendered, and reviewed.

You approve or revise the ads, by hand or by talking to the agent.

- **Live:** https://studio.63-181-87-203.sslip.io (password in `.studio-credentials` on Mete's machine, not in git)
- **Server:** the same Lightsail box as the public site (`/srv/studio`, pm2 process `studio`, port 3100, Caddy with HTTPS and HTTP basic auth). It has its own database, `/srv/studio/shared/studio.db`, and its own files under `/srv/studio/shared/assets`.
- **The public showcase is unaffected.** `/studio` and `/api/studio` do not exist there.

## The funnel

| Step | What happens | Where |
|---|---|---|
| 1. Add a brand | Firecrawl reads the site. Claude writes the dossier. The site's own images are downloaded and classified by Claude vision: logo, product, lifestyle, person. Colours and a headline font are picked. The site is screenshotted on an iPhone viewport for the product shot. Claude with web search finds 5 to 8 competitors that advertise on Meta in your markets, with their Facebook page names, plus category search terms. | `src/engine/studio/setup.ts` |
| 2. Scan | The Meta Ad Library, through Apify, returns each competitor's live ads and the category keyword results. Images, carousels, DCO and the cover frames of video ads are kept. Without spend data, the winner signal is how long an ad has run plus how many ads reuse the same creative (Meta's collation count). | `scan.ts` |
| 3. Teardown | Claude vision takes 4 ads at a time and records format, hook, layout, angle, persona, why it wins, what structure to take, what not to copy, and a strength score. Unrelated ads are flagged. | `analyze.ts` |
| 4. Playbook | Claude turns the teardown into what wins in this market (patterns with evidence), the angles competitors use, white space, category norms and do-nots. | `analyze.ts` |
| 5. Generate | The creative director plans N distinct concepts (diversity rules, at least 3 hook types) from the playbook. Each concept gets its own copywriting call: native language, copy slots per template, image direction, and Ads Manager copy. A compliance gate checks it against the brand's rule pack, with one rewrite allowed. Images are made, the templates draw the type, and Claude vision reviews the result. One automatic fix of the weakest slide follows if the score is under the threshold. | `generate.ts` |
| 6. Approve / revise | Approve, reject, edit the Ads Manager copy, or write feedback. A revision keeps what the feedback doesn't touch, and images whose prompt didn't change are reused. Download gives the PNGs plus `copy.txt`. | UI or chat |

**Autopilot** (the default when adding a brand) runs steps 1 to 5 in one job and ends with 6 ads.

## Why it is built this way (from the research in `research/`)

- **The image never carries the copy.** Diffusion models garble text, and nobody has published Slovak or Czech diacritic tests. Every word is drawn by deterministic templates (`render/templates.ts`) in bundled OFL fonts (sharp + opentype.js, so no browser and no ffmpeg). The model only paints the scene, so the wording is exactly the compliance-approved copy in any language.
- **Format library from Motion's 2025-26 data** (`formats.ts`). It covers Offer-First, testimonial, us vs them, reasons why, notes app, letter, post-it, myth/fact, steps, quiz and UGC caption, and maps each to a template with copy limits. The 12 rules (`RULES`) encode Andromeda-era testing: concept diversity over variants, native over polished, card 1 of a carousel works alone, and no invented numbers.
- **Health compliance is a gate, not a suggestion.** a.clinic runs on `eu_rx_telehealth`: no drug names, GLP-1 or injections, no before/after bodies, no promised kg, and no "you" + condition. Image prompts carry a negative list (pens, pills, scales, bellies). The LegitScript rule for paid Rx telehealth stays as a warning on each ad.
- **Higgsfield is not used.** Its ad products run on GPT Image 2.5 Flare, the same model we call directly, with less control. Its Ads Studio writes its own concepts and copy, which a health brand can't accept, and Marketing Studio has no 4:5. See `research/IMAGE_MODELS.md`.
- **Image models** (per brand, or per batch):

  | Model | Cost per image | Notes |
  |---|---|---|
  | `openai:gpt-image-2`, direct | ~$0.21 | The proven default from the hackathon |
  | `fal:gpt-image-2.5-flare` | ~$0.05 | Same family, newer, cheaper |
  | `fal:nano-banana-pro` | ~$0.15 | Best at keeping a person, pet or product the same across slides |
  | `fal:nano-banana-2.1` | ~$0.06 | |
  | `fal:seedream-5-lite` | ~$0.035 | |

- **Money is capped.** Every paid call goes through the spend ledger, with `BUDGET_USD_*` limits in `/srv/studio/shared/.env`. The Jobs page shows spend per provider.

## Open-source repos studied (and what was taken)

Six repos were shallow-cloned and read on 16 Oct 2026 (`~/Desktop/Programs/rekampols-research/repos/`; full notes in `research/OSS_REPOS.md`). Nothing was run.

| Repo | Taken into the studio |
|---|---|
| krusemediallc/arcads-claude-code (1.6k stars, MIT) | Splitting a winner into brand vs structure (`steal` / `avoid` in the teardown). The format taxonomy used to classify competitor ads. Routing: GPT Image for photoreal scenes, Nano Banana for consistency. |
| Hainrixz/open-carrusel (MIT) | Chat drives the REST API; brand config; a slide contract an LLM fills (here: typed slots per template); and the carousel arc (hook, one idea per slide, sendable slide, CTA). |
| RamsesAguirre777/facebook-ads-library-mcp (MIT) | Winner signals without spend data: days running and `ads_using_creative` (our `winnerScore`). Scrape the public Ad Library instead of the API, which returns only political ads outside the EU and UK. |
| DV0x/creative-ad-agent (MIT) | Every hook grounded in a source (`inspiredBy`), a variety rule (at least 3 hook types), session-style revisions. |
| norahe0304-art/30x-image (MIT) | A shared prompt prefix so carousel slides stay consistent (`visualWorld`), the anti-slop banned list, and generating slides in parallel instead of chaining them. |
| athcagithub/SlideSmith (non-commercial licence: ideas only) | "LLM writes words, the renderer draws pixels". |
| bearcarousel, creatify evaluator (READMEs) | A deterministic audit before the LLM judge (our contrast audit), and multi-dimension scoring with stop power weighted highest. |

## The agent

The chat on the right is Claude Opus 5.5 with 21 tools: add brands, change any config, scan, analyse, read the playbook and competitor ads, generate, revise, approve, check jobs and spend. Long work runs as background jobs, so the agent starts them and reports back. Conversations are stored append-only per thread.

## Run and deploy

```bash
# local dev (the studio routes are on in dev)
pnpm dev                      # http://localhost:3000/studio

# a job from the command line (on the server: cd /srv/studio/app)
pnpm exec tsx scripts/studio/job.ts setup '{"url":"https://a.clinic","countries":["SK","CZ"],"languages":["sk","cs"]}'
pnpm exec tsx scripts/studio/job.ts generate '{"brand":"hound","count":6,"carousels":2}'

# preview every template with sample copy (no API calls)
pnpm exec tsx scripts/studio/render-samples.ts /tmp/samples

# deploy the studio branch to the server
deploy/studio/deploy.sh
```

CI (`.github/workflows/check.yml`) runs `pnpm check` on every push. The `deploy-studio` job deploys the `studio` branch automatically once two repository secrets exist: `STUDIO_SSH_KEY` and `STUDIO_HOST`. Until then it skips.

## Files

```
src/engine/studio/
  types.ts        contracts (config, refs, ads, jobs)
  store.ts        studio tables (drizzle/0002_studio.sql)
  config.ts       per-brand config with defaults, settings, seed
  jobs.ts         in-process background jobs with steps, progress, cost
  handlers.ts     job kinds: setup, scan, analyze, generate, revise, autopilot
  setup.ts        brand from URL
  scan.ts         Meta Ad Library via Apify, winner score
  analyze.ts      vision teardown + playbook
  formats.ts      format library, carousel blueprints, the 12 rules
  generate.ts     plan, write, gate, images, render, review, revise
  images.ts       OpenAI direct + fal queue (Flare, Nano Banana, Seedream)
  render/         type (fonts, fitting) and the 17 templates
  agent.ts        chat agent with tools
  web.ts          Claude + web search (competitor discovery)
src/app/studio, src/components/studio, src/app/api/studio   the admin UI and its API
```

## First night on real brands (16 to 17 Oct 2026)

| Brand | Competitor ads found | Ads made | Review scores | Notes |
|---|---|---|---|---|
| Hound (EN) | 175: Dogo's lesson-card grid runs 109 days in many languages | 10 | 58 to 73 | The first batch was mostly type-only (scores 58 to 69); the playbook-led second batch scored 64 to 73 |
| a.clinic (SK) | 49: supplement networks dominate; real clinics are newer | 6 (+ a revision) | 60 to 70 | Wordmark logo; risky site images (vial, waist) removed; the sticky-note revision went from 61 to 70 |
| Dynova (TR) | 79 | 6 | 63 to 73 | One chat message ran the whole autopilot: $3.66 in total on Flare |

**Measured cost per ad** (including self-revision): about $0.60 to $0.75 on GPT Image 2 direct, and about $0.40 to $0.60 on GPT Image 2.5 Flare. Claude accounts for about $0.25 to $0.40 of that.

**Image bake-off:** one prompt, four models (`scripts/studio/fal-smoke.ts`). GPT Image 2.5 Flare, Nano Banana 2.1, Nano Banana Pro and Seedream 5 Lite all produced believable photos. Flare looked the most candid and native, so it is the default for new brands.

The review scores are deliberately harsh: 85+ means it would hold up next to the best ads in the category. Treat 70+ as ready to test.
