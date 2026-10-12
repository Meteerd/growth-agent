#!/usr/bin/env bash
# Offline demo proof. Phase 1 starts the app online and warms the local cover cache (data/thumbs), like a rehearsal.
# Phase 2 restarts it with every non-loopback DNS lookup and socket refused (e2e/offline-net.cjs) and walks the pitch path
# in Playwright with every non-localhost browser request aborted. Exit 0 = the demo survives the venue Wi-Fi dropping.
# Usage: demo/offline-check.sh                         dev server, this machine's database
#        OFFLINE_MODE=showcase demo/offline-check.sh   the public showcase build (production, fresh database)
# Stop other `next dev` servers in this folder first. Zero spend: LIVE_PROVIDERS is empty.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
mkdir -p logs
PORT="${OFFLINE_PORT:-3300}"
export NEXT_TELEMETRY_DISABLED=1 NEXUS_TEST=1 LIVE_PROVIDERS= NEXT_PUBLIC_DATA_MODE=live
NEXT=(./node_modules/.bin/next dev -p "$PORT")
if [ "${OFFLINE_MODE:-dev}" = showcase ]; then
  FRESH="$(mktemp -d)"
  export NEXT_PUBLIC_DATA_MODE=showcase DATABASE_URL="file:$FRESH/showcase.db" ASSETS_DIR="$FRESH/assets"
  ./node_modules/.bin/next build >logs/offline-build.log 2>&1 || { echo "build failed, see logs/offline-build.log"; exit 1; }
  NEXT=(./node_modules/.bin/next start -p "$PORT")
fi

serve() { # $1 = extra NODE_OPTIONS
  NODE_OPTIONS="$1" "${NEXT[@]}" >"logs/offline-server-$2.log" 2>&1 &
  SERVER=$!
  for _ in $(seq 1 60); do curl -sf -o /dev/null "localhost:$PORT/api/health" && return 0; sleep 2; done
  echo "server did not start, see logs/offline-server-$2.log"; return 1
}
stop() { kill "$SERVER" 2>/dev/null; wait "$SERVER" 2>/dev/null; sleep 1; }
trap stop EXIT

echo "== phase 1: online, warm the cover cache"
serve "" online || exit 1
E2E_DATA=live E2E_PORT=$PORT E2E_WARM=1 pnpm exec playwright test e2e/offline.spec.ts >logs/offline-warm.log 2>&1
echo "warm: exit $? (logs/offline-warm.log)"
stop

echo "== phase 2: offline server + offline browser, walk the pitch path"
serve "--require ./e2e/offline-net.cjs" offline || exit 1
E2E_DATA=live E2E_PORT=$PORT pnpm exec playwright test e2e/offline.spec.ts >logs/offline-check.log 2>&1
CODE=$?
grep -E "passed|failed|Error" logs/offline-check.log | head -20
echo "== offline demo check: exit $CODE"
exit $CODE
