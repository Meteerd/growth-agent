# Public showcase deploy (read-only, no keys)

The public site is the same Next.js app in production mode with one switch, `NEXT_PUBLIC_DATA_MODE=showcase`. The live server at https://63-181-87-203.sslip.io deploys with `deploy/aws/deploy.sh` (see `deploy/aws/README.md`); this file explains what the mode does and how to run it anywhere.

- It serves the four brands and their recorded live runs (research, reverse-engineered winners, consultation, direction, studio, packs) and the flagship videos. A fresh database seeds itself from `src/contracts/fixtures/live` and copies the flagship videos from `docs/renders` on the first request.
- Every mutating API call (`POST`, `PATCH`, `PUT`, `DELETE` under `/api`) is refused by `src/proxy.ts` with `403 {"error":{"code":"read_only",...}}` and a plain message in the UI ("This is the public showcase ... Live runs happen in the operator app."). Nobody can start a run, mark a post, add metrics or spend money from the public site.
- No API keys and no `.env` on the server. With `LIVE_PROVIDERS` empty, no provider is ever called live.
- The header says "Read-only showcase".

## Server
Ubuntu 22.04 or 24.04, x64, Node 22, about 2 GB RAM for `pnpm build` (add swap on a 1 GB box). Installing needs internet once: pnpm fetches the Linux builds of sharp, libsql and Next, and ffmpeg-static downloads its binary.

## Environment (build time and run time)
| Variable | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `showcase` | Read-only mode on the real API routes. It is baked into the build, so it must be set for `pnpm build` too. |
| `LIVE_PROVIDERS` | empty | No live provider calls, ever. |
| `DATABASE_URL` | `file:./data/showcase.db` | SQLite file; created and seeded on the first request. |
| `ASSETS_DIR` | `./data/assets` (default) | Rendered media and posters. |
| `PORT` | `3000` | `next start` listens here; Caddy proxies to it. |
| `NEXT_TELEMETRY_DISABLED` | `1` | Optional. |

Do not copy `.env` to the server.

## Build and start
```bash
git clone <repo-url> nexus && cd nexus && git checkout main
corepack enable
pnpm install --frozen-lockfile
export NEXT_PUBLIC_DATA_MODE=showcase LIVE_PROVIDERS= DATABASE_URL=file:./data/showcase.db PORT=3000 NEXT_TELEMETRY_DISABLED=1
pnpm build
pnpm start
```

## Check it
```bash
curl -s localhost:3000/api/health
curl -s localhost:3000/api/brands | head -c 300                       # four brands, each with heroVideo
curl -s -X POST localhost:3000/api/brands/hound/runs -w ' %{http_code}\n'  # 403 read_only
```
The full check is `e2e/showcase.spec.ts` (every screen of the four showcase runs with zero console errors, every change refused, spend unchanged):
```bash
E2E_DATA=live E2E_PORT=3000 E2E_READONLY=1 pnpm exec playwright test e2e/showcase.spec.ts
```

## Keep it running (systemd) and HTTPS (Caddy)
`/etc/systemd/system/nexus.service`:
```ini
[Unit]
Description=Nexus public showcase
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/nexus
Environment=NEXT_PUBLIC_DATA_MODE=showcase LIVE_PROVIDERS= DATABASE_URL=file:./data/showcase.db PORT=3000 NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
ExecStart=/usr/bin/env pnpm start
Restart=always
User=ubuntu

[Install]
WantedBy=multi-user.target
```
`/etc/caddy/Caddyfile`:
```
your.domain {
  encode zstd gzip
  reverse_proxy localhost:3000
}
```

## Update
```bash
git pull && pnpm install --frozen-lockfile && NEXT_PUBLIC_DATA_MODE=showcase pnpm build && sudo systemctl restart nexus
```

## What a fresh server does not have
- Frames of the third-party winning videos (they stay on the machine that analysed them). The reverse-engineer view shows each shot's description there instead.
- Cover images of researched posts: `/thumb` fetches each recorded cover once from its CDN and serves it from `data/thumbs` afterwards (only covers that are in the recorded data, so disk use stays bounded). The visitor's browser only talks to our server.
