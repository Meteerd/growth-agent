# CLAUDE.md: growth-agent

Read this file first in every session, then in this order:
1. `docs/PRODUCT_SPEC.md`: what we are building and why (the source of truth for behaviour)
2. `docs/ARCHITECTURE.md`: stack, repo layout, data contracts, API, events (the source of truth for interfaces)
3. `coord/PROTOCOL.md`: how the two build machines coordinate through git (mandatory)
4. Your lane file: `coord/LANE_A.md` (engine) or `coord/LANE_B.md` (cockpit), and your task list `coord/TASKS_A.md` / `coord/TASKS_B.md`
5. As needed: `docs/DESIGN.md` (visual direction), `docs/BRANDS.md` (the four real brands + compliance), `docs/APIS.md` (providers, verified API facts, costs, fallbacks), `assets/brands/` (real logos and imagery per brand, see its README)

## One paragraph
A GTM agent for operators who run many brands. You enter a brand (URL), connect data sources, and the agent gathers everything it can (site, competitors, winning ads and organic posts, communities, reviews, the brand's own revenue and analytics). Then it interviews the operator like a clinician taking a patient history, asking only what the data could not answer. Then it decides **where to go** (TikTok, Reels, Shorts, X, LinkedIn, which subreddits, paid or organic, and where NOT to go), with evidence. Then it **makes the content** that wins there (videos, statics, posts) by remaking proven structures, checks every piece against the brand's legal rules, and hands over ready-to-post packs (download and post, or auto-post where a platform allows). Then it reads results and learns. One brain, many brands.

## Non-negotiable rules
- **Claude is the engine.** All reasoning (orchestration, interview, strategy, scripts, compliance) runs on the Anthropic API via `@anthropic-ai/sdk`. Model from `ENGINE_MODEL` (default `claude-opus-5-5`). Load the `claude-api` skill before writing any Anthropic SDK code and follow it (adaptive thinking, explicit `output_config.effort` per route, streaming, structured outputs, no forced `tool_choice`, refusal handling).
- **Manus is a real tool inside the engine, never decoration.** It runs deep research tasks and builds landing pages through its REST API v2. Do not fake Manus output; in demo mode the fixture is labelled demo.
- **Never fabricate** metrics, revenue, view counts, competitor facts or quotes. Demo fixtures are deterministic and labelled `demo: true` in data and visibly "Demo data" in the UI.
- **Remake, never copy.** Extract the structure of winning content (hook, format, pacing, angle, CTA) and produce original content for our brand. Never download-and-reupload someone else's creative.
- **Compliance gates everything.** Every script, caption and image prompt passes the brand's rule pack (`docs/BRANDS.md`) before rendering or export. Health brands are heavily restricted.
- **Nothing goes out without a human.** The engine never posts, never spends ad money, never sends messages. Publishing = export pack (default) or an explicit human click on an optional auto-post connector.
- **Money is capped.** Every paid provider call goes through the spend ledger and refuses to exceed `BUDGET_USD_*`. Only providers in `LIVE_PROVIDERS` make real calls (overnight: Claude, OpenAI, Firecrawl, YouTube). fal, Apify, Manus and Higgsfield run demo except one recorded smoke test each and the A14 real-data pass. Unit tests and `pnpm check` never call live APIs.
- **Secrets:** only in `.env` (git-ignored). Never print, log, commit or echo a key. Do not read `.env` into the conversation; code loads it at runtime.
- **No browser extension.** Use WebFetch/WebSearch for reading the web and Playwright (its own headless Chromium) for testing and screenshots.
- **Writing style for anything user-facing:** plain, specific, no em dashes, no AI-sounding filler.

## Working rules for the build agents
- Follow `coord/PROTOCOL.md` exactly: own only your lane's paths, sync with `scripts/sync.sh <A|B>` at every task boundary and at least every 20 minutes, keep `coord/STATUS_<lane>.md` current.
- Never ask the human a question (they are asleep). Make the decision, record it in `docs/DECISIONS.md` (append a row) and in your STATUS file, and continue.
- Prefer finished and working over broad and broken. Every task has acceptance checks; a task is done only when its checks pass and are pushed.
- Keep test output short; write long logs to `logs/` (git-ignored) and grep them.
- Commit small and often with clear messages (`engine: ...`, `web: ...`, `contracts: ...`, `coord: ...`).

## Three AI engines, everything else is a tool
- **Claude (Anthropic)**: the main brain for every decision: research reasoning, consultation, channel direction, scripts, compliance.
- **OpenAI**: images (keyframes), voiceover, transcription, and a second-opinion model where a cross-check helps.
- **Manus**: autonomous deep-research tasks and campaign landing pages via its API.
- Tools they call: Spiral (primary source for Meta and TikTok ad intelligence: winners, transcripts, creative analysis), Apify (fallback ads library + organic TikTok/IG/Reddit/reviews), Firecrawl (websites), YouTube (Shorts), fal and Higgsfield (video).

## Keep it small
One Next.js app, one SQLite file, runs on localhost. Six core providers (Anthropic, OpenAI, Firecrawl, Apify, Manus, fal). No extra services, no Docker, no cloud deploy tonight. If a new dependency or service is not needed for the demo, do not add it.

## Event context (why the deadline is hard)
10X Your Brand Hackathon (Slush'D x Manus), Istanbul, Mon 12 Oct 2026. Build 09:30 to 15:00, judging after. Judged 20% each on problem/value, execution/quality, use of Manus and tools (Manus, Apify, fal), potential, pitch. Details in `docs/event/`. The app must run locally on a laptop for the demo by 07:00.
