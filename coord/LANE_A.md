# Lane A: the engine (Mete's machine)

You are the backend and agent engineer. You own `packages/contracts`, `apps/engine`, `packages/video`, and the root config (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `docker-compose.yml`). Lane B (Emir's machine) builds the cockpit UI against your contracts and API. You never edit `apps/web`.

## Your three priorities, in order
1. **Unblock Lane B fast.** Within your first ~60 minutes: root workspace + `packages/contracts` (every schema in `docs/ARCHITECTURE.md` section 5, route constants, and rich demo fixtures for the four brands and one complete demo run) on `origin/main`, then a message in `coord/INBOX_B.md` saying it landed and how to import it. Then the engine skeleton with `/health`, `/brands` and the SSE run stream in demo mode, so B can switch from mock to live early.
2. **A real agent, not a script.** The GTM run must actually reason with Claude over evidence: deconstruct winners, generate gap-driven questions, score channels with explicit weights and evidence, write concepts that remake structures, check compliance. Demo mode replays recorded or deterministic data through the same code paths; it must not be a separate fake pipeline.
3. **Real data for the demo.** Before 07:00, run one live research pass for **Hound** and **a.clinic** within the caps (small Apify limits, e.g. 20 to 40 items per actor), record it, and make it the default dataset those two brands show in demo mode (marked live-recorded with capture time, not demo).

## How to build the agent (guidance, not a cage)
- Load the `claude-api` skill before writing Anthropic SDK code. Use `@anthropic-ai/sdk` with the tool runner and Zod tools; stream; set `output_config.effort` per route; structured outputs for every machine-read result; handle `refusal`; never use forced `tool_choice`.
- One phase = one focused agent loop with a narrow tool set and a structured final output persisted to the DB. Emit a `RunEvent` for each phase start/end, each tool call and result (short titles; details in `detail`), each entity created (`refId`), and each cost entry.
- Prompts live in `apps/engine/src/agent/prompts/*.md`. Write them like briefs to a senior strategist: the goal, the inputs, what good looks like, the brand's rule pack, the output schema. Include 1 or 2 worked examples per prompt drawn from the real brands.
- Ground everything: every claim in the dossier, plan or concept must cite evidence ids or operator answers. If evidence is thin, say so in the output instead of inventing.
- Cost discipline: batch deconstruction calls; cache stable prompt prefixes (system + rule pack + dossier); keep tool results compact (store full payloads in DB, give the model summaries).

## Providers
Implement each in `apps/engine/src/providers/` behind one interface (`isLive`, `estimateCost`, `call`) plus a demo implementation. Spend goes through the ledger and stops at the caps. Live smoke test scripts record real responses into `packages/contracts/fixtures/live/<provider>/`. When you confirm an API detail (actor id, endpoint, model id, price), update `docs/APIS.md`.
- Anthropic (engine), OpenAI (images: use the current image model from OpenAI docs; TTS fallback), Apify (actors in `docs/APIS.md`, verify the unverified ones on the store via WebFetch), Manus (API v2: deep research task with `structured_output_schema`, `agent_profile: "lite"` overnight, poll messages; store `task_url`), fal (queue API; image-to-video draft and final tiers; read fal docs for exact model endpoints), Higgsfield (find the official API docs; implement if usable, else document and leave demo), ElevenLabs (TTS), YouTube Data API (search), RevenueCat / PostHog / Stripe / Paddle (read-only summaries), Meta/Instagram (insights read only).

## Video
`packages/video`: Remotion project with one composition `Ad916` (1080x1920, 30 fps): sequence of clips or animated keyframes (Ken Burns if no clip), burned captions with safe zones, optional VO track, brand colors, end card with CTA. `renderAd(conceptId)` renders to `ASSETS_DIR`. Demo mode renders from keyframes only (zero provider cost) so the pipeline always produces a real MP4.

## Done means
Every CORE task in `coord/TASKS_A.md` checked with its acceptance output shown, `pnpm check` green, engine e2e green for all four brands in demo mode, `coord/MORNING_A.md` written, everything on `origin/main`.
