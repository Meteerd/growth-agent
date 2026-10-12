#!/usr/bin/env bash
# B19c: a clean snapshot of the app for the public repo (no git history). It only writes a local folder: it never
# pushes; a human creates the public repo. Fails if the secret scan finds anything that looks like a key.
# Usage: scripts/export-public.sh <dir>     (e.g. ../growth-agent-public; the folder must be new or empty)
set -euo pipefail
OUT="${1:?usage: scripts/export-public.sh <dir>}"
cd "$(git rev-parse --show-toplevel)"
if [ -d "$OUT" ] && [ -n "$(ls -A "$OUT")" ]; then echo "$OUT is not empty"; exit 1; fi
mkdir -p "$OUT"

# tracked files only, minus internal notes, runtime data, recordings and anything private (Camplan stays local)
LIST="$(mktemp)"
git ls-files \
  | grep -Ev '^(\.env|data/|logs/|demo/recordings/|node_modules/|coord/|\.claude/|AGENTS\.md|CLAUDE\.md|e2e/screens/live/)' \
  | grep -Ev '^docs/' \
  | grep -Evi 'camplan' > "$LIST"
# docs: only the product, architecture, design and brand rules, our own renders, and the public README source
git ls-files docs | grep -E '^docs/(PRODUCT_SPEC|ARCHITECTURE|DESIGN|BRANDS)\.md$|^docs/renders/' >> "$LIST"
rsync -a --files-from="$LIST" ./ "$OUT/"
rm -f "$LIST"
cp docs/PUBLIC_README.md "$OUT/README.md"

# secret scan: provider key shapes, private keys, and any KEY/TOKEN/SECRET assignment with a value
PATTERNS='sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{35}|apify_api_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|gh[ousr]_[A-Za-z0-9]{30,}|xox[abpr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(API_KEY|_TOKEN|_SECRET|_KEY)=[^[:space:]$]{12,}'
if HITS="$(grep -rEn --binary-files=without-match "$PATTERNS" "$OUT")"; then
  echo "SECRET SCAN FAILED: remove these before publishing:"
  echo "$HITS" | cut -c1-200
  exit 1
fi
FILES="$(find "$OUT" -type f | wc -l | tr -d ' ')"
SIZE="$(du -sh "$OUT" | cut -f1)"
echo "export ok: $FILES files, $SIZE in $OUT; secret scan clean; nothing was pushed"
