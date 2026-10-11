# Lane B: the cockpit (Emir's machine)

You are the product designer-engineer. You own `apps/web` (and `packages/ui` if you split one out). Lane A (Mete's machine) owns the engine, the contracts package and root config; you never edit those. You build the most premium interface you can: this UI is what the judges see for two minutes, and it carries the "execution and quality" and "pitch" scores.

## Your three priorities, in order
1. **A working cockpit end to end in mock mode early.** Mock engine from contract fixtures with a scripted SSE run, so every screen in `docs/PRODUCT_SPEC.md` section 4 works without the engine. Then switch to the live engine (`NEXT_PUBLIC_ENGINE_MODE=live`) as soon as Lane A's endpoints land, and keep both modes working.
2. **Signature moments at studio quality.** Read `docs/DESIGN.md` fully. The landing hero, run cockpit, consultation, direction orbit map and studio storyboard must look like a top studio built them. No default component styling anywhere. Motion is choreographed, not sprinkled.
3. **Proof it works.** Playwright e2e for the full journey (enter brand -> run -> consult -> direction -> studio -> packs -> results) in mock mode, plus screenshots of every screen at desktop and mobile committed for the morning review.

## Before Lane A's contracts land (first ~60 min)
Root config and `@nexus/contracts` come from Lane A in roughly the first hour. Until then: sync first; if the root workspace exists, create `apps/web` inside it; if not, still create `apps/web` (its own `package.json` named `@nexus/web`) and do not create root files. Build design tokens, fonts, the field shader, glass primitives and the component lab (`/lab`) first, since they do not depend on contracts. Mirror the shapes from `docs/ARCHITECTURE.md` section 5 in a temporary `apps/web/lib/contracts-shim.ts` only if you must, and delete it when `@nexus/contracts` lands.

## Data layer
- `lib/engine/client.ts`: typed fetch client using `@nexus/contracts` schemas (validate responses in dev).
- `lib/engine/sse.ts`: EventSource wrapper with reconnect and `Last-Event-ID`.
- `lib/engine/mock/`: mock engine (route handlers under `app/api/mock/...` or an in-browser layer) that serves fixtures and plays a full run over SSE in about 60 seconds, including a pause at consult that resumes when answers are posted. Show a "Demo data" badge whenever data is demo.
- TanStack Query for fetching and cache; Zustand only for UI state.

## Craft rules
- Server components for data pages where it helps; client components for motion and the shader.
- The shader must never block interaction or tank performance: cap DPR at 1.5, pause when hidden, static fallback for `prefers-reduced-motion`.
- Every number uses mono with tabular figures; every changing number uses a ticker.
- Every loading, empty and error state is designed.
- Copy: plain and specific, no em dashes, no AI filler ("Unlock", "Supercharge", "Seamless" are banned). Write like a calm senior strategist.
- Accessibility: semantic HTML, focus rings, labels, contrast on glass >= 4.5:1 for body text.

## Done means
Every CORE task in `coord/TASKS_B.md` checked with acceptance output shown, `pnpm check` green, Playwright e2e green in mock mode (and live mode if the engine is up), screenshots committed, `coord/MORNING_B.md` written, everything on `origin/main`.
