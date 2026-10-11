# Providers, verified API facts, costs and fallbacks

"Verified" = checked against the provider's docs or store page on 11 Oct 2026. Anything else is marked (unverified); the build agent must confirm it from the official docs before relying on it, and update this file.

## Key matrix
| Provider | Env | Used for | Tonight | Tomorrow (event) | Fallback if empty/exhausted |
|---|---|---|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | The engine: every agent step | ~$5K credits, live | same | Bedrock (AWS credits), then OpenAI |
| OpenAI | `OPENAI_API_KEY` | Keyframes/statics (image model), TTS fallback, LLM fallback | ~$2K credits, live | same | fal Flux / Nano Banana for images |
| Apify | `APIFY_TOKEN` | Scrapers (ads library, TikTok, IG, Reddit, Maps, stores, site crawl) | Emir's/Mete's account (free tier has small monthly credit) | event credits ("plenty") | Firecrawl / direct fetch / Manus research |
| Manus | `MANUS_API_KEY` | Deep research task, landing page builder | Emir's key | 10,000 credits each | Claude + Apify only |
| fal | `FAL_KEY` | Video (Kling 3.0, Seedance 2.0), images (Flux) | Emir's key, ~$5-10 | $50 each | Higgsfield, OpenAI video, demo clips |
| Higgsfield | `HIGGSFIELD_API_KEY` (+ secret) | Alternative video | Emir's key | own account | fal |
| ElevenLabs | `ELEVENLABS_API_KEY` | Voiceover | optional (free tier ~10k chars) | optional | OpenAI TTS |
| Firecrawl | `FIRECRAWL_API_KEY` | Site crawl | optional (free tier) | optional | Apify website-content-crawler / fetch |
| YouTube Data API | `YOUTUBE_API_KEY` | Search Shorts by keyword (read only) | optional (free, Google Cloud) | optional | Apify YouTube scraper |
| Spiral | `SPIRAL_API_KEY` | App ad intelligence (API + MCP) | if subscription exists | | Apify ads library |
| RevenueCat | `REVENUECAT_API_KEY` | Hound subscriptions truth | Hound project secret key (read) | | demo fixture |
| PostHog | `POSTHOG_API_KEY` + project | Funnels | if available | | demo fixture |
| Stripe / Paddle | `STRIPE_SECRET_KEY` / `PADDLE_API_KEY` | Revenue truth | restricted read keys only | | demo fixture |
| Meta / Instagram | `META_ACCESS_TOKEN`, ids | Ads insights, IG insights, optional Reels publish | tomorrow | | manual metrics entry |
| Deepgram | `DEEPGRAM_API_KEY` | Transcribe competitor videos (verbatim hooks/scripts); Aura TTS | $15K student credits (live) | same | Claude on captions only |
| Tavus | `TAVUS_API_KEY` | AI presenter / talking-head videos | student deal (redeem) | | keyframe video |
| sync. | `SYNC_API_KEY` | Lip-sync, translate a talking head to SK/CZ/ES | student deal (redeem) | | subtitles only |
| Firecrawl | (above) | Site crawl | student deal (redeem), live | | fetch + readability |
| Browser Use | `BROWSER_USE_API_KEY` | Cloud browser agent for pages scrapers cannot read | student deal (redeem) | | skip |
| Langfuse | `LANGFUSE_*` | Trace agent steps, cost, latency | student deal (redeem) | | logs only |
| AWS Bedrock | `AWS_*` | Backup Claude engine | $10K credits | same | OpenAI |

Budget rule tonight: Claude (~$5K credits), OpenAI (~$2K), Deepgram ($15K) and AWS ($10K) are plentiful, so those run live (`LIVE_PROVIDERS`) within guard caps. fal, Higgsfield, Apify, Manus, ElevenLabs hold small balances tonight: one recorded smoke test each plus the A15 real-data pass, then demo replays the recorded data. Tomorrow at the event: fal $50 each, Manus 10,000 credits each, Apify credits; switch them into `LIVE_PROVIDERS` then.

Unredeemed student deals worth redeeming for this product: Firecrawl, Browser Use, Langfuse, Tavus, sync., Supabase, AWS (done), Google Cloud (YouTube Data API), Azure.

## Verified facts

### Manus API v2 (verified, docs: https://open.manus.im/docs, index: https://open.manus.im/docs/llms.txt)
- Base `https://api.manus.ai`, header `x-manus-api-key`. Responses wrap `{ok, request_id, ...}`.
- `POST /v2/task.create` with `message.content` (string or parts, ~5k tokens max), optional `message.connectors` (connector UUIDs), `project_id`, `agent_profile` (`lite` | `standard` | `max`...), `structured_output_schema` (JSON Schema subset: all properties required, `additionalProperties: false`), `interactive_mode` (default false), `share_visibility`. Returns `task_id`, `task_url`, `share_url`.
- Poll with `task.listMessages` / `task.detail`; follow-ups with `task.sendMessage`; webhooks exist (`webhook.create`) but need a public URL, so poll locally.
- `project.create` = shared instructions per brand. `website.*` = inspect/publish sites Manus built.
- Native connectors with fixed UUIDs include: Apify `cf19c9d0-5f91-4e7a-af04-593febb5c80c`, RevenueCat `a104e1ac-73e5-482f-96e6-8b95f4756f27`, PostHog `89dac2c3-74d0-4f94-86d1-0ee6c4566193`, Canva `c63d86db-4c98-483a-af0c-f94721d7f2a5`, Stripe `29986b52-7cbb-4d5e-9263-dd0abacaf28d`, Similarweb `700c656f-b4a4-4e39-a886-a20782d99b6f`, Ahrefs `305b3b49-32ce-4b2b-a355-3492fe85d17f`, ElevenLabs `23181678-c628-4c53-9a77-36778a36bbe5`, Kling `99474cab-58bf-47ae-af0e-43c156703be9`, HeyGen `c183add9-c22c-4199-b7f2-d885571afa3a`, Firecrawl `abb9ed36-e693-44ab-be3d-1f5c3bb02294`, Supabase `84ab78ef-139c-48ff-acd4-cba718b8a484`, GitHub `bbb0df76-66bd-4a24-ae4f-2aac4750d90b`. A connector must first be authorized in the Manus web app; list installed ones with `connector.list`.
- **There is no Meta Ads connector in the current list** (older notes saying so are wrong).
- fal can be added to Manus as a custom MCP: Connect Apps > Create > Add MCP by URL > `https://mcp.fal.ai/mcp-relay` (organizer guide).

### Apify actors
- Verified on the store: `curious_coder/facebook-ads-library-scraper` (45K users, ~$0.75 per 1K ads), `apify/facebook-ads-scraper` (43K users; FB, IG, WhatsApp, Threads ads).
- TikTok organic: `clockworks/tiktok-scraper` (verified listed). No TikTok ads-library actor found.
- (unverified, confirm in store) `apify/instagram-scraper`, `apify/instagram-reel-scraper`, `compass/crawler-google-places`, `apify/website-content-crawler`, a Reddit scraper (e.g. `trudax/reddit-scraper-lite`), app store review scrapers.
- Meta Ad Library: EU audiences return commercial ads (DSA), elsewhere mostly political/issue ads. No spend or CTR data. Longevity is the proxy.

### fal (pricing from fal's own pages via search snippets, Oct 2026)
- Kling 3.0 Pro image-to-video: ~$0.112/s audio off, ~$0.168/s with audio; 10 s Pro with audio ~$1.68.
- Seedance 2.0 standard: ~$3.03 per 10 s.
- So a 30 s single take ~$5; budget drafts on cheaper tiers and keyframes first.
- fal Startup Program: $1k credits growing to $5k, Europe and Asia teams with traction or VC backing; apply after the event (Evreon is the likely applicant).

### Higgsfield (unverified)
- Has an API (docs location to confirm by the agent). Community note: Higgsfield UI is practical but its API is more expensive than fal for the same models.

### Publishing constraints (verified unless marked)
- TikTok Content Posting API: unaudited clients can only post private (`SELF_ONLY`); audit takes weeks. "Upload" (to the creator's inbox as a draft) exists; whether drafts escape the private limit is unconfirmed.
- YouTube `videos.insert`: unverified API projects (created after 28 Jul 2020) upload as private until audited.
- Instagram Graph API: Reels publish via container `media_type=REELS` + `media_publish`; needs an Instagram Business account; video must be on a public URL. Unapproved apps work only for accounts with a role on the app (inferred).
- X API: pay-per-use since Feb 2026 (roughly $0.015 per post; prices differ across sources).
- Aggregators that already hold platform approvals: Upload-Post (from ~$24/mo, free tier 10 uploads), Zernio (formerly Late, ~13 platforms incl. Reddit). Optional later.
- Default path in the product: export pack, human posts.

### Claude (from the claude-api skill, Oct 2026)
- Default model `claude-opus-5-5` (1M context, 128K output). Thinking cannot be disabled on Opus 5.5; control cost and depth with `output_config.effort` (default `medium`, set it explicitly per route). Forced `tool_choice` (`any`/`tool`) returns 400: use `auto` + clear instructions, `strict: true` tools, or structured outputs (`output_config.format`). Use streaming for long outputs. Handle `stop_reason: "refusal"`.
