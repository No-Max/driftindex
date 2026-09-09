# Drift Index — project context

> Living doc for humans and AI agents. Update when product decisions or architecture change.

**Repo:** https://github.com/No-Max/driftindex  
**Domain (planned):** driftindex.pro  
**Local folder:** `drift-pound` (rename optional)

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

**Ports:** API `3221`, Web `3220` (Vite proxies `/api` → API)

### Dev commands

```bash
npm install
cp .env.example apps/api/.env   # DATABASE_URL → localhost:5433
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev:api    # terminal 1
npm run dev:web    # terminal 2
```

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
P4P = max(S / P)   across all series the pilot participates in
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
| Avg qual | Mean of `qualPoints` where present |

Shown on pilot profile + P4P #1 card (+ compact on P4P #2–#3).

---

## Database highlights

Key models: `Series`, `Season`, `Event`, `Pilot`, `EventResult`, `SeriesWeight`

Notable fields:

- `Series.featuredOrder`, `Series.defaultWeight` (legacy, P4P uses overlap/manual rank)
- `SeriesWeight.prestigeRank`, `SeriesWeight.weight` (= S coefficient when persisted)
- `Pilot.photoUrl`, `EventResult.qualPoints`

Seed: 6 featured series, 2026 seasons, 12 pilots, cross-series overlap (Deane/Conor/Jack in FD+DM+RDS, etc.)

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

## Seed overlap notes (2026)

Multi-series pilots (for overlap testing):

- **James Deane, Conor Shanahan** — FD + DM + RDS
- **Jack Shanahan** — FD + DM + Drift Kings
- **Fredric Aasbo** — FD + D1
- **Aurimas Bakchis** — FD + Drift Kings
- Single-series: Yokoi, Saito (D1), Ilyuk (RDS), Papadakis (Royal DS)

Example overlap result: FD hardness ≈ 18 (7 samples) — most cross-series comparisons.

---

## Open / next tasks

- [ ] Admin panel for manual data entry
- [ ] Pilot photos (`photoUrl`), series logos
- [ ] UI block for series prestige / overlap debug on homepage
- [ ] More historical seed data for stronger overlap
- [ ] Deploy to driftindex.pro
- [ ] Phase 2: auth + fan voting
- [ ] Rename local folder `drift-pound` → `drift-index` (optional)

---

## Changelog (agent notes)

| Date | Change |
|------|--------|
| 2026-09-09 | Initial monorepo, homepage, P4P max(S/P), overlap prestige, pilot stats, pushed to GitHub |
