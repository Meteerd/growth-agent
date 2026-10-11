# Decisions log

| When | Decision | By |
|---|---|---|
| 11 Oct 21:36 | Team Nexus for this event = Mete + Emir Sürmen | Mete |
| 11 Oct 21:55 | Build: an autonomous growth / ads agent for operators running many brands (clinic, Evreon, App Studio, Duna Yazılım, Puzzles, Anytomic) | Mete |
| 11 Oct 22:00 | Demo brands: **the clinic + Hound / HuntApp** (both need real ads now) | Mete |
| 11 Oct 22:00 | Data: Meta Ads, RevenueCat, Stripe/Paddle/Supabase (PostHog possible). Live where we have access, demo data where not; showing it working is enough | Mete |
| 11 Oct 22:00 | Spiral (spiral.ad) is the ad-intel tool we use today; our agent uses its MCP as a tool | Mete |
| 11 Oct 22:00 | Canva ("cam plan", to confirm) for polished brand images | Mete (to confirm) |
| 11 Oct 22:00 | Build tonight, Mete + Emir | Mete |
| 11 Oct | Manus is the visible orchestrator (judging: Use of Manus + tools = 20%); our IP = Brand Brain MCP connected via "Add MCP by URL" | Claude proposal, accepted as working plan |
| 11 Oct | Positioning: "Spiral, Meta and fal are the cockpit; we are the pilot." Do not claim nothing like this exists | Claude proposal |

| 11 Oct 23:00 | Claude (Anthropic API, `claude-opus-5-5`) is the engine for all reasoning; Manus is a real tool inside it (deep research task + landing pages via API v2), not the orchestrator | Mete |
| 11 Oct 23:00 | Product = full GTM agent: enter brand, connect data, gather evidence, consultation (anamnesis) chat, channel direction (where to go and not go), content production, compliance, ready-to-post packs, measure, learn | Mete |
| 11 Oct 23:00 | Publishing default = export pack, human posts; auto-post optional later (TikTok/YouTube API posts are private-only until audited) | Mete |
| 11 Oct 23:00 | Brands: a.clinic, Hound, Dynova, Evreon AI (seeded); rule packs per brand | Mete |
| 11 Oct 23:00 | Overnight build: two machines, Lane A engine (Mete), Lane B cockpit (Emir); git is the only channel; `scripts/sync.sh` every task / 20 min; stop at 07:00 | Mete |
| 11 Oct 23:00 | Stack: pnpm monorepo, Hono + Drizzle + Postgres (docker) engine, Next.js 15 cockpit, Remotion video, Zod contracts | Claude, accepted |
| 11 Oct 23:15 | Credits: Claude ~$5K, OpenAI ~$2K, Deepgram $15K, AWS $10K live; fal/Higgsfield/Apify/Manus small tonight, event credits tomorrow | Mete |
| 11 Oct 23:15 | Manus has no Meta Ads connector (API v2 docs); Meta paid ads for a.clinic are notNow until LegitScript | research |

| 11 Oct 23:30 | Simplified: ONE Next.js app (UI + API routes), SQLite via Drizzle/libSQL, localhost only; no separate engine server, no Docker, no cloud tonight. Supersedes the 23:00 stack row | Mete |
| 11 Oct 23:30 | Providers trimmed to six core (Anthropic, OpenAI, Firecrawl, Apify, Manus, fal) + optional Higgsfield/YouTube/Spiral/brand connectors. OpenAI covers TTS and transcription. Dropped: ElevenLabs, Deepgram, Tavus, sync., Langfuse, AWS, Browser Use | Mete |
| 11 Oct 23:30 | Deploy to Vercel/Netlify later, after the local demo works | Mete |

| 11 Oct 23:30 | Core of the product: agents WATCH winning videos (frames + transcript, Claude vision), produce shot-by-shot blueprints, remake the same ad for our brand in every winning format, then watch their own render and fix weak shots (max 2 rounds) | Mete |

## Still open
1. Product name (constant `PRODUCT_NAME`)
2. Which TikTok / Instagram accounts exist for Hound and a.clinic (for the morning posts)
3. Spiral subscription / API key
4. Emir's GitHub username (repo access)

## Overnight build decisions (append rows)
| When | Decision | By |
|---|---|---|
| 11 Oct 23:18 | A01: Next.js 16.4 (create-next-app latest), React 19.3, Tailwind 4, Biome 2.5 (2-space), Vitest 5. Removed `cacheComponents`/`partialPrefetching` defaults so API routes stay plainly dynamic (SSE + SQLite). `pnpm check` runs `next typegen` first so route/layout types exist for tsc | Lane A |
| 11 Oct 23:22 | B01: replaced Lane A's placeholder `e2e` script (it said "until Lane B adds Playwright") with `playwright test`, added `e2e:live`. Playwright runs its own `next dev` on port 3100 with NEXT_PUBLIC_DATA_MODE=mock so it never collides with a dev server on 3000. Fonts: Instrument Serif, Inter Tight, JetBrains Mono via next/font. PRODUCT_NAME = "Nexus" in src/lib/client/product.ts | Lane B |
| 11 Oct 23:35 | B02: tertiary text token bone-3 raised from 38% to 50% bone so readable text stays >= 4.5:1 on ink (38% measured about 3.1:1); 30% kept as bone-4 for decoration only. Screenshots are viewport-sized (1440x900, 390x844) because fixed back layers do not extend in full-page captures. Next dev indicator disabled (devIndicators: false) so it never shows in screenshots or the demo | Lane B |
