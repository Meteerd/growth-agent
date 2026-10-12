#!/usr/bin/env bash
# Validate API keys in .env against free endpoints. Prints provider, presence and HTTP status only. Never prints keys.
# Usage: scripts/check-keys.sh
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT"
[ -f .env ] || { echo "no .env (run: cp .env.example .env, then paste keys)"; exit 1; }
set -a; # shellcheck disable=SC1091
. ./.env; set +a

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@"; }
row() { printf '%-12s %-8s %s\n' "$1" "$2" "$3"; }
verdict() { case "$1" in 200|201) echo "OK";; 401|403) echo "INVALID ($1)";; 000) echo "NO RESPONSE";; *) echo "HTTP $1 (check)";; esac; }

printf '%-12s %-8s %s\n' PROVIDER KEY RESULT
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then row anthropic set "$(verdict "$(code https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY" -H 'anthropic-version: 2023-06-01')")"; else row anthropic MISSING "engine cannot run live"; fi
if [ -n "${OPENAI_API_KEY:-}" ]; then row openai set "$(verdict "$(code https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY")")"; else row openai MISSING demo; fi
if [ -n "${APIFY_TOKEN:-}" ]; then row apify set "$(verdict "$(code https://api.apify.com/v2/users/me -H "Authorization: Bearer $APIFY_TOKEN")")"; else row apify MISSING demo; fi
if [ -n "${MANUS_API_KEY:-}" ]; then row manus set "$(verdict "$(code https://api.manus.ai/v2/user.me -H "x-manus-api-key: $MANUS_API_KEY")")"; else row manus MISSING demo; fi
if [ -n "${FIRECRAWL_API_KEY:-}" ]; then row firecrawl set "$(verdict "$(code https://api.firecrawl.dev/v1/team/credit-usage -H "Authorization: Bearer $FIRECRAWL_API_KEY")")"; else row firecrawl MISSING "fetch fallback"; fi
if [ -n "${FAL_KEY:-}" ]; then row fal set "$(verdict "$(code 'https://api.fal.ai/v1/models?limit=1' -H "Authorization: Key $FAL_KEY")")"; else row fal MISSING demo; fi
if [ -n "${YOUTUBE_API_KEY:-}" ]; then row youtube set "$(verdict "$(code "https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=US&key=$YOUTUBE_API_KEY")")"; else row youtube MISSING demo; fi
if [ -n "${SPIRAL_API_KEY:-}" ]; then row spiral set "$(verdict "$(code https://public-api.spiral.ad/v1/usage -H "Authorization: Bearer $SPIRAL_API_KEY")")"; else row spiral MISSING "apify fallback"; fi
if [ -n "${ELEVENLABS_API_KEY:-}" ]; then row elevenlabs set "$(verdict "$(code https://api.elevenlabs.io/v1/user -H "xi-api-key: $ELEVENLABS_API_KEY")")"; else row elevenlabs MISSING "openai tts fallback"; fi
if [ -n "${GEMINI_API_KEY:-}" ]; then row gemini set "$(verdict "$(code https://generativelanguage.googleapis.com/v1beta/models -H "x-goog-api-key: $GEMINI_API_KEY")")"; else row gemini MISSING "frame checks only"; fi
for v in HIGGSFIELD_API_KEY REVENUECAT_API_KEY POSTHOG_API_KEY STRIPE_SECRET_KEY PADDLE_API_KEY META_ACCESS_TOKEN; do
  if [ -n "${!v:-}" ]; then row "${v%%_*}" set "present (validated by the app's smoke test)"; else row "${v%%_*}" MISSING demo; fi
done
echo "LIVE_PROVIDERS=${LIVE_PROVIDERS:-}"
