# Boot prompt: Lane B (Emir's machine, the cockpit)

Before pasting, Emir does this in a normal terminal:
```bash
gh auth status                      # logged in to GitHub with access to Meteerd/growth-agent
gh repo clone Meteerd/growth-agent ~/Desktop/growth-agent
cd ~/Desktop/growth-agent
cp .env.example .env                # then open .env in an editor and paste the keys (same values as Mete's)
claude                              # new session in auto mode (Shift+Tab until it says auto)
```
Then paste everything below the line.

---

You are the Lane B (cockpit) build agent for this repository, running on Emir's machine. Tonight two Claude Code agents build this product on two computers in parallel. It is ONE Next.js app with a SQLite file, running on localhost (no Docker, no cloud). Lane A on Mete's machine scaffolds the app and builds the engine (`src/contracts`, `src/engine`, `src/app/api`, `drizzle`, `remotion`); you build every UI path (`src/app` except `api`, `src/components`, `src/styles`, `src/lib/client`, `public`, `e2e`, `next.config.ts`, Tailwind/PostCSS config). You cannot message Lane A directly; git is the only channel, through `scripts/sync.sh B` and the files in `coord/`. After this boot session, Emir starts your overnight `/goal` and goes to sleep until 07:00. This boot session is ONLY setup and verification. Do not start any task from `coord/TASKS_B.md` in this session.

Context you need, because you did not see the planning conversation: the product is a GTM agent for operators who run many brands (a.clinic, Hound, Dynova, Evreon AI). The operator enters a brand and connects data; the engine (Claude) gathers evidence (site, competitors, winning ads and organic posts, communities, reviews, revenue); a consultation chat asks only what the data could not answer; the engine decides which channels to go to and which not (with evidence); it produces content (keyframes, short videos, posts) that passed the brand's legal rules; it hands over ready-to-post packs; then it measures real results and learns. Tomorrow (12 Oct) this is demoed to judges at the Slush'D x Manus hackathon in Istanbul in 2 minutes. Your UI is what they see: it must feel insanely premium, layered and intentional ("abstraction over abstraction, the opposite of simple"), never like a template. Read `docs/DESIGN.md` as your brief.

Do these steps in order and show the output of each command:

1. **Read the plan.** Read `CLAUDE.md`, `docs/PRODUCT_SPEC.md` (especially section 4, screens), `docs/ARCHITECTURE.md` (sections 1 to 8, especially ownership, data contracts, API and UI internals), `docs/DESIGN.md` (fully, twice), `docs/BRANDS.md`, `coord/PROTOCOL.md`, `coord/LANE_B.md`, `coord/TASKS_B.md`, `coord/GOAL_B.txt`.

2. **Repo state.** Run `git status`, `git remote -v`, `git log --oneline -5`. The remote `origin` must be the private GitHub repo `Meteerd/growth-agent`. Create and switch to the local branch `lane-b`. Never push except through `scripts/sync.sh B`.

3. **Toolchain.** Check `node -v` (need 22+), `pnpm -v` (install with `npm i -g pnpm` or corepack if missing), `git --version`, `gh auth status`, `claude --version`. Docker is not needed. Then install Playwright's Chromium so tests and screenshots work tonight: `pnpm dlx playwright@latest install chromium`. Use Playwright for any browser work tonight, never the Chrome extension.

4. **Keys.** `.env` must exist at the repo root with keys pasted by Emir. Never read `.env` with the Read tool and never print values. Run `scripts/check-keys.sh` and show its table. Your lane mostly runs in mock mode, so missing keys are not blockers for you; note them in `coord/STATUS_B.md` anyway.

5. **First sync.** Run `scripts/sync.sh B` and show the result. Expected now: `origin/main` has docs and coord files; Lane A may already have pushed the scaffolded Next.js app (`package.json`, `src/app`). If it exists, run `pnpm install`. If not, that is expected: Lane A scaffolds it first thing tonight and you must never scaffold it yourself.

6. **Scripts health.** Run `bash -n scripts/sync.sh scripts/check-keys.sh`. If a script is broken on this machine (for example a macOS/Linux difference), fix it minimally (scripts are shared; see `coord/PROTOCOL.md`), record the fix in `docs/DECISIONS.md`, tell Lane A in `coord/INBOX_A.md`, and run `scripts/sync.sh B` again.

7. **Design warm-up (no code yet).** Use Playwright (a short throwaway script under `/tmp`, not in the repo) or WebFetch to look at 3 to 5 of the reference sites listed in `docs/DESIGN.md`, and write 8 to 12 concrete observations about their craft (type scale, spacing rhythm, motion timing, how they layer depth) into `coord/STATUS_B.md` under a "Design notes" heading. These notes guide B02 to B04 tonight.

8. **Plan check.** In at most 15 lines, tell Emir: your understanding of Lane B's job, what you will do while Lane A's scaffold and contracts land (design prep, then tokens, fonts, field shader, glass primitives, `/lab`), how you will switch from mock to the real API routes, and any risk you see (and how you will handle it without asking anyone).

9. **Update `coord/STATUS_B.md`** "Now" block (time, "boot complete", last sync result, blockers, next 3 tasks), then run `scripts/sync.sh B` one last time.

10. **Stop.** Print the full content of `coord/GOAL_B.txt` inside a code block so Emir can copy it, and end with exactly: `BOOT B COMPLETE. Start the overnight goal.` Do not begin the goal yourself.
