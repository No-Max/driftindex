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

## HTTPS (after DNS works)

```bash
sudo certbot --nginx -d driftindex.pro -d www.driftindex.pro --redirect
```

Then ensure `CORS_ORIGIN` in `apps/api/.env` includes `https://` URLs.
