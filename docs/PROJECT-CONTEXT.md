# Drift Index — project context

> Living doc for humans and AI agents. Update when product decisions or architecture change.

**Repo:** https://github.com/No-Max/driftindex  
**Domain (planned):** driftindex.pro  
**Local folder:** `driftindex`

---

## Product vision

Global drift ranking portal — **statistics first**, fan voting later.

Differentiation vs driftalmanac.ru: global EN/RU portal, fan voting (pilot/car, not series), verified pilot profiles, pound-for-pound rating.

### Phased roadmap

| Phase | Scope |
|-------|--------|
| **1 (now)** | Per-series standings, pilot profiles, manual data (admin TBD), EN+RU i18n |
| **2** | User registration, fan voting at season end |
| **3** | Org data upload, pilot verification, series reach rating, full P4P |

### Homepage blocks (priority order)

1. Championships slider (top-6, 3 visible)
2. Super podium — current season leaders per featured series
3. Qualifying winners — pole (qual #1) at **latest finished round** per series
4. Year calendar — all events across series
5. P4P top-10 — #1 hero card left, #2–10 list right (#2–#3 larger)
6. Fan vote stubs (pilot, car)

Minimal hero: logo + tagline only.

---

## Tech stack

Monorepo (npm workspaces):

```
apps/api/          Node + Express + Prisma + PostgreSQL
apps/web/          Vue 3 + Vite + vue-router + vue-i18n
packages/shared/   Shared TypeScript types
docker-compose.yml PostgreSQL :5433
```

**Ports:** API `5021`, Web `5020` (Vite proxies `/api` → API)

### Environment files

| File | Use |
|------|-----|
| `apps/api/.env.example` | Local dev (default: **prod DB** on VPS) |
| `apps/api/.env.local.example` | Offline dev (local docker postgres) |
| `apps/api/.env.production.example` | VPS app server |
| `apps/web/.env.development` | Dev media proxy → `https://driftindex.pro/media` |
| `apps/api/.env` | Active config (gitignored) |

**Default local dev** uses shared production DB and production pilot photos. App static assets (JS/CSS) are still served by Vite locally.

### Dev commands

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev:api           # terminal 1
npm run dev:web           # terminal 2
```

### Offline local DB + media (optional)

```bash
cp apps/api/.env.local.example apps/api/.env
npm run db:setup:local    # docker + migrate + seed + Royal DS import
# In apps/web/.env.development set VITE_MEDIA_ORIGIN=http://localhost:5021
```

### VPS server bootstrap

```bash
cp apps/api/.env.production.example apps/api/.env
npm run db:up
npm run db:setup:prod     # migrate deploy + seed + Royal DS import
```

Deploy details: `deploy/README.md`

### Git remote (No-Max personal)

SSH alias required in `~/.ssh/config`:

```
Host github.com-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github_personal
  IdentitiesOnly yes
```

Remote URL: `git@github.com-personal:No-Max/driftindex.git`

---

## Featured series (manual `featuredOrder`)

| Order | Slug | Name |
|-------|------|------|
| 1 | formula-drift-pro | Formula Drift PRO |
| 2 | drift-masters | Drift Masters |
| 3 | d1gp | D1 Grand Prix |
| 4 | rds-gp | RDS GP |
| 5 | royal-ds | Royal Drift Series |
| 6 | drift-kings | Drift Kings |

Show **data source** per season (`sourceLabelEn/Ru`, `sourceUrl`) — not verified/unverified badges.

---

## P4P formula (confirmed)

### Series coefficient S

```
S = (N − seriesRank + 1) / N
```

- `N` = count of featured series (6)
- `seriesRank` = position in prestige list (1 = top → S = 1, last → S = 1/N)
- **Not** the old `100/place × manual weight` formula

### Pilot P4P score

```
P4P = max(S / P) × 1000   across all series the pilot participates in
```

- `P` = current standing place in season (1 = leader)
- **Best result only** — not average across series
- Recalculate after **each finished round**

### Series prestige order (overlap)

**When:** end of season (persist); live preview during season.

**Logic:** for pilots in 2+ series (same season year), compare standing places pairwise:

- If `place_B > place_A` → pilot did worse in B → **B is harder** → B gets `+(place_B − place_A)` hardness
- All overlap pilots and all pairs within a group count (not just one pilot)
- Sort series by total hardness ↓ (tie-break: manual `featuredOrder`)

**Priority for effective rank:**

1. `SeriesWeight.prestigeRank` (stored, end-of-season)
2. Live overlap calculation
3. Manual `featuredOrder` fallback

**API:**

- `GET /api/series/prestige` — ranking + per-series `contributions[]` (pilot breakdown)
- `POST /api/series/prestige/recalculate?year=YYYY` — persist to `SeriesWeight`

---

## Pilot statistics

Computed from **finished events only**:

| Stat | Logic |
|------|--------|
| Win rate | `tandemPosition === 1` / events count |
| Events | Finished events with a result |
| Seasons | Unique (series + year) pairs |
| Avg qual (/100) | Mean of `qualScore100` on finished events |

Shown on pilot profile + P4P #1 card (+ compact on P4P #2–#3).

---

## Database highlights

Key models: `Series`, `Season`, `Event`, `Pilot`, `EventResult`, `SeriesWeight`

Notable fields:

- `Series.featuredOrder`, `Series.defaultWeight` (legacy, P4P uses overlap/manual rank)
- `SeriesWeight.prestigeRank`, `SeriesWeight.weight` (= S coefficient when persisted)
- `Pilot.photoUrl` (local `/media/...`), `Pilot.photoSourceUrl`, `EventResult.qualPoints`

Seed: 6 featured series (catalog only, no mock results). Real data via importers (`db:import:royal-ds`).

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/home?year=` | Homepage payload (all blocks + `seriesPrestige`) |
| GET | `/api/series` | Series list |
| GET | `/api/series/prestige?year=` | Overlap prestige + contributions |
| POST | `/api/series/prestige/recalculate?year=` | Persist prestige for year |
| GET | `/api/series/:slug/seasons/:year/standings` | Season standings + source |
| GET | `/api/pilots/:slug` | Pilot profile + stats + results |

---

---

## Data import

Full database bootstrap (local or prod):

```bash
npm run db:setup        # local: includes docker up
npm run db:setup:prod   # prod: assumes postgres already running
```

### Royal Drift Series (`royalds.cn`)

```bash
npm run db:import:royal-ds   # also runs as part of db:setup
```

Source: SvelteKit `__data.json` from `https://royalds.cn/en/results`.

**Import rules:**

- Pilots with **0 season points** are skipped
- Per-event results with **0 points** are skipped
- Only `official` scored stages are imported

Importer: `apps/api/src/importers/royal-ds.ts` · script: `apps/api/scripts/import-royal-ds.ts`

### RDS GP (`rdsgp.com`)

```bash
npm run db:import:rds-gp
```

Source: HTML results pages from `https://rdsgp.com/results/rdsgp2026/`.

**Import rules:**

- Per-event results parsed from official stage tables
- `qualScore100` = best qualifying run (0–100 scale, comma decimals)
- Pilots keyed as `rds-{pilotId}` from `/pilots/{id}/` links

Importer: `apps/api/src/importers/rds-gp.ts` · script: `apps/api/scripts/import-rds-gp.ts`

---

## Media storage

Local filesystem at `storage/media/` (gitignored). Same layout on VPS: `/opt/driftindex/storage/media/`.

| Env | Default |
|-----|---------|
| `MEDIA_ROOT` | `storage/media` (auto from repo root) |
| `MEDIA_PUBLIC_BASE` | `/media` |

Import mirrors portraits → `storage/media/pilots/{slug}.webp`, DB stores `/media/pilots/{slug}.webp`.

**Serving:** nginx `/media/` on prod; API static + Vite proxy in dev.

User/pilot uploads (phase 2) will write to the same storage tree.

---

## Open / next tasks

- [ ] Admin panel for manual data entry
- [x] Pilot photos mirrored locally (`/media/pilots/`)
- [ ] Series logos
- [ ] User/pilot upload API (verified accounts)
- [ ] Import remaining series (FD, DM, D1, RDS, Drift Kings)
- [ ] UI block for series prestige / overlap debug on homepage
- [ ] More importers for overlap / P4P testing across series
- [x] Deploy to driftindex.pro (VPS 178.172.236.133)
- [x] Standardized env + db:setup workflow (local = prod)
- [ ] Phase 2: auth + fan voting
- [x] Rename local folder → `driftindex`

---

## Changelog (agent notes)

| Date | Change |
|------|--------|
| 2026-09-09 | Initial monorepo, homepage, P4P max(S/P), overlap prestige, pilot stats, pushed to GitHub |
