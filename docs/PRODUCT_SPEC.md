# Product spec

Working name in code: **nexus** (product name TBD; keep it a single constant `PRODUCT_NAME` in each app so it can be renamed in one place).

## 1. The problem (first person, real)
We run several brands at once: a.clinic (telehealth weight care, Slovakia/Czechia), Hound (dog-training app), Dynova (Turkish genetic-test + supplements DTC), Evreon AI (B2B clinic software), plus Duna Yazılım, Puzzles Software, Anytomic. Every one needs the same thing: a go-to-market machine that decides where to show up and produces content that wins there. None of us is a creative director or media buyer. Today it is "ask Viktor, open Spiral, ask GPT which ads are winning, hire freelancers". Founders in our own community burn money on 30-second Reels with Claude Code + Higgsfield and do not get the result they want.

Existing tools each do a slice: Spiral (app ad research + generation + Meta upload), Runway Ads (remake/variations/publish/measure on Meta, Google, TikTok, launched 30 Sep 2026), Meta's own assistant. None of them: decides the channel mix from evidence, reads the business's real revenue/product data, runs many brands with different legal regimes, or works on day zero with no ad history.

## 2. The loop (what the product does)

```
 ENTER ──> CONNECT ──> GATHER ──> CONSULT ──> DIRECT ──> PRODUCE ──> CHECK ──> PACK ──> MEASURE ──> LEARN
 (URL)    (data src)  (agent)    (interview) (channels) (content)  (legal)   (post)   (results)   (memory)
```

### 2.1 Enter
- Operator pastes a URL (or picks a seeded brand). Optional: name, vertical, target countries/languages.
- Engine creates the Brand and starts an `intake` run immediately. The UI shows the crawl live.

### 2.2 Connect
- Provider tiles per brand: Apify, Manus, RevenueCat, PostHog, Stripe, Paddle, Meta Ads, Instagram, TikTok, YouTube, Spiral, Google Analytics.
- Each tile has three states: **Live** (key present and verified), **Demo** (no key: deterministic labelled fixtures), **Missing** (not applicable). The operator can run the whole loop with zero connections (day-zero mode); every connection makes the output sharper.
- Global keys come from `.env`. Per-brand connections store which account/project to read (e.g. RevenueCat project id, PostHog project id, Instagram account id).

### 2.3 Gather (agent research)
The engine agent (Claude with tools) builds an evidence base. Every item is stored as an `Evidence` row with source URL and capture time.
- **Site:** crawl the brand site (Apify `apify/website-content-crawler` or direct fetch + readability). Extract offer, pricing, proof, CTAs, tone, languages, visual identity (colors/logo from CSS/meta).
- **Competitors:** identify 5 to 10 from the site, search results, ad library and stores.
- **Paid winners:** Meta Ad Library via Apify (`curious_coder/facebook-ads-library-scraper`, fallback `apify/facebook-ads-scraper`). Longevity is the honest proxy for "works": ads running 30+ days are "proven", 7 to 29 "testing". EU countries return commercial ads (good for SK/CZ).
- **Organic winners:** TikTok (`clockworks/tiktok-scraper` by hashtag/keyword), Instagram Reels (`apify/instagram-scraper` / reel scraper), YouTube Shorts (YouTube Data API search). Rank by **outlier score** = views / median views of that account's recent posts (fallback: views / followers). Outliers are what to learn from.
- **Communities:** Reddit (Apify reddit scraper or public JSON) and forums: which subreddits discuss the problem, top posts, recurring language, rules on self-promotion.
- **Voice of customer:** reviews (Google Maps `compass/crawler-google-places`, App Store / Play reviews, Trustpilot) for pains and phrases in the buyers' own words.
- **Business truth (if connected):** RevenueCat (trial-to-paid, active subs, revenue by country/product), PostHog (funnel steps, top referrers), Stripe/Paddle (paying customers by country/plan), Meta Ads insights (spend, CPA by creative).
- **Deep research (Manus):** one Manus task per run in parallel: "map the go-to-market landscape for <brand> in <countries>" with the Apify connector and a `structured_output_schema` that returns channels, competitors, communities and sources. Its findings become Evidence rows with `source: manus_research` and the Manus `task_url` kept for traceability.
- Each extracted winning item gets a **deconstruction**: hook (first 2 seconds, verbatim if text), format, angle, structure (beats with timings), emotion, CTA, length, language.
- Apify actor IDs above were checked on the Apify store on 11 Oct 2026 only for the Facebook ones; verify the others in the store before relying on them and record the verified IDs in `docs/APIS.md`.

### 2.4 Consult (the anamnesis)
- A chat that feels like a consultation, not a form. One question at a time, large and calm.
- Questions are **generated from gaps** in the dossier and evidence, never from a fixed list. Each question shows **why it is asked** and the evidence that triggered it (e.g. "Your top competitor's longest-running ad is a doctor talking to camera. Can one of your doctors appear on camera?").
- Question kinds: single choice (chips), multi choice, short text, scale, confirm (yes/no with a default). The agent may also accept free text at any point.
- Typical question families: goal for the next 30 days (installs, bookings, demos, revenue); budget for paid (0 is valid); who can appear on camera; claims we can legally make; offers/discounts allowed; tone limits; languages; markets to prioritize; what has been tried and failed; brand assets available.
- 5 to 9 questions per run. Answers update the dossier immediately and are cited later ("because you said ...").
- The operator can skip; the agent proceeds with a stated assumption.

### 2.5 Direct (the GTM decision, the core of the product)
The agent produces a **Channel Plan**: where to go, in what order, why, and where not to go.
- Candidate channels: TikTok, Instagram Reels, YouTube Shorts, X, LinkedIn, Reddit (named subreddits), Meta paid, TikTok paid, Google Search paid, email/newsletter, SEO/content, partnerships/communities (named), app-store optimization (apps).
- Score each 0 to 100 on: audience presence (evidence volume of the ICP there), proven competitor wins there (outliers/longevity), production fit (can we make this format with our assets), compliance risk (inverted), cost and speed to first signal, business-model fit (B2B vs consumer, ticket size). Weights are explicit in the output.
- Output per recommended channel: priority, mode (organic/paid/both), rationale in 2 to 3 sentences, linked evidence ids, formats to run, cadence, first 3 concrete steps, KPIs, and targets (e.g. exact subreddit names with their self-promo rules; hashtags; creator types).
- `notNow`: channels rejected with the reason (e.g. "Meta paid for a.clinic: prescription weight-loss telehealth needs LegitScript certification and Meta authorization; consumer ads for prescription medicines are banned in SK/CZ").
- The plan is editable (operator can reorder or drop channels) and versioned.

### 2.6 Produce (content that wins)
For each top channel, the agent proposes **Concepts** (3 to 6 per run): format, hook, angle, script, caption, hashtags, CTA, language, and the evidence it remakes.

Video pipeline (cost-controlled; this order is mandatory):
1. **Script + shot list:** 5 to 8 shots of 2 to 6 s for a 15 to 30 s vertical video. Never a single 30 s prompt.
2. **Keyframes first:** one still per shot with an image model (OpenAI image or fal Flux / Nano Banana), brand-consistent via reference images and a fixed style block. Cost: cents.
3. **Approval gate:** operator approves or regenerates keyframes per shot in the Studio.
4. **Animate approved keyframes only:** image-to-video, cheapest tier for drafts (e.g. Kling standard / Seedance lite), premium tier (Kling 3.0 Pro, Seedance 2.0, Higgsfield) only for the final render. Audio off at generation.
5. **Voice + music:** voiceover via OpenAI TTS; music bed from a small royalty-free set in the repo or none.
6. **Assemble in code:** Remotion composition (9:16, 1080x1920, burned captions with safe zones, brand colors, end card with CTA). FFmpeg allowed as fallback.
7. **Cost meter:** estimated cost shown before every render; actual cost logged to the ledger; hard cap per brand per run.

Also: statics (single image + text overlay, 4:5 and 9:16), carousels (3 to 7 frames), text posts (X/LinkedIn/Reddit drafts that follow each subreddit's rules, value-first, no spam).

### 2.7 Check (compliance)
- Every concept, caption, VO line and image prompt is checked against the brand's rule pack (see `docs/BRANDS.md`), by a Claude call with structured output: `pass | warn | fail` with rule ids and the offending excerpt.
- `fail` blocks rendering/export; the agent auto-revises up to 2 times, then flags for the human.
- Platform rules are part of the pack (Meta personal-health policy, TikTok medical misinformation, Reddit self-promotion norms).

### 2.8 Pack and publish
- **Default:** a Publish Pack per post per platform: final MP4 (or images), caption, hashtags, recommended post time, first comment, cover frame, and a checklist. Download as a zip. The operator posts it.
- **Optional auto-post (later):** via a posting aggregator (Upload-Post or Zernio) or Instagram Graph API (Business account) with an explicit human click. TikTok direct posting from an unaudited app is private-only; YouTube uploads from an unverified API project are private-only. The UI states this honestly.
- After posting, the operator pastes the post URL ("mark posted").

### 2.9 Measure and learn
- Metrics per posted pack: views, likes, comments, shares, saves, follows; captured by API where available (Instagram insights with a Business account) or entered manually; timestamps kept so the UI can show "posted 6 h ago: 3,214 views".
- **Never invent numbers.** If nothing is connected, the chart says "waiting for first metrics".
- Learnings: after metrics arrive, the agent writes short insights per brand (what hook/format beat the median) and promotes cross-brand learnings when a pattern holds in 2+ brands.

## 3. Seeded brands (must exist on first boot)
a.clinic, Hound, Dynova, Evreon AI. Dossiers v0 in `docs/BRANDS.md`. Each brand gets a rule pack and default countries/languages.

## 4. Screens (the cockpit)
| Route | Screen | Purpose |
|---|---|---|
| `/` | Landing | The product story; paste a URL to start |
| `/brands` | Portfolio | All brands as living cards: connections, last run, packs ready, posted, views |
| `/brands/new` | Enter | URL in, live crawl animation, brand created |
| `/brands/[slug]` | Brand home | Dossier (editable), connections, runs, results |
| `/brands/[slug]/connect` | Connect | Provider tiles Live / Demo / Missing |
| `/runs/[id]` | Run cockpit | Phase rail + live event stream + evidence wall |
| `/runs/[id]/consult` | Consultation | The anamnesis chat |
| `/runs/[id]/direction` | Direction | Channel plan: ranked channels, scores, evidence, not-now |
| `/runs/[id]/studio` | Studio | Concepts, storyboard with keyframes, approve, render, cost meter, compliance badges |
| `/runs/[id]/packs` | Packs | Ready-to-post packs, download zip, mark posted, enter metrics |
| `/brands/[slug]/results` | Results | Views over time per post, learnings |
| `/settings` | Providers | Provider status, mode, budgets, spend ledger |

## 5. Demo day (what must work at 15:00 on 12 Oct)
1. Portfolio shows the four real brands with real dossiers.
2. A full run on Hound (and a.clinic) in front of the judge: gather (pre-run, replayed live), consultation (3 questions live), direction (channel plan with evidence), studio (keyframes approved, one short render), packs ready.
3. Results screen with real view counts from posts made that morning (manual entry is fine, never invented).
4. Manus visibly doing real work: the deep-research task card links to the live Manus task; optionally Manus builds a campaign landing page.
5. Everything runs on a laptop with `pnpm dev`; a fallback screen recording exists.
