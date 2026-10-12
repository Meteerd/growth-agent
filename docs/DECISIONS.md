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

| 12 Oct 01:25 | UI v1 (dark observatory) rejected as too AI-ish; v2 'the cutting room': paper/ink/record red, real media first, edit-timeline reverse-engineer view | Mete |
| 12 Oct 01:25 | Remake videos must look like the real winning footage (photoreal keyframes + real motion), not panned brand illustrations | Mete |

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
| 11 Oct 23:36 | B03: field shader runs on raw WebGL2 (full-screen triangle, ~100 lines) instead of R3F. Under React 19.3 + R3F 9.8 the material ref stayed null and uniform updates never reached the GPU; raw WebGL removed that risk and takes three.js (~150 KB gz) off every page, which helps Lighthouse. three/@react-three/fiber removed from package.json (Lane B's own additions). Field state lives in a Zustand store (activity, accent, vortex), exposed as window.__nexusField for Playwright and presentation mode | Lane B |
| 11 Oct 23:38 | A03: DB rows keep hot columns as real columns and the entity body as a JSON column typed by `@/contracts` (fast to build, schema-safe via Zod). The DB auto-migrates and auto-seeds on the first API call so a fresh clone works with just `pnpm dev`. Brand routes accept id or slug | Lane A |
| 11 Oct 23:45 | A06: every Claude call uses the beta Messages endpoint with `fallbacks: "default"` (server-side refusal fallback, beta `server-side-fallback-2026-07-01`) per the claude-api skill default for Opus 5.5; adaptive thinking; effort per route (chat low, extraction/vision medium, strategy/compliance/production high); structured output via JSON schema from Zod, validated again with Zod. A refusal or truncation falls back to the step's demo output with a visible warning event | Lane A |
| 11 Oct 23:51 | B05: one DataClient interface, two implementations (live = /api + SSE, mock = in-memory store from DEMO_RUNS). Default DATA_MODE is live (ARCHITECTURE 8); e2e runs mock. Mock reads only return entities whose ids the stream has already revealed (refId), so mock and live look identical mid-run; fresh mock runs re-id concepts/packs/questions so they never collide with the seeded demo run. Mock state is per page load (shortcut noted in code). Mock videos point at public/media/sample.mp4 (labelled DEMO RENDER). e2e sets NEXT_PUBLIC_MOCK_RUN_MS=20000 for speed; the 60 s pacing is unit-tested | Lane B |
| 11 Oct 23:58 | B06: shader program links asynchronously (KHR_parallel_shader_compile, polled) because a blocking compile cost a 2.2 s long task under Lighthouse's GPU-less headless Chrome (score 52). After: score 89 (TBT 10 ms, LCP 3.8 s, CLS 0) with the field on. ?field=0 disables the field (perf debugging, slow laptops). Landing story sections are server components, so fixtures never ship to the client there | Lane B |
| 12 Oct 00:05 | Lane B parallelism: B13 Packs, B14 Results, B15 Settings are built by three Lane B subagents, each in its own git worktree and dev-server port (3101 to 3103), creating new files only. The main Lane B session reviews, merges their branches into lane-b and syncs. The main session builds the signature screens (B08 to B12b) itself | Lane B |
| 12 Oct 00:09 | B08: .claude/ (agent worktrees) added to .gitignore and to tsconfig exclude (additive) so biome and tsc never scan subagent checkouts. Connect page takes only non-secret account ids; keys stay in .env | Lane B |
| 12 Oct 00:18 | A11: video renders with sharp + ffmpeg-static implementing the Ad916 spec (1080x1920, 30 fps, Ken Burns per keyframe, captions burned inside safe zones, corner badge, end card with logo + CTA, voiceover track). Remotion was installed and `remotion/Ad916.tsx` is kept, but even a minimal Remotion composition timed out "waiting for root component" in headless Chrome on this machine (Node 26); `RENDERER=remotion` retries it. ffmpeg renders a 23 s ad in ~3 s | Lane A |
| 12 Oct 00:18 | A11/A11c: the pipeline auto-renders a draft of the remake (Ken Burns on keyframes, $0 in demo) so the agent can watch and self-review it (max 2 rounds). The operator approval gate stays on final renders and on export. fal image-to-video for the final tier is stretch AS2 | Lane A |
| 12 Oct 00:18 | A12: compliance = deterministic rule patterns first (a block pattern hit always fails, e.g. RX1 drug names, P1 cure/guarantee), then Claude judgment; unknown rule ids dropped; paid-only rules ignored for organic. Auto-revise max 2, then the concept is blocked from render and export | Lane A |
| 12 Oct 00:18 | Added `logs` and `data` to tsconfig `exclude` (local scratch files must not break tsc) | Lane A |
| 12 Oct 01:12 | Lane B runs scripts/sync.sh with VITEST_MAX_WORKERS=3 on this laptop: under full parallelism two of Lane A's full-pipeline engine tests hit their 30 s timeout here (load average about 10), with 3 workers all 147 tests pass in about 60 s. No file changed; Lane A asked via INBOX_A to give those tests a longer timeout | Lane B |
| 12 Oct 02:10 | BS3 (page transitions, shared elements, vortex) is skipped on purpose: DESIGN v2 limits motion to functional 120 to 200 ms and bans the page vortex; the playhead and real video are the only continuous motion | Lane B |
| 12 Oct 04:05 | Video captions over 12 words are shortened by Claude before the compliance check (one call per run); without a model the fallback keeps whole clauses or leaves the text as is, never cutting mid-phrase. Statics and carousels may carry up to 40 words per slide. | Live drafts had 23-word captions on 3 s shots; truncation changed meaning. |
| 12 Oct 04:05 | Dynova flagship accepted at 81/100 with every shot >= 80 after a free recompose round, noting that one shot's score moved 72 -> 82 on unchanged frames (review variance, documented in MORNING_A). | The cut has no visible defect left that the reviewer names as blocking; more rounds would spend Higgsfield budget on noise. |
| 12 Oct 04:41 | The landing's "Same engine" section reads the showcase fixtures with `fs` on the server and imports the committed contact sheets (`docs/renders/*.jpg`) as static images, instead of importing the JSON or using `/api/assets` posters | Turbopack rejects `dynova.json` (a lone surrogate in scraped text), and the static images load in mock mode on a fresh clone before any seed; Lane B |
| 12 Oct 04:41 | Self-review passes are numbered in the engine's order and labelled by their overall score, not by `round` | Round numbers repeat when a flagship is rebuilt ("round 1 (2)"); a score trail reads honestly and shows the improvement; Lane B |
| 12 Oct 07:16 | The final sync is on hold: Mete asked not to run ffmpeg while the lid is closed, and pnpm check renders test videos with ffmpeg. Nothing is pushed to main around the check. | Human instruction overrides the overnight goal; main stays green (04:54). |
