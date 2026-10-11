# Landscape findings (bounded pass, 11 Oct 2026)

| Player | What it does | Gap vs our loop | Source |
|---|---|---|---|
| Superscale | Competitor research, scripts, video+static, publish Meta/TikTok/IG/Google, reads CTR/CPA/ROAS; from $99/mo, ad integrations $199/mo | Self-reported; reads ad metrics, not revenue/product analytics; single brand | superscale.ai/compare/the-best-ai-marketing-agents |
| Omneky | Creative gen (image/video/UGC), launch, rotation | Enterprise, managed onboarding | omneky.com |
| Albert.ai | Autonomous media buying, no creative | No creative | superscale comparison |
| HubSpot Breeze, Jasper, Copy.ai, Agentforce | Content/CRM agents | No paid video ads loop | superscale comparison |
| AI Marketer (usemarketer.com) | "Autonomous AI marketing agent" | Could not read site (robots) | usemarketer.com |
| Meta Ads Manager assistant | Executes changes, generates images/copy, budget + targeting; expanded Ads MCP announced (6 Oct 2026) | Only sees Meta data; single platform | commonthreadco.com Advertising Week 2026 article |
| Uplane (YC F25) | Ads + landing pages + launch + budget | prior notes (Aug) | APPLICATION_RECORD.md |
| Icon AI CMO | Shut down early 2026 | quality failure | prior notes |
| Foreplay / BigSpy / WinnerAdSpy | Ad spy, swipe files | Analysis only | foreplay.co, producthunt |

## Connectors that exist today
- RevenueCat official MCP server: revenuecat.com/docs/tools/mcp
- PostHog MCP server: exists (getdrio listing)
- Meta Ads MCP server (official): developers.facebook.com ads-mcp-server
- fal MCP: https://mcp.fal.ai/mcp-relay (Manus: Connect Apps > Add MCP by URL)
- Manus native connectors (Aug notes): Meta Ads Manager, Supabase, Stripe, Notion, Slack, Gmail, HubSpot, GitHub

## Regulatory flags
- Turkey: advertising ban for health providers/doctors; newer rules tighten doctors' social media promotion (posta.com.tr, milliyet.com.tr, donanimhaber.com coverage)
- Meta: health & wellness data restrictions since 2025 limit lower-funnel event optimization (triplewhale.com, click.co.uk)

## Spiral (spiral.ad), added after Mete named it
Creative AI platform for app marketers: research Meta/TikTok ads, track scaling apps (ad activity, revenue, downloads), AI-generate statics, remix/translate/swap characters in video, order UGC, connect Meta ad accounts for ROAS, bulk-launch Meta campaigns. AI tagging by hook/concept/emotion "coming soon". **Has MCP + API + CLI.** Pricing not on homepage. Targets apps and app studios. Closest competitor; use it as a tool inside our agent.
