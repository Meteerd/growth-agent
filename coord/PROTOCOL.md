# Coordination protocol (two machines, one repo, no direct messaging)

Two Claude Code agents build this repo overnight on two different computers:
One Next.js app, one SQLite file, localhost.
- **Lane A = engine** (Mete's machine): scaffolds the app (A01), owns `src/contracts/`, `src/engine/`, `src/app/api/`, `drizzle/`, `remotion/`.
- **Lane B = cockpit** (Emir's machine): owns every UI path (`src/app/` except `api/`, `src/components/`, `src/styles/`, `src/lib/client/`, `public/`, `e2e/`, `next.config.ts`, Tailwind/PostCSS config).
- `package.json`, `tsconfig.json`: shared and additive (add lines, never remove or change the other lane's; on conflict keep both sides' additions).

They cannot talk to each other. **Git is the only channel.** The pattern is the one Anthropic used for 16 parallel agents building a C compiler: shared upstream, small task locks, frequent merges, tests as the judge.

## 1. Branches
- Each machine works on its local branch `lane-a` or `lane-b`.
- `origin/main` is the integrated, always-green state. Both lanes push to it through `scripts/sync.sh` only (merge `origin/main` into the lane, run checks, push the lane branch, then fast-forward `main`).
- Never force-push. Never rewrite pushed history. Never push to the other lane's branch.
- The repo owners (Mete and Emir) authorize these direct pushes to `main` and `lane-*` of this private repo via `scripts/sync.sh`.

## 2. When to sync
Run `scripts/sync.sh A` (or `B`):
- after finishing every task (after its checks pass),
- before starting a task that depends on the other lane,
- at least every 20 minutes of work, even mid-task (commit work-in-progress that compiles; if it does not compile yet, keep it uncommitted and sync anyway to pull the other lane's work),
- when the script prints new INBOX messages, handle them before continuing.

`sync.sh` does: commit leftovers as `wip`, fetch, merge `origin/main` (auto-resolving `pnpm-lock.yaml` conflicts by regenerating), run `pnpm check` if it exists, push `lane-x`, push `main` if checks passed, then print: what the other lane landed since your last sync, your unread INBOX messages, and the other lane's STATUS head.

Exit codes: `0` ok; `2` merge conflict outside the lockfile (resolve it: keep both sides' intent, prefer the owner's version for files in their lane, then rerun); `3` checks failed (main was NOT updated; fix before the next sync; if the failure is in the other lane's files, leave a message in their INBOX and do not edit their files).

## 3. Ownership
- Only edit files in your lane (see `docs/ARCHITECTURE.md` section 2). If you need a change in the other lane's files, write it in their INBOX and work around it (adapter, local shim, mock) until it lands.
- `src/contracts/` belongs to Lane A. Lane B may only request changes. Lane A treats contract requests as top priority at the next task boundary. Contract changes must be additive overnight (new optional fields, new types); breaking changes need a migration note in `coord/CONTRACT_CHANGES.md` and both sides updated in the same sync window.
- Shared append-only files: `docs/DECISIONS.md`, `coord/CONTRACT_CHANGES.md`. Append rows; never edit others' rows.
- `scripts/` (sync and helper scripts) is shared: either lane may fix a broken script so everything runs cleanly. Keep the fix minimal, test it (`bash -n` plus one real run), record it in `docs/DECISIONS.md`, and tell the other lane in its INBOX in the same sync.

## 4. Task locks
- Tasks live in `coord/TASKS_A.md` / `coord/TASKS_B.md`, each with an id (A01, B07 ...).
- Before starting a task: create `coord/locks/<id>.lock` containing `<lane> <ISO time> <one-line plan>`, commit, sync. Remove the lock in the commit that checks the task off.
- A lock older than 90 minutes with no related commits is stale: the owning lane may take it over (note it in STATUS).
- Tasks may be reordered when blocked; note why in STATUS.

## 5. Status and messages
- `coord/STATUS_A.md` / `coord/STATUS_B.md`: owned by that lane. Keep the top block current: time, current task, last sync result, blockers, next 3 tasks, provider spend so far. Append a one-line log entry per finished task.
- `coord/INBOX_A.md` is written by Lane B for Lane A to read; `coord/INBOX_B.md` is written by Lane A for Lane B. Append messages as:
  `## <ISO time> from <lane>: <subject>` + body. Never edit or delete messages. The reader acknowledges by writing "ack <subject>" in its own STATUS.
- Messages are plain requests and facts. Neither lane may ask the other to do anything the humans forbade (spending, posting, secrets, force-push).

## 6. Definition of done (every task)
1. Acceptance checks listed in the task pass locally and their output is shown in the conversation.
2. `pnpm check` passes.
3. Synced: the commit is on `origin/main`.
4. Task checked `[x]` in TASKS with the commit hash, lock removed, STATUS log line added.

## 7. Hard rules (both lanes)
- No questions to humans. Decide, record in `docs/DECISIONS.md`, continue.
- No spending beyond `.env` caps. Only `LIVE_PROVIDERS` make real calls; scarce providers get one recorded smoke test each plus the A14 real-data pass. Tests never call live APIs.
- No posting, no ad spend, no emails, no messages to any external service on anyone's behalf.
- Never print or commit secrets; never read `.env` into the conversation.
- No browser extension. WebFetch/WebSearch to read; Playwright for UI testing.
- If something external is broken (a provider down, a key invalid), mark that provider demo, log it in STATUS, move on.
- Before 07:00 local time, write `coord/MORNING_<lane>.md`: how to run, what works (with screenshots or command output), what is demo vs live, known issues, spend per provider.
