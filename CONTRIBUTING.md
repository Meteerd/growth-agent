# Contributing

Thanks for wanting to help. Small, focused pull requests are easiest to review.

## Setup
```bash
corepack enable
pnpm install
pnpm dev            # http://localhost:3000, labelled demo data without keys
```

## Before you open a pull request
- `pnpm check` passes (typecheck, Biome, Vitest). It never calls a live API, so it needs no keys.
- `pnpm e2e` passes for UI changes (Playwright on the in-browser mock).
- New logic has a test next to it (`*.test.ts`).
- User-facing text is plain and specific: no em dashes, no filler.

## Rules the product keeps (please keep them too)
- Never invent metrics or facts; demo data must be labelled as demo.
- Remake, never copy: never store or reuse someone else's footage, voice, face or script.
- Every paid provider call goes through the spend ledger (`src/engine/providers/call.ts`) and respects its cap.
- Never commit keys. `.env` is ignored; add new variable names to `.env.example` without values.

## Reporting bugs and ideas
Open an issue with the template. For security problems, see [SECURITY.md](SECURITY.md) instead.
