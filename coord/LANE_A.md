# Lane A: the engine (Mete's machine)

You are the backend and agent engineer. It is one Next.js app on localhost with a SQLite file; you own the server side of it: `src/contracts/`, `src/engine/`, `src/app/api/`, `drizzle/`, `remotion/`, and you scaffold the app (task A01). Lane B (Emir's machine) owns all UI paths (`src/app/` except `api/`, `src/components/`, `src/styles/`, `src/lib/client/`, `public/`, `e2e/`, `next.config.ts`, Tailwind/PostCSS config). You never edit Lane B's paths. `package.json` and `tsconfig.json` are shared and additive.

## Your three priorities, in order
1. **Unblock Lane B fast.** First ~15 minutes: scaffold the Next.js app at the repo root (A01) and push it. Within the first hour: `src/contracts` (every schema in `docs/ARCHITECTURE.md` section 5, route constants, demo fixtures for the four brands and one complete demo run) on `origin/main`, then a message in `coord/INBOX_B.md` saying what landed and how to import it. Then `/api/brands` and the SSE run stream in demo mode so B can switch from mock to live early.
2. **A real agent, not a script.** The GTM run must actually reason with Claude over evidence: deconstruct winners, generate gap-driven questions, score channels with explicit weights and evidence, write concepts that remake structures, check compliance. Demo mode replays recorded or deterministic data through the same code paths, not a separate fake pipeline.
3. **Real data for the demo.** Before 07:00, run one live research pass for **Hound** and **a.clinic** within the caps (small Apify limits, 20 to 40 items per actor), record it, and make it the default dataset those two brands show (flagged live-recorded with capture time, not demo).

## How to build the agent
- Load the `claude-api` skill before writing Anthropic SDK code. `@anthropic-ai/sdk`, tool runner with Zod tools, streaming, `output_config.effort` set per route (chat `low`, extraction `medium`, strategy/compliance `high`), structured outputs for every machine-read result, refusal handling, no forced `tool_choice`.
- One phase = one focused agent loop with a narrow tool set and a structured final output saved to the DB. Emit a `RunEvent` for each phase start/end, tool call/result (short title, details in `detail`), entity created (`refId`) and cost entry.
- Prompts in `src/engine/agent/prompts/*.md`, written like briefs to a senior strategist: goal, inputs, what good looks like, the brand's rule pack, the output schema, 1 or 2 worked examples from the real brands.
- Ground everything: every claim in a dossier, plan or concept cites evidence ids or operator answers. If evidence is thin, say so.
- Cost discipline: batch deconstruction, cache stable prompt prefixes, keep tool results compact (full payloads in DB, summaries to the model).

## Providers (keep the set small)
In `src/engine/providers/`, one interface (`isLive`, `estimateCost`, `call`) + a demo implementation each:
- **anthropic** (engine), **firecrawl** (site crawl for intake and competitor pages), **openai** (keyframe images with the current image model, TTS voiceover, transcription of competitor videos), **apify** (actors in `docs/APIS.md`; verify the unverified ones on the store with WebFetch), **manus** (API v2 deep-research task with `structured_output_schema`, `agent_profile: "lite"` tonight, poll; keep `task_url`), **fal** (queue API; image-to-video draft and final tiers; read fal docs for the exact model endpoints).
- Optional, only if keys exist: higgsfield (find official API docs), youtube (search), revenuecat / posthog / stripe / paddle / meta (read-only summaries). Otherwise demo.
- Every live call goes through the spend ledger and stops at its cap. Smoke scripts record real responses into `src/contracts/fixtures/live/<provider>/`. When you confirm an API detail, update `docs/APIS.md`.

## Video
`remotion/`: one composition `Ad916` (1080x1920, 30 fps): clips or animated keyframes (Ken Burns when no clip), burned captions in safe zones, optional voiceover track, brand colors, end card with CTA. `renderAd(conceptId)` renders to `data/assets/`. Demo mode renders from keyframes only (zero provider cost) so the pipeline always produces a real MP4.

## Done means
Every CORE task in `coord/TASKS_A.md` checked with its acceptance output shown, `pnpm check` green, the engine e2e green for all four brands in demo mode, `coord/MORNING_A.md` written, everything on `origin/main`.
