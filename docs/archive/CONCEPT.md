# Concept: the autonomous growth agent for operators who run many brands

Working name: TBD. Status: **locked direction (11 Oct, 22:00)**. Hero demo: **the clinic + Hound / HuntApp**.

## The problem (ours, first person)
We run several brands at once: the clinic, Evreon AI, the App Studio (Hound / HuntApp), Duna Yazılım, Puzzles Software, Anytomic. Every one of them needs the same thing at its core: ads and a GTM machine. None of us is a creative director or media buyer. Today: ask Viktor, open Spiral, ask GPT which ads are "winning", hire freelancers. It does not scale across six brands and it is not a system.

## The insight
1. Video generation is now good enough to make realistic ads and keeps improving. Ad production gets automated; the question is who owns the loop.
2. Every brand we run already has the inputs: brand, product, analytics, known customer, real revenue. That data sits in RevenueCat, Stripe/Paddle, Supabase, PostHog, Meta Ads. Nobody feeds it back into creative decisions.
3. So: paste your company page, the agent interviews you, reads the niche (winning ads), reads your truth (revenue + analytics), makes the ads, tells you or the platform where to post, reads results, repeats. Across all your brands.

## The loop
1. **Intake**: URL in. Crawl site, ask 5 to 8 questions.
2. **Brand Brain**: persistent dossier per brand (positioning, ICP, voice, offers, proof, vertical rules). Many brands per operator.
3. **Read the niche**: Spiral MCP (app ad intelligence: scaling apps, winning Meta/TikTok ads), Apify (Meta Ad Library, TikTok, Google Maps / app store reviews, Reddit). Ad longevity = proxy for "works". Deconstruct hook, format, structure, offer.
4. **Read the truth**: RevenueCat / Stripe / Paddle / Supabase / Meta Ads. Who actually pays and stays.
5. **Make**: fal.ai renders video + statics remaking winning *structures* for our brand. Canva (TBC) for polished brand statics.
6. **Ship**: posting plan per platform + paused Meta campaign via Meta Ads connector, one click to approve.
7. **Learn**: results back into the Brand Brain; cross-brand learnings transfer.

## Competitors (bounded pass, details in research/landscape-2026-10/)
- **Spiral (spiral.ad)**: the closest. For app marketers: research Meta/TikTok ads, track scaling apps, AI-generate statics and remix video, bulk-launch to Meta, ROAS from Meta ad accounts. Has MCP / API / CLI. **Apps only, Meta only for launch, and a human drives it.**
- **Superscale**: claims the full loop (research, video/static, publish Meta/TikTok/Google, reads CTR/CPA/ROAS). Self-reported, single brand.
- **Uplane (YC F25)**, **Omneky**: big parts of the loop.
- **Meta Ads Manager assistant** (6 Oct 2026): now executes changes, generates creatives, budget and targeting. Sees only Meta data.
- **Icon "AI CMO"**: raised $9.2M, shut down early 2026 on output quality.

**Pitch line:** Spiral, Meta and fal are the cockpit. We are the pilot. We do not compete with Spiral; our agent uses Spiral as one of its tools.

## Our wedge
1. **Optimizes on business truth** (RevenueCat, Stripe, Supabase), not ad-platform clicks.
2. **Multi-brand, multi-vertical**: one brain, many brands, from a pet app to a clinic. Spiral is apps only; every tool is single brand.
3. **Vertical guardrails built in**: the clinic shows it. Health ads are restricted in Turkey and on Meta, so the agent loads per-vertical rules and generates compliant content. Nobody else does this.
4. **Day zero**: works from niche evidence before any ad history (August "Cold Start" becomes this mode).

## Architecture for tomorrow
```
             Manus (orchestrator, what judges see)
   ┌──────────────┬───────────┬──────────┬────────────┬─────────────┐
 Brand Brain MCP   Apify       fal MCP    Spiral MCP    Meta Ads
 (OURS, by URL)   (niche)     (render)   (app intel)   connector
   │
 Supabase: brands, dossiers, creatives, results, learnings, vertical_rules
   │
 adapters: RevenueCat · Stripe/Paddle · Meta Ads insights (live or demo fixtures)
```
- **Brand Brain MCP** (our IP), deployed at a public URL so Manus can "Add MCP by URL". Tools:
  `create_brand(url, vertical, country)`, `get_dossier(brand)`, `update_dossier(brand, patch)`, `list_brands()`,
  `get_vertical_rules(vertical, country)`, `get_revenue_snapshot(brand)`, `log_creative(brand, asset, hook, format)`,
  `log_results(brand, creative_id, metrics)`, `get_learnings(brand | all)`
- **Manus playbook**: one reusable instruction set ("Growth Agent") that runs intake, calls the Brand Brain, Apify + Spiral for the niche, deconstructs winners, fal for assets, outputs the pack + paused campaign.
- **Brand board UI** (optional, if time): a simple multi-brand web view (brands, dossier, creatives, revenue loop). Emir's call on stack.
- Data: live where we have access (Meta Ads, RevenueCat, Stripe/Paddle/Supabase), demo fixtures otherwise.

## Demo script (2 min prelim)
1. 0:00 Six brands, zero marketers. "This is how we do ads today" (Spiral tab, GPT tab, WhatsApp to Viktor).
2. 0:15 Paste Hound URL. Agent asks 3 questions (pre-answered).
3. 0:30 Niche read: winning dog-app ads (Spiral + Apify), deconstructed hooks.
4. 0:50 Revenue truth: RevenueCat shows who pays. Agent picks the hook/audience for payers, not clickers.
5. 1:10 Generated ads (fal video + statics) + paused Meta campaign.
6. 1:35 Switch to the clinic: same agent, health rules loaded, compliant creatives.
7. 1:50 "One agent, every brand we own, getting better every week."

## Risks and lines
- **Remake, never copy** other brands' creatives. Say "deconstruct and remake".
- **Clinic**: Turkish health-advertising rules + Meta health restrictions. Verify the exact TR rules tonight and encode them in `vertical_rules`; turn the risk into the feature on stage.
- **Long Manus chains fail more**: pre-run the long niche job; live-demo a short step; backup recording.
- **Credits**: 10k Manus each; fal $50 each. Wide research runs can burn 1k+.

## Open questions
1. Which clinic, and its URL?
2. "cam plan" = Canva? (Canva is already connected to Claude here, and Manus may connect it.)
3. Spiral access: do we have an account / API key for the MCP?
4. Name.
