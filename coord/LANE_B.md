# Lane B: the cockpit (Emir's machine)

You are the product designer-engineer. It is one Next.js app on localhost; you own every UI path: `src/app/` (except `src/app/api/`), `src/components/`, `src/styles/`, `src/lib/client/`, `public/`, `e2e/`, `next.config.ts`, Tailwind/PostCSS config, `playwright.config.ts`. Lane A (Mete's machine) scaffolds the app (A01) and owns `src/contracts/`, `src/engine/`, `src/app/api/`, `drizzle/`, `remotion/`. You never edit those. `package.json` and `tsconfig.json` are shared: add lines, never remove or change Lane A's. This UI is what the judges see for two minutes; it carries "execution and quality" and "pitch".

## Your three priorities, in order
1. **A working cockpit end to end in mock mode early.** A client-side mock built from `@/contracts` fixtures with a scripted run, so every screen in `docs/PRODUCT_SPEC.md` section 4 works before Lane A's API routes exist. Then switch to the real routes (`NEXT_PUBLIC_DATA_MODE=live`) as soon as they land, and keep both modes working.
2. **Signature moments at studio quality.** Read `docs/DESIGN.md` fully. Landing hero, run cockpit, consultation, direction orbit map and studio storyboard must look like a top studio built them. No default component styling anywhere. Motion is choreographed, not sprinkled.
3. **Proof it works.** Playwright e2e for the full journey (enter brand, run, consult, direction, studio, packs, results) in mock mode, plus screenshots of every screen at desktop and mobile committed for the morning review.

## Before Lane A's scaffold lands (first ~15 min)
Do not scaffold the app yourself. Run `scripts/sync.sh B` every 3 to 5 minutes until `package.json` and `src/app` exist on main. Meanwhile do design prep that needs no code: refine tokens and the screen-by-screen motion plan in `docs/DESIGN.md` (you own that file) and collect reference observations. After the scaffold lands, build tokens, fonts, the field shader, glass primitives and `/lab` first, since they do not depend on contracts. If contracts are not there yet when you need types, use a temporary `src/lib/client/contracts-shim.ts` mirroring `docs/ARCHITECTURE.md` section 5 and delete it when `@/contracts` lands.

## Data layer
- `src/lib/client/api.ts`: typed fetch client for `/api/...` using `@/contracts` schemas (validate responses in dev).
- `src/lib/client/sse.ts`: EventSource wrapper with reconnect and `Last-Event-ID`.
- `src/lib/client/mock/`: in-browser mock that serves fixtures and plays a full run in about 60 seconds, including a pause at consult that resumes when answers are posted. A "Demo data" badge shows whenever data is demo.
- TanStack Query for fetching and cache; Zustand only for UI state.

## Craft rules
- Server components where they help; client components for motion and the shader.
- The shader never blocks interaction: DPR cap 1.5, pause when hidden, static fallback for `prefers-reduced-motion`.
- Numbers in mono with tabular figures; changing numbers use a ticker.
- Every loading, empty and error state is designed.
- Copy: plain and specific, no em dashes, no AI filler ("Unlock", "Supercharge", "Seamless" are banned).
- Accessibility: semantic HTML, focus rings, labels, contrast on glass >= 4.5:1 for body text.

## Done means
Every CORE task in `coord/TASKS_B.md` checked with acceptance output shown, `pnpm check` green, Playwright e2e green in mock mode (and against the real API when it is up), screenshots committed, `coord/MORNING_B.md` written, everything on `origin/main`.
