#!/usr/bin/env bash
# Deploy the Ad Studio (the authenticated operator app with live keys) on the Lightsail box.
# Usage: deploy/studio/deploy.sh [git-ref=studio]
# Pulls, installs, builds next to the running app and restarts it only if the build passed.
# Running jobs are lost on restart (they are marked failed and can be started again).
set -euo pipefail
HOST="${STUDIO_HOST:-ubuntu@63.181.87.203}"
REF="${1:-studio}"
ssh -o BatchMode=yes "$HOST" bash -s -- "$REF" <<'REMOTE'
set -euo pipefail
REF="$1"
cd /srv/studio/app
git fetch -q origin
git checkout -q "$REF"
git reset -q --hard "origin/$REF"
ln -sf /srv/studio/shared/.env .env
corepack pnpm install --frozen-lockfile > /srv/studio/shared/install.log 2>&1 || { tail -20 /srv/studio/shared/install.log; exit 1; }
# build into a temp dir first so a failed build never takes the running app down
rm -rf .next-build && NEXT_PUBLIC_DATA_MODE=live NODE_ENV=production NEXT_DIST_DIR=.next-build nice -n 5 corepack pnpm build > /srv/studio/shared/build.log 2>&1 \
  || { echo "build failed, studio untouched"; tail -30 /srv/studio/shared/build.log; exit 1; }
rm -rf .next && mv .next-build .next
pm2 describe studio >/dev/null 2>&1 && pm2 restart studio --update-env >/dev/null || NODE_ENV=production pm2 start "corepack pnpm start -p 3100 -H 127.0.0.1" --name studio --cwd /srv/studio/app --time >/dev/null
pm2 save >/dev/null
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/studio || true)
  [ "$code" = 401 ] || [ "$code" = 200 ] && { echo "DEPLOYED $REF @ $(git rev-parse --short HEAD) -> https://studio.63-181-87-203.sslip.io"; exit 0; }
  sleep 2
done
echo "studio did not come back (last code $code)"; pm2 logs studio --lines 30 --nostream; exit 1
REMOTE
