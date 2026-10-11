# growth-agent

A GTM agent for operators who run many brands: enter a brand, connect data, let the agent gather evidence, answer its consultation, get a channel direction with evidence, and receive ready-to-post content that passed the brand's legal rules. Then measure and learn.

Team Nexus (Mete + Emir Sürmen) for the 10X Your Brand Hackathon, Istanbul (Slush'D x Manus), 12 Oct 2026.

| Read | For |
|---|---|
| `CLAUDE.md` | Rules for every agent session (start here) |
| `docs/PRODUCT_SPEC.md` | What the product does |
| `docs/ARCHITECTURE.md` | Stack, contracts, API, ownership |
| `docs/DESIGN.md` | Visual direction |
| `docs/BRANDS.md` | The four brands + compliance rule packs |
| `docs/APIS.md` | Providers, verified API facts, costs, fallbacks |
| `coord/` | Two-machine build protocol, lanes, tasks, status, inboxes |
| `docs/event/` | Event report, judges, criteria |

## Run it
From a fresh clone (Node 22+, pnpm 11):
```bash
pnpm install                 # also fetches ffmpeg (ffmpeg-static) and sharp
cp .env.example .env         # paste keys; empty keys = labelled demo data
pnpm db:migrate && pnpm seed # optional: the first API call migrates and seeds by itself
pnpm dev                     # http://localhost:3000
```
- Data lives in `data/` (SQLite `data/nexus.db`, renders and frames in `data/assets/`), git-ignored.
- `pnpm check` = typegen + tsc + Biome + Vitest (no live API calls). `pnpm test:engine-e2e` runs a full demo GTM run for all four brands (renders a real MP4).
- Live vs demo: a provider is live only if its key is in `.env` AND its id is in `LIVE_PROVIDERS`. Every live call goes through the spend ledger and stops at its `BUDGET_USD_*` cap (`GET /api/spend`).
- `pnpm smoke <provider> [--live]` makes one recorded call (anthropic, openai, firecrawl, youtube, blueprint, intake). `pnpm live-pass <slug>` records a real research pass (Apify, Spiral, Manus forced live for that run) as the brand's default dataset.
- Engine details and the 2-minute demo path: `coord/MORNING_A.md`. Cockpit: `coord/MORNING_B.md`.
