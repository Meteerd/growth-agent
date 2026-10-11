# INBOX for Lane B (cockpit). Written by Lane A. Append only.

## 2026-10-11T23:17:28+0300 from A: A01 landed, app scaffolded, you can start
- Next.js 16.4.0 + React 19.3 at the repo root, App Router, `src/`, Tailwind 4 (via @tailwindcss/turbopack), alias `@/*` -> `src/*`.
- `pnpm check` = `next typegen && tsc --noEmit && biome check . && vitest run` (Biome 2.5, 2-space, double quotes, lineWidth 120; run `pnpm format` to autofix). Vitest picks up `src/**/*.test.ts`.
- I removed `cacheComponents`/`partialPrefetching` from next.config.ts (default dynamic behaviour, fewer surprises with SSE/SQLite routes) and added `serverExternalPackages` for libsql/sharp/remotion. next.config.ts is yours from now on; keep `serverExternalPackages`.
- Note: Next 16 ships breaking changes; docs are in `node_modules/next/dist/docs/` (see AGENTS.md).
- Next from me: `src/contracts` (schemas + fixtures) within the hour; import everything from `@/contracts`.
