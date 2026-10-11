#!/usr/bin/env bash
# Sync this lane with origin/main and learn what the other lane did.
# Usage: scripts/sync.sh A|B
# Exit: 0 ok | 1 usage/env error | 2 merge conflict to resolve | 3 checks failed (main not updated)
set -uo pipefail

LANE="${1:-}"
case "$LANE" in
  A|a) LANE=A; OTHER=B; BRANCH=lane-a ;;
  B|b) LANE=B; OTHER=A; BRANCH=lane-b ;;
  *) echo "usage: scripts/sync.sh A|B"; exit 1 ;;
esac

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not in a git repo"; exit 1; }
cd "$ROOT"
mkdir -p logs
STATE_DIR="$(git rev-parse --git-dir)/nexus-sync"
mkdir -p "$STATE_DIR"

# 0. Make sure we are on the lane branch.
CUR="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CUR" != "$BRANCH" ]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then git checkout "$BRANCH" --quiet
  else git checkout -b "$BRANCH" --quiet; fi
fi

# 1. Commit leftovers as wip (only if something changed).
git add -A
if ! git diff --cached --quiet; then
  git commit --quiet -m "wip(lane $LANE): sync checkpoint $(date +%H:%M)"
fi

# 2. Fetch and report what landed on main since our last sync.
LAST_SEEN_FILE="$STATE_DIR/last_main_$LANE"
LAST_SEEN="$(cat "$LAST_SEEN_FILE" 2>/dev/null || true)"
git fetch origin --quiet || { echo "SYNC: fetch failed (network?). Continue working and retry later."; exit 1; }
if git show-ref --verify --quiet refs/remotes/origin/main; then
  MAIN="$(git rev-parse origin/main)"
  echo "=== Landed on main since your last sync ==="
  if [ -n "$LAST_SEEN" ] && git cat-file -e "$LAST_SEEN" 2>/dev/null; then
    git log --oneline --no-decorate "$LAST_SEEN..$MAIN" | head -40
  else
    git log --oneline --no-decorate -15 "$MAIN"
  fi
  echo "$MAIN" > "$LAST_SEEN_FILE"
else
  MAIN=""
  echo "=== origin/main does not exist yet ==="
fi

# 3. Merge origin/main into the lane branch.
if [ -n "$MAIN" ]; then
  if ! git merge --no-edit --quiet origin/main; then
    CONFLICTS="$(git diff --name-only --diff-filter=U)"
    if [ "$CONFLICTS" = "pnpm-lock.yaml" ]; then
      echo "SYNC: lockfile conflict only, regenerating pnpm-lock.yaml"
      git checkout --theirs pnpm-lock.yaml
      pnpm install --lockfile-only >/dev/null 2>&1 || pnpm install >/dev/null 2>&1
      git add pnpm-lock.yaml
      git commit --quiet --no-edit || true
    else
      echo "SYNC: MERGE CONFLICT in:"; echo "$CONFLICTS"
      echo "Resolve: keep both sides' intent; for files owned by the other lane prefer their version; then rerun scripts/sync.sh $LANE"
      exit 2
    fi
  fi
fi

# 4. Install if the lockfile changed, then run checks.
if [ -f package.json ]; then
  LOCK_HASH="$(shasum pnpm-lock.yaml 2>/dev/null | cut -d' ' -f1)"
  if [ "$LOCK_HASH" != "$(cat "$STATE_DIR/lock_$LANE" 2>/dev/null)" ]; then
    pnpm install >logs/sync_install.log 2>&1 || { echo "SYNC: pnpm install failed, see logs/sync_install.log (tail below)"; tail -20 logs/sync_install.log; }
    echo "$LOCK_HASH" > "$STATE_DIR/lock_$LANE"
  fi
fi
CHECK_OK=1
if [ -f package.json ] && grep -q '"check"' package.json; then
  echo "=== pnpm check ==="
  if pnpm -s check >logs/sync_check.log 2>&1; then
    echo "check: PASS"
  else
    CHECK_OK=0
    echo "check: FAIL (main NOT updated). Last lines of logs/sync_check.log:"
    grep -E "ERR|Error|error|FAIL|failed" logs/sync_check.log | tail -25
  fi
else
  echo "check: skipped (no root check script yet)"
fi

# 5. Push the lane branch always; push main only when checks passed.
git push --quiet origin "$BRANCH" 2>/dev/null || git push --quiet -u origin "$BRANCH" || echo "SYNC: push of $BRANCH failed"
PUSHED_MAIN=0
if [ "$CHECK_OK" = "1" ]; then
  for i in 1 2 3; do
    if git push --quiet origin "HEAD:main" 2>/dev/null; then PUSHED_MAIN=1; break; fi
    echo "SYNC: main moved, re-merging (attempt $i)"
    git fetch origin --quiet && git merge --no-edit --quiet origin/main || { echo "SYNC: conflict during retry, rerun sync"; exit 2; }
  done
fi

# 6. Unread inbox messages and the other lane's status.
INBOX="coord/INBOX_$LANE.md"
SEEN_FILE="$STATE_DIR/inbox_lines_$LANE"
if [ -f "$INBOX" ]; then
  TOTAL="$(wc -l < "$INBOX" | tr -d ' ')"
  SEEN="$(cat "$SEEN_FILE" 2>/dev/null || echo 1)"
  if [ "$TOTAL" -gt "$SEEN" ]; then
    echo "=== NEW MESSAGES in $INBOX (handle them at this task boundary) ==="
    tail -n +"$((SEEN + 1))" "$INBOX"
  else
    echo "=== $INBOX: no new messages ==="
  fi
  echo "$TOTAL" > "$SEEN_FILE"
fi
if [ -f "coord/STATUS_$OTHER.md" ]; then
  echo "=== Lane $OTHER status (head) ==="
  head -12 "coord/STATUS_$OTHER.md"
fi

echo "=== SYNC RESULT: lane $LANE | branch $BRANCH pushed | main $( [ "$PUSHED_MAIN" = 1 ] && echo UPDATED || echo 'NOT updated' ) | checks $( [ "$CHECK_OK" = 1 ] && echo PASS || echo FAIL ) | $(date '+%H:%M') ==="
[ "$CHECK_OK" = "1" ] || exit 3
exit 0
