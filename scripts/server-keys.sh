#!/usr/bin/env bash
# Run BY A HUMAN on the laptop that has .env. Puts the API keys on the demo server for live mode,
# with lower server-only spend caps and a password on every write request (new runs, answers, renders).
# Brand data connectors (RevenueCat, PostHog, Databricks, Stripe, Paddle, Meta) stay on the laptop.
# Usage: scripts/server-keys.sh
set -euo pipefail
HOST="${NEXUS_HOST:-ubuntu@63.181.87.203}"
DOMAIN="${NEXUS_DOMAIN:-63-181-87-203.sslip.io}"
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
[ -f .env ] || { echo "no .env here"; exit 1; }
umask 077
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
python3 - .env "$TMP" <<'PY'
import sys,re
src,dst=sys.argv[1],sys.argv[2]
caps={'BUDGET_USD_ANTHROPIC':'20','BUDGET_USD_OPENAI':'10','BUDGET_USD_FAL':'10','BUDGET_USD_ELEVENLABS':'10','BUDGET_USD_HIGGSFIELD':'5','BUDGET_USD_APIFY':'3','BUDGET_USD_FIRECRAWL':'2','BUDGET_USD_GEMINI':'3','BUDGET_MANUS_CREDITS':'200'}
drop=('NEXT_PUBLIC_DATA_MODE','DATABASE_URL','ASSETS_DIR','REVENUECAT','POSTHOG','DATABRICKS','STRIPE','PADDLE','META_','INSTAGRAM')
out=[]
for line in open(src).read().splitlines():
    m=re.match(r'^([A-Z0-9_]+)=(.*)$',line)
    if not m: continue
    k,v=m.groups()
    if k.startswith(drop): continue
    if k in caps: v=caps[k]
    if v: out.append(f'{k}={v}')
open(dst,'w').write('\n'.join(out)+'\n')
print(f'{len(out)} settings prepared (brand connectors kept on the laptop, caps lowered)')
PY
PW="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
scp -q "$TMP" "$HOST:/srv/nexus/shared/.env.secrets"
ssh "$HOST" "chmod 600 /srv/nexus/shared/.env.secrets && sed -i 's/^NEXT_PUBLIC_DATA_MODE=.*/NEXT_PUBLIC_DATA_MODE=live/' /srv/nexus/shared/.env.production"
H="$(ssh "$HOST" "caddy hash-password --plaintext '$PW'")"
ssh "$HOST" "sudo tee /etc/caddy/Caddyfile >/dev/null" <<CADDY
$DOMAIN {
	encode zstd gzip
	@writes method POST PUT PATCH DELETE
	basic_auth @writes {
		nexus $H
	}
	reverse_proxy 127.0.0.1:3000 {
		lb_try_duration 5s
	}
	handle_errors {
		root * /srv/nexus/placeholder
		rewrite * /index.html
		file_server
	}
}
CADDY
ssh "$HOST" "sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 && sudo systemctl reload caddy"
printf 'Nexus demo server https://%s\nuser: nexus\npassword: %s\n' "$DOMAIN" "$PW" > "$HOME/nexus-demo-password.txt"
echo "Keys placed. Write requests now need the password saved in ~/nexus-demo-password.txt."
echo "Now redeploy so the new build uses live mode: deploy/aws/deploy.sh main"
