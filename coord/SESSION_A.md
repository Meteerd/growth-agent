# Boot prompt: Lane A (Mete's machine, the engine)

Paste everything below the line into a NEW Claude Code session opened at the repo root (`growth-agent/`), in auto mode.

---

You are the Lane A (engine) build agent for this repository, running on Mete's machine. Tonight two Claude Code agents build this product on two computers in parallel: you (Lane A: `packages/contracts`, `apps/engine`, `packages/video`, root config) and Lane B on Emir's machine (`apps/web`, the cockpit UI). You cannot message Lane B; git is the only channel, through `scripts/sync.sh`. After this boot session, the humans start your overnight `/goal` and go to sleep until 07:00. This boot session is ONLY setup and verification. Do not start any task from `coord/TASKS_A.md` in this session.

Do these steps in order and show the output of each command:

1. **Read the plan.** Read `CLAUDE.md`, `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/APIS.md`, `docs/BRANDS.md`, `coord/PROTOCOL.md`, `coord/LANE_A.md`, `coord/TASKS_A.md`, `coord/GOAL_A.txt`. Load the `claude-api` skill once so you know the current Anthropic SDK patterns.

2. **Repo state.** Run `git status`, `git remote -v`, `git log --oneline -5`. The remote `origin` must be the private GitHub repo `Meteerd/growth-agent`. Switch to (or create) the local branch `lane-a`. Do not push anything except through `scripts/sync.sh A`.

3. **Toolchain.** Check `node -v` (need 22+), `pnpm -v`, `git --version`, `gh auth status`, `docker info` (if Docker is not running, start it with `open -a Docker` and wait until `docker info` succeeds), `claude --version`. If `ffmpeg` is missing, install it with `brew install ffmpeg` (allowed). Report anything else missing and install it if it is a normal developer tool.

4. **Keys.** `.env` must exist at the repo root (copied from `.env.example`, keys pasted by Mete). Never read `.env` with the Read tool, never print values. Run `scripts/check-keys.sh` and show its table. For every provider marked MISSING or INVALID, say what it means for tonight (which tasks fall back to demo) and add a line to `coord/STATUS_A.md` under "Blockers". If `ANTHROPIC_API_KEY` is missing or invalid, stop and tell the human, because the engine cannot run live without it.

5. **First sync.** Run `scripts/sync.sh A` and show the result. Expected now: `origin/main` has only docs and coord files; checks are skipped because the root `package.json` does not exist yet (creating it is your task A01 tonight).

6. **Scripts health.** Run `bash -n scripts/sync.sh scripts/check-keys.sh`. If a script is broken, fix it minimally (scripts are shared; see `coord/PROTOCOL.md`), record the fix in `docs/DECISIONS.md`, and run `scripts/sync.sh A` again.

7. **Plan check.** In at most 15 lines, tell the human: your understanding of Lane A's job, the order you will do A01 to A04 in the first hour (root workspace, contracts and the INBOX_B message to unblock Lane B first), which providers will be live tonight given the key table, and any risk you see in the plan (and how you will handle it without asking anyone).

8. **Update `coord/STATUS_A.md`** "Now" block (time, "boot complete", last sync result, blockers, next 3 tasks), then run `scripts/sync.sh A` one last time.

9. **Stop.** Print the full content of `coord/GOAL_A.txt` inside a code block so the human can copy it, and end with exactly: `BOOT A COMPLETE. Start the overnight goal.` Do not begin the goal yourself.
