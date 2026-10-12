#!/usr/bin/env bash
# Safe deploy of the read-only showcase to the AWS Lightsail server.
# Usage: deploy/aws/deploy.sh [git-ref=main]
# Builds a fresh release next to the running one, health-checks it on a spare port,
# and only then switches traffic. If anything fails, the live site keeps running.
set -euo pipefail
HOST="${NEXUS_HOST:-ubuntu@63.181.87.203}"
REF="${1:-main}"
ssh -o BatchMode=yes "$HOST" bash -s -- "$REF" <<'REMOTE'
set -euo pipefail
REF="$1"
BASE=/srv/nexus
REPO=git@github.com:Meteerd/growth-agent.git
mkdir -p "$BASE/releases" "$BASE/shared"
ENVF="$BASE/shared/.env.production"
if [ ! -f "$ENVF" ]; then
  cat > "$ENVF" <<'ENVEOF'
# Read-only showcase: no API keys on this server, ever.
NODE_ENV=production
NEXT_PUBLIC_DATA_MODE=showcase
LIVE_PROVIDERS=
DATABASE_URL=file:/srv/nexus/shared/nexus.db
ASSETS_DIR=/srv/nexus/shared/assets
ENVEOF
fi
# refuse to deploy if anyone put a provider key into the server env
if grep -Eq '^(ANTHROPIC|OPENAI|FAL|APIFY|MANUS|ELEVENLABS|GEMINI|SPIRAL|FIRECRAWL|HIGGSFIELD|YOUTUBE)[A-Z_]*=.+' "$ENVF"; then
  echo "DEPLOY ABORTED: provider keys found in $ENVF (showcase must have none)"; exit 1
fi
SHA=$(git ls-remote "$REPO" "refs/heads/$REF" | cut -c1-12)
[ -n "$SHA" ] || { echo "unknown ref $REF"; exit 1; }
REL="$BASE/releases/$SHA"
if [ ! -d "$REL/.next" ]; then
  rm -rf "$REL"
  git clone -q --depth 1 --branch "$REF" "$REPO" "$REL"
  cd "$REL"
  cp "$ENVF" .env.production.local
  set -a; . "$ENVF"; set +a
  corepack pnpm install --frozen-lockfile > "$BASE/shared/install-$SHA.log" 2>&1 || { echo "install failed, see $BASE/shared/install-$SHA.log"; tail -20 "$BASE/shared/install-$SHA.log"; exit 1; }
  corepack pnpm build > "$BASE/shared/build-$SHA.log" 2>&1 || { echo "build failed, live site untouched, see $BASE/shared/build-$SHA.log"; tail -30 "$BASE/shared/build-$SHA.log"; exit 1; }
fi
cd "$REL"
set -a; . "$ENVF"; set +a
# health check the new build on a spare port before switching
PORT=3001 nohup corepack pnpm start > "$BASE/shared/check-$SHA.log" 2>&1 &
CHK=$!
ok=0
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/ || true)
  [ "$code" = 200 ] && { ok=1; break; }
  sleep 2
done
kill "$CHK" 2>/dev/null || true; pkill -f "next start.*3001" 2>/dev/null || true; sleep 1
if [ "$ok" != 1 ]; then echo "health check failed (last code $code), live site untouched"; tail -30 "$BASE/shared/check-$SHA.log"; exit 1; fi
PREV=$(readlink "$BASE/current" 2>/dev/null || true)
ln -sfn "$REL" "$BASE/current"
if pm2 describe nexus >/dev/null 2>&1; then
  pm2 delete nexus >/dev/null
fi
cd "$BASE/current" && PORT=3000 pm2 start "corepack pnpm start" --name nexus --cwd "$BASE/current" --time >/dev/null
pm2 save >/dev/null
ok=0
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)
  [ "$code" = 200 ] && { ok=1; break; }
  sleep 2
done
if [ "$ok" != 1 ] && [ -n "$PREV" ]; then
  echo "new release unhealthy after switch, rolling back to $PREV"
  ln -sfn "$PREV" "$BASE/current"; pm2 delete nexus >/dev/null; PORT=3000 pm2 start "corepack pnpm start" --name nexus --cwd "$BASE/current" --time >/dev/null; pm2 save >/dev/null
  exit 1
fi
# keep the 3 newest releases
ls -1dt "$BASE"/releases/* | tail -n +4 | xargs -r rm -rf
echo "DEPLOYED $REF @ $SHA -> https://63-181-87-203.sslip.io"
REMOTE
