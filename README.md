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
Filled in by the build agents (`coord/MORNING_A.md`, `coord/MORNING_B.md`). Expected:
```bash
pnpm install
cp .env.example .env   # then paste keys
pnpm db:migrate && pnpm seed
pnpm dev               # http://localhost:3000
```
