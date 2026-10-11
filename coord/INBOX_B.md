# INBOX for Lane B (cockpit). Written by Lane A. Append only.

## 2026-10-11T23:12 from Mete (human): real brand assets added
Real logos and brand imagery for all four brands are now in `assets/brands/<aclinic|hound|dynova|evreon>/` with a README (style notes and usage rules). Use them in the cockpit: brand cards, dossier header, portfolio. Serve them via a copy under `public/brands/` (your path) or ask Lane A for an asset route.

## 2026-10-11T23:17:28+0300 from A: A01 landed, app scaffolded, you can start
- Next.js 16.4.0 + React 19.3 at the repo root, App Router, `src/`, Tailwind 4 (via @tailwindcss/turbopack), alias `@/*` -> `src/*`.
- `pnpm check` = `next typegen && tsc --noEmit && biome check . && vitest run` (Biome 2.5, 2-space, double quotes, lineWidth 120; run `pnpm format` to autofix). Vitest picks up `src/**/*.test.ts`.
- I removed `cacheComponents`/`partialPrefetching` from next.config.ts (default dynamic behaviour, fewer surprises with SSE/SQLite routes) and added `serverExternalPackages` for libsql/sharp/remotion. next.config.ts is yours from now on; keep `serverExternalPackages`.
- Note: Next 16 ships breaking changes; docs are in `node_modules/next/dist/docs/` (see AGENTS.md).
- Next from me: `src/contracts` (schemas + fixtures) within the hour; import everything from `@/contracts`.

## 2026-10-11T23:24 from Mete (human): new signature screen: Reverse-engineer view (B12b)
Read docs/PRODUCT_SPEC.md 2.3b and the new task B12b plus signature moment 0 in docs/DESIGN.md. The product's core: the agent watches a winning ad, dissects it shot by shot (Blueprint), remakes it for our brand (aligned via shotMap) and reviews its own render (Review scores). New types arrive in @/contracts with Lane A's A02; until then mirror docs/ARCHITECTURE.md section 5. This screen is the most important demo moment; budget real time for it.

## 2026-10-11T23:28:37+0300 from A: A02 landed, contracts + fixtures on main
Import everything from `@/contracts` (pure TS + Zod 4, safe in client components):
- Schemas + types (same name for both): `Brand`, `BrandSummary` (GET /api/brands item: Brand + `counts` + `lastRun`), `BrandDossier`, `Connection`, `Run`, `RunEvent`, `Evidence`, `Question`, `ChannelPlan`, `ChannelRec`, `Concept`, `Shot`, `Asset`, `ComplianceCheck`, `PublishPack`, `MetricSnapshot`, `Learning`, `SpendEntry`, `ProviderStatus`. Enums as const arrays + labels: `CHANNELS`, `CHANNEL_LABELS`, `PHASES`, `SCORE_AXES`, `SCORE_AXIS_LABELS`, `PROVIDER_IDS`, `PROVIDER_INFO` (label/usedFor/role), `PRODUCT_NAME`.
- Routes: `API.brands()`, `API.brand(idOrSlug)` (brand routes accept the slug too), `API.runEvents(id)`, ... and request/response schemas (`CreateBrandRequest`, `AnswersRequest`, `ResultsResponse`, `SpendResponse`, ...). Errors are `{error:{code,message}}`.
- SSE (`/api/runs/:id/events`): `id` = RunEvent.id, `event` = RunEvent.type, `data` = RunEvent JSON; `: ping` every 15 s; final `event: end` data `{status}`. Additive event type `status` carries `data.status` (running / waiting_input / done ...). Chat SSE: `token` {text}, `question` Question, `done`, `error`.
- Fixtures for your mock: `SEED_BRANDS`, `DEMO_RUNS[slug]` (slugs: hound, aclinic, dynova, evreon) = `{brand, run, connections, evidence, questions, plan, concepts, compliance, packs, assets, events}`. `events` is a complete ordered RunEvent log (~100 to 140 events) you can replay with delays; it pauses logically at the `status: waiting_input` event in consult. Hound and a.clinic: 32 evidence from 9 sources, 6 questions with `why` + `evidenceIds`, plan with `scores`, `weights`, `notNow`, `considered` (every channel scored), 4 concepts (3 with shot lists, 1 text post with `body`), compliance checks incl. one fail-then-revised example (`attempt` 0 fail, 1 pass), 4 packs.
- All demo rows have `demo: true` (show the "Demo data" badge). Seed brands themselves are real (`demo: false`).
- Logos/reference images: `brand.dossier.visual.logoUrl` / `referenceImages` point at `/api/assets/brands/<slug>/<file>`; I serve `assets/brands/` from that route in A03. Until then, your own copy under `public/brands/` works.
- Full list of additive fields beyond ARCHITECTURE §5 is in `coord/CONTRACT_CHANGES.md`. Need a change? Write it here in INBOX_A; contract requests are my top priority at each task boundary.
Next from me: A03 SQLite + `/api/brands` (real routes), then A05 SSE run stream in demo mode.
