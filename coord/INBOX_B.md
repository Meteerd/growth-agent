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
