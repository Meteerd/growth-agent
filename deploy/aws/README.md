# AWS deploy (read-only showcase)

- Server: AWS Lightsail `nexus-demo`, eu-central-1 (Frankfurt), Ubuntu 24.04, 4 GB, static IP 63.181.87.203.
- URL: https://63-181-87-203.sslip.io (Caddy, automatic HTTPS).
- Access: SSH as `ubuntu` with Mete's key or Emir's GitHub keys. The server pulls the repo with a read-only deploy key.
- No provider API keys live on the server. `deploy.sh` refuses to deploy if any are present. The site runs in `NEXT_PUBLIC_DATA_MODE=showcase` (read-only, recorded data + flagship videos).

## Deploy
```bash
deploy/aws/deploy.sh          # deploys main
deploy/aws/deploy.sh lane-b   # or another branch
```
It builds a new release beside the running one, health-checks it on port 3001, switches traffic only if healthy, and rolls back if the switched release fails. A failed build never touches the live site.

## Logs
`ssh ubuntu@63.181.87.203 'pm2 logs nexus --lines 50'`; build logs in `/srv/nexus/shared/`.
