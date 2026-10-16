# OSS repos for AI ad + carousel generation (research 2026-10-16)

Scope: open-source repos that generate static image ads and multi-slide carousels, start from competitor / winning ads (Meta Ad Library, ad cloning), and render text deterministically on top of AI imagery.

Method: `gh search repos` (15+ queries) plus WebSearch, then `gh api` for metadata. Six repos shallow-cloned (media files excluded via sparse checkout) to `/Users/mete/Desktop/Programs/rekampols-research/repos/`. Nothing was installed, built or executed. Four more repos were read via README only (marked "README only").

Verification legend: **[V]** = read in the cloned source or fetched README this session. **[U]** = unverified (prior knowledge or third-party summary).

Honest caveat: this space has very few high-star repos. Most "AI ad generator" repos are < 30 stars and many are Claude Code skills rather than apps. Star counts below are from the GitHub API on 2026-10-16.

---

## 1. Repo table

| # | Repo | Stars | License | What it does | What to steal |
|---|---|---|---|---|---|
| 1 | [krusemediallc/arcads-claude-code](https://github.com/krusemediallc/arcads-claude-code) (cloned) | 1608 | MIT | Claude/Cursor workspace of skills around the Arcads API: `image-ad-clone` (reverse-engineer a winning ad into a template), 37-template static-ad prompt library, gpt-image-2 and Nano Banana generators, Meta Ad Library to Airtable importer, Meta ad deployer. | The 10-phase ad-clone workflow, the `[BRAND]` vs `[STRUCTURE]` split, the placeholder vocabulary, the 3 always-on safety suffixes, model routing (typography to gpt-image-2, photoreal to Nano Banana), the 37 format templates. **Best single source.** [V] |
| 2 | [Hainrixz/open-carrusel](https://github.com/Hainrixz/open-carrusel) (cloned) | 483 | MIT | Next.js 16 local app: chat with Claude Code CLI (spawned as subprocess) which writes each slide as body-level HTML via curl to a local API; Puppeteer screenshots slides to PNG at exact IG sizes. | HTML/CSS slide contract, Puppeteer export with inlined fonts + images, brand config type, 8-slide narrative arc prompt, safe-zone overlay, per-slide undo stack, chat-drives-REST-API pattern. [V] |
| 3 | [athcagithub/SlideSmith](https://github.com/athcagithub/SlideSmith) (cloned) | 335 | **PolyForm Noncommercial** (do not reuse code commercially) | TikTok/IG slideshow generator: LLM (OpenRouter) writes words only, slides drawn on HTML canvas over gradient or scraped Pinterest backgrounds, scheduled + analytics via post-bridge. | "LLM writes words, renderer draws pixels" split; a single caption-style constants file shared by preview and export; "style memory" field fed back into the prompt; batch JSON generation with `rationale` per item. Ideas only, not code. [V] |
| 4 | [RamsesAguirre777/facebook-ads-library-mcp](https://github.com/RamsesAguirre777/facebook-ads-library-mcp) (cloned) | 275 | MIT | FastMCP server; crawl4ai headless Chromium renders the public Ad Library web page, scrolls, converts DOM to markdown, regex-parses ad cards. No token. | Works outside EU/UK (where the official API returns only political ads). Output fields incl. `started_running` and `ads_using_creative` = the two "winner" signals available without spend data. [V] |
| 5 | [DV0x/creative-ad-agent](https://github.com/DV0x/creative-ad-agent) (cloned) | 120 | MIT | Claude Agent SDK orchestrator: research subagent (scrape brand homepage) to hook-methodology skill to art-style skill to fal.ai Nano Banana Pro MCP; 6 ad images; Express + React client; Cloudflare deploy; session fork for A/B. | Research brief schema, hook-bank format with mandatory `Source:` traceability, variety check, structured image-prompt template with exact-text typography block, session forking. [V] |
| 6 | [norahe0304-art/30x-image](https://github.com/norahe0304-art/30x-image) (cloned) | 31 | MIT | Codex/Claude skill: brand `DESIGN.md` (token frontmatter + numeric `taste:` block) + 8 templates incl. `carousel` + combinatorial axes + anti-slop banned list, generated with gpt-image-2. | Carousel axes (pattern, cover style, body rhythm, continuity mechanism, narrative tension curve), parallel per-slide generation with a shared prompt prefix, anti-slop list, `taste:` numeric knobs. [V] |
| 7 | [johnnyang0612/bearcarousel](https://github.com/johnnyang0612/bearcarousel) (README only) | 3 | Apache-2.0 | Python/Pillow IG carousel renderer from JSON with a red/yellow/green **audit gate** (alignment, WCAG contrast, copy length, logo, whitespace, safe area, CTA count). | The audit rule list with numeric thresholds; content x template x brand JSON layering; output file names `s01_hook.png`. [V README] |
| 8 | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) `skills/ad-creative` (README/SKILL only) | 55098 | MIT | Very popular marketing skill pack. `ad-creative` skill: 4 modes incl. grounded static batches and a creative strategy loop; platform char limits; a single-file **creative review page** HTML template driven by a JSON block. | Grounded inputs folder (`winning-ads/`, `reviews/`, `comments/`), "stop if empty" rule, platform copy limits table, review-page JSON data model (concepts, frames for carousel storyboard, headline variants, grounding disclosure). [V SKILL.md + reference] |
| 9 | [dijiclick/claude-ad-studio](https://github.com/dijiclick/claude-ad-studio) (README only) | 2 | none stated | Claude Code skill: pull competitor ads from Ad Library, **rank by days running**, deconstruct winners (frames + timed transcript), anti-slop gate before paying for generation, ship 5 hooks per ad. Mentions Turkish support. | "Days running" as the un-fakeable winner metric; "1 body + 5 hooks" output shape with kill/scale plan; pre-generation prompt lint gate. [V README; code not read] |
| 10 | [creatify-ai/static-ad-concept-generator](https://github.com/creatify-ai/static-ad-concept-generator) + [ad-creative-evaluator](https://github.com/creatify-ai/ad-creative-evaluator) (README only) | 38 / 32 | MIT | Skills: 16 ad angles + 320+ concept templates + 10 static visual styles; evaluator = 3 personas x 8 weighted dimensions (hook and CTA weighted highest). | Angle taxonomy; persona-panel scoring with "disagreement analysis" as an LLM-judge QA step. [V README] |
| 11 | [vercel/satori](https://github.com/vercel/satori) | 14092 | MPL-2.0 | HTML/JSX + CSS subset to SVG; pair with `@resvg/resvg-js` for PNG. No browser needed. | Fastest serverless text-overlay renderer. Flexbox only (no CSS grid), fonts must be passed as buffers (TTF/OTF/WOFF). [stars/license V, capabilities U] |
| 12 | [owainlewis/vertica](https://github.com/owainlewis/vertica) (README only) | 16 | MIT | Carousel studio: deck = small JSON doc, 3 themes, 4 layouts, exports PDF / numbered JPEGs / per-slide MP4 / joined Reel. | "Deck is a JSON doc an LLM can write" contract; numbered export. [V README] |
| 13 | [Anil-matcha/Open-AI-Design-Agent](https://github.com/Anil-matcha/Open-AI-Design-Agent) (README only) | 454 | MIT | Lovart-style design agent routing to 200+ models via MuAPI (paid aggregator). | Mostly a MuAPI funnel; low value beyond "planner then multi-model generate". [V README] |
| 14 | [proxy-intell/facebook-ads-library-mcp](https://github.com/proxy-intell/facebook-ads-library-mcp) | 315 | MIT | Another Ad Library MCP. | Not inspected; backend unknown [U]. |
| 15 | [polotno-project/polotno-node](https://github.com/polotno-project/polotno-node) | 15 | none in repo | Export Polotno JSON designs to image/PDF in Node. | Polotno SDK itself needs a commercial key for production [U]. Skip for a hackathon. |

Also seen but low value: `IamRamgarhia/OpenAdKit` (26, MIT), `Simonstorms/slidelot` (8, TikTok carousels with feedback loop), `real-simple-labs/1000-winning-ads` (9, swipe file of top 5 Meta ads from 200 DTC brands, HTML), `kalilfagundes/meta-ads-competitor-tracker` (3, MIT, self-hosted tracker). Not read.

---

## 2. Patterns worth adopting

### 2.1 Winning-ad sourcing (what counts as a "winner")

- **Official API is useless outside EU/UK for commercial ads.** RamsesAguirre README: `ads_archive` returns political/issue ads worldwide and all ad types only for EU/UK. arcads importer README independently notes an `ALL`-country query returned empty and only explicit UK/EU country lists worked (tested with `v26.0`, `ACTIVE`, `IMAGE`). For Turkey-targeted brands the API path likely returns nothing; scrape the web UI instead. [V both READMEs; Turkey implication is inference]
- **Scraper recipe** (`repos/facebook-ads-library-mcp/facebook_ads_mcp_complete.py`): crawl4ai `AsyncWebCrawler`, wait ~8 s for SPA hydration, N rounds of `window.scrollTo(0, document.body.scrollHeight)` + 2.5 s wait (first paint only ~20-26 cards), serialize DOM to markdown, split on `Library ID:`, regex out fields, dedupe by library ID, unwrap `l.facebook.com` redirect to get landing URL. FB returns HTTP 403 to headless but still serves cards, so judge success by "cards parsed", not status code. Keyword search is more reliable than the page-id "all ads" view. [V]
- **Winner signals without spend data**: `started_running` date (longevity, "days running") and `ads_using_creative` (how many ads share the creative = scale). claude-ad-studio explicitly ranks by days running ("the one metric advertisers can't fake"). arcads `pull-competitor-ads.py` exposes Ad Library sort options `impressions_high_to_low`, `longest_running`, `most_recent`. [V]
- **Own-account winners** (`repos/arcads-claude-code/shared/skills/meta-ad-builder/scripts/pull-top-ads.py`): Insights API at `level=ad`, fields spend/impressions/clicks/ctr/cpc/cpm/actions/action_values, filter `spend > 0`, compute ROAS = purchase value / spend, drop ads under `--min-spend` (default 50), sort by ROAS or spend, then fetch each top ad's creative copy. [V]
- **Human-in-the-loop extraction** (`repos/arcads-claude-code/scripts/meta-ad-library-import/README.md`): snapshot pages contain profile pics, carousel cards and video posters, so the size/CDN check yields *candidates* only; an agent must open each file, set `visually_reviewed: true`, pick `asset_index`, and only then write a recreation prompt. Reject snapshots containing video unless `static_image_confirmed: true`. Prompts are labelled "untested" unless actually regenerated. Meta CDN URLs expire, so re-host promptly. [V]

### 2.2 Ad cloning: winner to reusable template (arcads `image-ad-clone`)

Files: `repos/arcads-claude-code/skills/image-ad-clone/SKILL.md`, `repos/arcads-claude-code/shared/skills/image-ad-clone/prompting/guide.md`. [V]

10 phases: (1) preflight + pick backend, (2) structural visual analysis, (3) faithful v1 prompt, (4) generate with the original as `--image-ref`, (5) compare + iterate, **cap 4 iterations**, (6) generalize into placeholders, (7) test the generalized template on a *different* brand, (8) cross-validate on the other model, (9) document, (10) append to library, never silently overwrite.

Phase 2 analysis checklist (steal verbatim as a vision-LLM schema): aspect ratio, format type ("what this ad pretends to be": editorial, comparison table, fake search, native UI mimic...), layout regions, typography *feel* (not font names), 3-6 hex colors flagged brand vs neutral, photography style + lighting/lens, **every visible text string verbatim**, decorative elements, and for each item a `[BRAND]` or `[STRUCTURE]` tag, plus "chrome to strip" (Sponsored badge, engagement rows, status bar).

Placeholder vocabulary: `{brand.name}`, `{brand.color_primary}`, `{brand.color_accent}`, `{brand.product_image_description}`, `{brand.tagline}`, `{brand.competitor_category}`, `{ad.headline}`, `{ad.subcopy}`, `{ad.body}`, `{ad.cta_phrase}`, plus template-specific arrays like `{rows[]}`, `{checklist_items[]}`.

Library entry schema (`shared/skills/image-ad-prompting/prompting/template-format.md`): tag `T<n> - <format noun phrase>`, When to use, Aspect ratio, Reference image guidance, Variables, Template prompt, Example fill, **Model notes per backend**, Validated example path.

The 37 shipped formats (`prompt-library.md`) are a ready-made "format taxonomy" for classifying competitor ads: Apple Notes listicle, editorial article hero, fake Google search, comparison table light/dark, sticky-note flatlay, whiteboard comparison, annotated features with arrows, letter board, fake comment thread, fake ChatGPT chat, before/after split, fake Slack, ingredient collage, stacked-bar with/without, old-way/new-way flowchart, fake AirDrop, IG Q&A sticker, handwritten napkin testimonial, POV calendar, receipt, founder letter, Hinge card, billboard mockup, scratch-off ticket, pain-point checklist, bold typography quote, iMessage, magazine cover, weather-app UI, big stat + chart, museum exhibit.

### 2.3 Image model routing and prompt structure

- **Routing rule** (arcads): typography-heavy / UI mimicry / dense small text -> `gpt-image-2`; photoreal handheld objects, lifestyle, multi-reference blending (logo + product + style), clay/3D -> Nano Banana (`nano-banana-2` default, `nano-banana-pro` for identity lock, `nano-banana-edit`). When unsure, generate on both and record model notes. [V]
- **Aspect ratio gotcha** (arcads library, live-validated 2026-05-25): on the Arcads endpoint only `1:1`, `16:9`, `9:16`; KIE gpt4o-image only `1:1/2:3/3:2`; KIE Nano Banana supports `4:5` natively. Fallback: render `1:1` or `9:16` and post-crop to `4:5` / `1.91:1`. [V]
- **fal.ai Nano Banana Pro** (`repos/creative-ad-agent/server/lib/nano-banana-mcp.ts`): `fal.subscribe("fal-ai/nano-banana-pro", {prompt, num_images:1, aspect_ratio, resolution:'1K'|'2K'|'4K', enable_web_search})`, auto-switches to `fal-ai/nano-banana-pro/edit` when reference images are passed. Generates 6 images as 2 batches of 3. [V]
- **Prompt skeleton** (`repos/creative-ad-agent/agent/.claude/skills/art-style/workflows/soft-brutalism-clay.md`): `FORMAT` (ratio) / `SCENE` (one hero visual metaphor) / `MATERIALITY` / `COMPOSITION` (negative space %, border px + hex, visual hierarchy order) / `TYPOGRAPHY` (HEADLINE "EXACT TEXT IN CAPS", weight, hex, position; SUBTEXT ...) / `LIGHTING` / `MOOD` (incl. what it should NOT feel like) / `TECHNICAL`. Text-rendering rules for Nano Banana: exact text in quotes, ALL CAPS, explicit weight, explicit position, **2-4 word headlines**. [V]
- **Always-on safety suffixes** auto-appended by the generator scripts (`repos/arcads-claude-code/skills/nano-banana-image-ad/scripts/generate_image.py`, constants `NO_CHROME_SUFFIX`, `SAFE_ZONE_SUFFIX`, `GLYPH_SAFETY_SUFFIX`; text in `shared/skills/image-ad-prompting/prompting/safety-suffixes.md`): (a) render only the standalone creative, no Sponsored row / likes / status bar / caption; (b) all text and focal subjects inside the central 84% (~8% padding), scale subject down rather than crop; (c) no emoji or unicode inside body-text blocks and render the EXACT count of chat bubbles/comments. ~1,575 chars total. Cheap to copy into any pipeline. [V]
- **Known limit, from their own testing**: dense small text still garbles on both gpt-image-2 and Nano Banana; "the fix is fewer words, not more rules". Keep chat/response bubbles to 3-4 short lines. [V]
- **Anti-slop list** (`repos/30x-image/skills/30x-image/references/anti-slop-rules.md`): inject a trailing `ANTI-SLOP CONSTRAINTS:` block: no yellow tint, no purple/blue neon glow, no gradient blobs, no Inter unless brand uses it, no pure #000, no "Elevate/Seamless/Unleash/Reimagine/Next-Gen/Empower", no fake round numbers ("10x", "99.99%"), no Acme/John Doe placeholders, no 3-equal-cards row, no plastic skin. Plus append the brand's own "Don't" list. [V]

### 2.4 Text on images: model-rendered vs deterministic overlay

Three camps observed:

| Approach | Repos | Notes |
|---|---|---|
| Model renders the text | creative-ad-agent, arcads, 30x-image | Works for 2-4 word headlines and UI-mimic formats on gpt-image-2. Fails on dense copy, exact counts, Turkish diacritics [U, untested]. |
| HTML/CSS -> Puppeteer screenshot | open-carrusel | Pixel-exact, real fonts, LLM writes HTML. Heavy (Chromium). |
| Canvas / Pillow draw | SlideSmith (browser canvas), bearcarousel (Pillow, measured ink boxes) | Deterministic and cheap; layout flexibility limited to templates. |
| Satori + resvg | none of the cloned repos use it | Lightest serverless option [U]. |

Concrete Puppeteer export recipe (`repos/open-carrusel/src/lib/export-slides.ts`, `src/lib/slide-html.ts`): [V]
1. LLM writes **body-level HTML only** (no `<html>/<head>/<body>`), inline styles, no JS, exact px size.
2. `wrapSlideHtml()` is the single shared contract for both iframe preview and export: sets `html,body {width;height;overflow:hidden}`, reset CSS.
3. `extractFontFamilies()` regexes `font-family` declarations; preview uses Google Fonts `<link>`, export inlines base64 `@font-face` CSS (no network race).
4. `/uploads/...` image paths inlined as data URIs.
5. Singleton browser, restart every 50 exports; `setViewport({width,height,deviceScaleFactor:1})`, `setContent(..., {waitUntil:'domcontentloaded'})`, wait for `document.fonts` all loaded (10 s timeout, proceed anyway), `screenshot({clip})`, then `sharp().toColorspace('srgb')`. Concurrency 3.
6. Sizes: `1:1` 1080x1080, `4:5` 1080x1350, `9:16` 1080x1920. Max 20 slides, 5 undo versions per slide.

SlideSmith (`repos/SlideSmith/src/lib/captionStyle.ts`, `src/lib/render.ts`): one constants file (font size 2.7% of height, stroke 0.08 x font, line-height 1.2, side pad 8%) consumed by BOTH preview CSS (container query `cqh` units) and canvas export, so preview == export. Image backgrounds get a `rgba(0,0,0,0.45)` darkening layer for white text; TikTok-style white text with black stroke. [V] (License is noncommercial: copy the idea, not the code.)

**Hybrid that none of them fully does but all point to**: AI model generates the *textless* hero image (or a background plate with reserved negative space), then a deterministic renderer lays headline/CTA/logo on top. creative-ad-agent's "40%+ negative space, hero object on the right" composition rules are exactly the prompt you would use for a textless plate.

### 2.5 Carousel structure

- **open-carrusel default arc** (`src/lib/chat-system-prompt.ts`): S1 HOOK (question / bold stat / contrarian, max 8 words, 64-96 px) -> S2-3 setup/problem -> S4-6 one insight per slide (36-48 px heading, 24-28 px body) -> S7 summary/transformation -> S8 CTA ("Save this", "Share with someone who needs this"). Rules: max 2 font families, contrast > 4.5:1, 60-80 px padding, one message per slide, vary backgrounds, swipe indicator on slide 1, keep key content in center 80% because the 4:5 slide is center-cropped to 1:1 on the profile grid. "Optimize hook" = generate 3 alternatives (question, statistic, bold statement). Caption 150-300 chars + 20-30 hashtags tiered by reach. [V]
- **30x-image carousel axes** (`references/combinatorial-axes.md` from line 414): Pattern {how-to, listicle, hot-take rebuttal, case study, before-after/myth-vs-reality}; Cover {hook headline at display size, provocative question, number promise, visual hook + headline}; Body rhythm {all-text, 50/50 text+visual, full-visual + caption, data-viz}; Continuity mechanism {e.g. shared grid + "1/8" markers, repeated brand anchor}; **Narrative tension curve** {flat, build-up, push-pull, reveal, linear 4-act}, with defaults: listicle -> build-up or flat, hot-take -> reveal, case-study -> linear, before-after -> push-pull. Slide N-1 is the "payoff" and gets the larger headline. [V]
- **Consistency across AI slides** (30x-image SKILL.md Step 4B): build ONE shared prompt prefix (palette, typography, continuity axis), then fire all N slides **in parallel as independent generations**, each = prefix + `THIS SLIDE: slide N of n, role: <cover|body-N|cta>, subject, copy: "<verbatim>"`. Explicitly do NOT chain edits from slide 1 (traps gpt-image-2 in "webpage layout" mode) and never produce one composite grid image. Write a `manifest.json` with roles, per-slide prompts and slide-1 hash. [V]
- **SlideSmith JSON** for N slideshows: `{hook, slides[5-6, each <= ~8 words, last is CTA], caption, hashtags[3], rationale}`, generated in batches of 6 to avoid truncated JSON. [V]
- **bearcarousel frameworks**: `aida-teach`, `pas`, `case`, `contrast`, `listicle`, `story`; 4 layout patterns hook / photo / list / mockup. [V README]

### 2.6 Brand kit handling

- open-carrusel `BrandConfig` (`src/types/brand.ts`): `{name, colors:{primary, secondary, accent, background, surface}, fonts:{heading, body}, customFonts[{name,path}], logoPath, styleKeywords[]}`; injected into the system prompt every turn. Style presets = `{name, designRules (prose), exampleSlideHtml (first 500 chars), aspectRatio}` saved by the agent itself via API. [V]
- 30x-image `DESIGN.md`: YAML token frontmatter (colors with roles, typography scale with weight/letter-spacing, rounded, spacing, components) + numeric `taste:` {variance, density, art_direction, spacing, imagery_realism, text_density_in_image} each 1-10 + 9 prose sections incl. "Do's and Don'ts". Init mode builds it from a URL; `npx getdesign add <brand>` pulls 60+ prebuilt brand profiles. QA: primary color visibly dominant, typography matches section 3, no anti-slop violations, mood matches `taste`. [V]
- creative-ad-agent research brief extracts brand colors (hex if visible), brand voice (formal/casual, serious/playful, technical/accessible, confident/humble), exact headline/tagline/CTA strings from the homepage. [V]
- bearcarousel brand JSON holds colors incl. `accent_light` (because saturated accents on near-black often fail contrast), fonts, logo `{path, corner, margin_x, center_y, height}`, and **all audit thresholds**. Engine has zero brand constants. [V README]

### 2.7 Copy / hook generation grounded in facts

- creative-ad-agent hook format (`agent/.claude/skills/hook-methodology/SKILL.md`): each hook = `Type` (10 types: question, surprising stat, pattern interrupt, controversial, direct address, social proof, problem-solution, contrast, FOMO, curiosity) + **`Source` (exact research section + element)** + `Target` (ICP segment) + Hook (< 10 words) + Body (1-2 sentences, adds ONE proof element not in hook) + CTA (action verb + implied outcome: "See your options" not "Learn more") + Psychology. Variety check: >= 3 hook types, proof points/products/value props each used at least once, >= 3 emotional territories. 5-question validation: traceable, owned (could a competitor reuse it by swapping the logo?), felt, clear in 3 s, uses their words. "Invention trap": no claim without a source. [V]
- arcads `copy-guide.md`: Meta text liquidity shape `{bodies[5], titles[5] (~40 chars), descriptions[3] (30-50 chars)}`, 5 body angles: Reveal/Story, Math/Before-After, Fresh Hook, Ultra-Short CTA, (fifth not read). [V partial]
- marketingskills `ad-creative`: grounded inputs folder and "if `inputs/winning-ads/` or `inputs/reviews/` is empty, stop and ask, never generate ungrounded"; Meta limits: primary text 125 visible / 2200 max, headline 40, description 30; TikTok ad text 80-100. [V]
- claude-ad-studio: ship one body + 5 hooks (objection, secret, myth-bust, live reaction, A/B) with a kill/scale test plan. [V README]

### 2.8 QA / scoring of outputs

- **Deterministic audit** (bearcarousel, numbers are defaults from `brands/_blank.json`): title centre drift > 10 px red; logo centre-of-mass off > 5 px red; WCAG contrast vs the actual pixels behind text < 4.5 yellow, < 3 red; photo slide with unstroked text red; title > 2 lines red; > 12 chars per line red (20 if it contains a number, 6 on cover); slide > 30 chars red, < 15 yellow; bullets outside 3-5 or > 18 chars red; no concrete number yellow; no logo red; logo > 8% canvas yellow; > 3 chromatic colours red; < 40% whitespace red; body inside top/bottom 150 px red; emoji red; > 1 CTA red, CTA not last yellow; slide 1 not a hook yellow. Every finding carries `fix`, measured value, threshold. CLI `audit` exits 1 on any red. [V README] Directly portable to an HTML-rendered pipeline (measure DOM boxes instead of Pillow).
- **LLM-judge panel** (creatify evaluator): 3 personas (performance marketer "will it convert?", creative director "is it well-crafted?", target consumer "would I watch?") x 8 dimensions (hook, message clarity, visual, audience, pacing, CTA, emotion, sound-off) 1-10, hook + CTA weighted highest; persona disagreements surfaced as the most actionable output. For statics drop pacing/sound-off. [V README]
- **Pre-generation lint gate** (claude-ad-studio): fail a prompt before spending credits if required realism layers are missing. [V README]
- **Round-trip validation** (arcads): a template is not "validated" until regenerated against the original and against a second brand; model notes record failures. [V]
- 30x-image: hand-judge 4 on-brand checks, re-pick axes on any "no". [V]

### 2.9 Admin / chat UI patterns

- **Chat drives a local REST API** (open-carrusel `src/app/api/chat/route.ts`): spawn `claude -p <msg> --output-format stream-json --include-partial-messages --append-system-prompt <dynamic brand+carousel prompt> --allowedTools Bash WebFetch Read --max-budget-usd 1.00 --resume <sessionId>`; the agent creates/updates slides by `curl` to `/api/carousels/{id}/slides`; the UI live-updates the filmstrip. Per-turn system prompt is rebuilt from current brand + carousel state + style preset. Reference images listed with absolute paths so the agent can `Read` them. [V]
- **Staged actions**: exports go through `{type:'export_png', status: pending|approved|executed|failed|rejected, autoExecute}` so a human approves side effects. [V]
- **Session fork for A/B** (creative-ad-agent `server/lib/session-manager.ts`): `forkedFrom`, `forkPurpose` ("emotional-angle-variant"), list all forks of a base session for comparison; uses Agent SDK `resume`. Lesson in `docs/LESSONS_LEARNED.md`: subagents inherit MCP tools only if the `tools:` field is omitted; keep the prompt async generator alive until tool calls finish or MCP returns "Stream closed". [V]
- **Client review page** (marketingskills `references/creative-review-page.md`): single self-contained HTML, everything rendered from one `<script type="application/json" id="review-data">` block: `project{brand, date}`, `platforms[instagram|facebook]`, `concepts[{name, tagline, frames[{label:"Hook", prompt, image, headline, headlineTheme}], headlines[] (toggle variants), primaryText, destination{url, cta, offer}, grounding}]`. Multi-frame = carousel storyboard; renders in-feed mockups. [V]
- SlideSmith: Brain view (niche, audience, style memory) / Queue / Schedule / Results (post-bridge analytics) / Library (bundled packs + Pinterest via Apify actor `fatihtahta/pinterest-scraper-search`). [V]

---

## 3. Suggested assembled pipeline (inference, not from any single repo)

1. Brand intake: scrape site -> research brief (creative-ad-agent schema) + brand kit JSON (open-carrusel `BrandConfig` + 30x-image `taste` knobs).
2. Competitor winners: Ad Library web scrape (crawl4ai pattern) for keyword/brand in the target country -> rank by days running and `ads_using_creative` -> vision-LLM classifies each into the 37-format taxonomy and fills the `[BRAND]/[STRUCTURE]` analysis.
3. Concepts: hooks with mandatory `Source:` lines, >= 3 types; for carousels pick pattern + tension curve.
4. Visuals: textless hero plates from Nano Banana (photoreal / product refs) or gpt-image-2 (UI mimic formats where the text IS the image), with the 3 safety suffixes + anti-slop block.
5. Layout: HTML/CSS template per format, rendered by Puppeteer (or satori+resvg) at 1080x1350 / 1080x1080 / 1080x1920 with brand fonts inlined.
6. QA: bearcarousel-style deterministic audit on the rendered DOM + persona-panel LLM judge; regenerate on red.
7. Review: single-file JSON-driven review page with carousel storyboard and headline toggles.

---

## 4. Clones on disk

```
/Users/mete/Desktop/Programs/rekampols-research/repos/
  arcads-claude-code/        (MIT)
  open-carrusel/             (MIT)
  SlideSmith/                (PolyForm Noncommercial)
  facebook-ads-library-mcp/  (MIT)
  creative-ad-agent/         (MIT)
  30x-image/                 (MIT)
```
Media files (png/jpg/mp4/fonts/pdf) were excluded via sparse checkout, so example images referenced in READMEs are missing locally.
