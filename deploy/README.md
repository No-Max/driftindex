# Production deploy (VPS)

App path: `/opt/driftindex`

## First-time setup

```bash
cd /opt/driftindex
npm install
cp apps/api/.env.production.example apps/api/.env
mkdir -p storage/media

npm run db:up
npm run db:setup:prod
npm run build

sudo cp deploy/nginx-driftindex.conf /etc/nginx/sites-available/driftindex
sudo ln -sf /etc/nginx/sites-available/driftindex /etc/nginx/sites-enabled/driftindex
sudo rm -f /etc/nginx/sites-enabled/default

sudo cp deploy/driftindex-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now driftindex-api
sudo nginx -t && sudo systemctl reload nginx
```

## Umami analytics (self-hosted)

- **Tracker** (public): `https://driftindex.pro/stats/stats.js` → posts to `/stats/api/send`
- **Dashboard**: `https://analytics.driftindex.pro` (after DNS) or SSH tunnel (below)

Umami 3.x does not reliably support a path prefix for the UI, so the dashboard is on a subdomain (or localhost via tunnel). The tracker stays same-origin on the main site.

### 1. Start containers on VPS

```bash
cd /opt/driftindex/deploy/umami
cp .env.example .env
# set UMAMI_DB_PASSWORD and UMAMI_APP_SECRET (openssl rand -hex 32)
docker compose up -d
docker compose ps
```

### 2. Nginx — tracker on main site

If the live HTTPS config was managed by certbot, **include the tracker locations in the 443 server block** (before `location /`):

```bash
# snippet is in the repo:
#   deploy/nginx-umami-tracker.conf
sudo sed -n '1,99p' /opt/driftindex/deploy/nginx-umami-tracker.conf
# paste into /etc/nginx/sites-available/driftindex HTTPS server, then:
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Dashboard access

**Option A — SSH tunnel (works immediately):**

```bash
ssh -L 3000:127.0.0.1:3000 driftindex
# open http://localhost:3000
```

Default login: `admin` / `umami` — **change password immediately.**

**Option B — subdomain (recommended):**

1. DNS A record: `analytics.driftindex.pro` → VPS IP  
2. On VPS:

```bash
sudo cp /opt/driftindex/deploy/nginx-analytics.driftindex.pro.conf \
  /etc/nginx/sites-available/analytics.driftindex.pro
sudo ln -sf /etc/nginx/sites-available/analytics.driftindex.pro \
  /etc/nginx/sites-enabled/analytics.driftindex.pro
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d analytics.driftindex.pro
```

### 4. Enable the tracker on the site

In Umami: Settings → Add website → domain `driftindex.pro` → copy Website ID.

On VPS:

```bash
cp /opt/driftindex/apps/web/.env.production.example /opt/driftindex/apps/web/.env.production
# set:
#   VITE_UMAMI_WEBSITE_ID=<uuid>
#   VITE_UMAMI_SCRIPT_URL=/stats/stats.js
cd /opt/driftindex && npm run build --workspace=apps/web
```

Tracking stays off until `VITE_UMAMI_WEBSITE_ID` is set (baked in at build time).

## Update after git pull

```bash
cd /opt/driftindex
npm install
npm run db:setup:prod   # migrate + seed + Royal DS import
npm run build
sudo systemctl restart driftindex-api
```

## Sync media to VPS (from dev machine)

After imports mirror new portraits into `storage/media/` locally, upload to the server:

```bash
rsync -avz storage/media/ driftindex:/opt/driftindex/storage/media/
```

SSH host `driftindex` → `178.172.236.133` (see `~/.ssh/config`).

## Deploy code (no git on VPS)

```bash
rsync -avz \
  --exclude node_modules --exclude .git --exclude storage/media \
  --exclude apps/api/.env --exclude apps/web/.env.development \
  --exclude apps/web/.env.production --exclude deploy/umami/.env \
  ./ driftindex:/opt/driftindex/

ssh driftindex 'cd /opt/driftindex && npm install && npm run db:generate --workspace=apps/api && npm run build && systemctl restart driftindex-api'
```

Never rsync `apps/api/.env`, `apps/web/.env.production`, or `deploy/umami/.env`.

## HTTPS (after DNS works)

```bash
sudo certbot --nginx -d driftindex.pro -d www.driftindex.pro --redirect
```

Then ensure `CORS_ORIGIN` in `apps/api/.env` includes `https://` URLs.
