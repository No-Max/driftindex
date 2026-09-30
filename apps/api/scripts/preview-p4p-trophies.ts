/**
 * Preview Drift Index top-10 with trophy bonuses (not applied to prod).
 *
 * Weights: gold 0.5 · silver 0.4 · bronze 0.3 · qual win 0.3
 * Modes:
 *   --best   cups only on best series (default previously)
 *   --all    cups summed across all featured series (default now)
 *
 * Usage: npx tsx scripts/preview-p4p-trophies.ts [year] [--all|--best]
 */
import 'dotenv/config';
import {
  applyMultiSeriesBonus,
  p4pDisplayScore,
  qualScoreP4PAdjustment,
} from '../src/lib/p4p.js';
import { loadP4PInputs } from '../src/lib/p4pData.js';
import { prisma } from '../src/lib/prisma.js';
import { computePrestigeRanking } from '../src/lib/seriesOverlap.js';
import { eventResultPlace } from '../src/lib/standings.js';

const GOLD = 0.3;
const SILVER = 0.2;
const BRONZE = 0.1;
const QUAL_WIN = 0.2;

const args = process.argv.slice(2);
const yearArg = args.find((a) => /^\d{4}$/.test(a));
const year = Number.parseInt(yearArg ?? String(new Date().getFullYear()), 10);
const trophyScope: 'all' | 'best' = args.includes('--best') ? 'best' : 'all';

const prestige = await computePrestigeRanking(prisma, year);
const { inputs, pointsPlaceByEventId, seasonEvents } = await loadP4PInputs(
  prisma,
  year,
  prestige.hardnessBySlug,
);

type TrophyCounts = { gold: number; silver: number; bronze: number; qual: number };

function emptyTrophies(): TrophyCounts {
  return { gold: 0, silver: 0, bronze: 0, qual: 0 };
}

function addTrophies(a: TrophyCounts, b: TrophyCounts): TrophyCounts {
  return {
    gold: a.gold + b.gold,
    silver: a.silver + b.silver,
    bronze: a.bronze + b.bronze,
    qual: a.qual + b.qual,
  };
}

function trophyBonus(t: TrophyCounts): number {
  return t.gold * GOLD + t.silver * SILVER + t.bronze * BRONZE + t.qual * QUAL_WIN;
}

function formatTrophies(t: TrophyCounts): string {
  const parts: string[] = [];
  if (t.gold) parts.push(`${t.gold}🥇`);
  if (t.silver) parts.push(`${t.silver}🥈`);
  if (t.bronze) parts.push(`${t.bronze}🥉`);
  if (t.qual) parts.push(`${t.qual}Q`);
  return parts.length > 0 ? parts.join(' ') : '—';
}

/** pilotId → seriesSlug → trophies */
const trophiesByPilotSeries = new Map<string, Map<string, TrophyCounts>>();

for (const event of seasonEvents) {
  if (event.status !== 'FINISHED') continue;
  const places = pointsPlaceByEventId.get(event.id);
  for (const result of event.results) {
    const place = eventResultPlace({
      pointsPlace: places?.get(result.pilotId) ?? null,
      tandemPosition: result.tandemPosition,
      qualPosition: result.qualPosition,
    });
    let bySeries = trophiesByPilotSeries.get(result.pilotId);
    if (!bySeries) {
      bySeries = new Map();
      trophiesByPilotSeries.set(result.pilotId, bySeries);
    }
    let counts = bySeries.get(event.series.slug);
    if (!counts) {
      counts = emptyTrophies();
      bySeries.set(event.series.slug, counts);
    }
    if (place === 1) counts.gold += 1;
    else if (place === 2) counts.silver += 1;
    else if (place === 3) counts.bronze += 1;
    if (result.qualPosition === 1) counts.qual += 1;
  }
}

function allSeriesTrophies(pilotId: string): TrophyCounts {
  let total = emptyTrophies();
  const bySeries = trophiesByPilotSeries.get(pilotId);
  if (!bySeries) return total;
  for (const counts of bySeries.values()) {
    total = addTrophies(total, counts);
  }
  return total;
}

type RankRow = {
  pilotId: string;
  firstName: string;
  lastName: string;
  slug: string;
  bestSeriesSlug: string;
  bestAdjusted: number;
  trophies: TrophyCounts;
  trophyBonus: number;
  nSeries: number;
  raw: number;
  score: number;
};

type TrophyMode = 'none' | 'best' | 'all';

function rank(mode: TrophyMode): RankRow[] {
  const seriesCountByPilot = new Map<string, number>();
  for (const series of inputs) {
    for (const row of series.standings) {
      if (row.avgPlace <= 0) continue;
      seriesCountByPilot.set(row.pilot.id, (seriesCountByPilot.get(row.pilot.id) ?? 0) + 1);
    }
  }

  const bestByPilot = new Map<string, RankRow>();

  for (const series of inputs) {
    for (const row of series.standings) {
      if (row.avgPlace <= 0) continue;

      // Best series is always chosen without cups when mode=all (cups are global).
      // For mode=best, cups of that series enter adjusted before picking.
      const seriesTrophies =
        trophiesByPilotSeries.get(row.pilot.id)?.get(series.slug) ?? emptyTrophies();
      const perSeriesBonus = mode === 'best' ? trophyBonus(seriesTrophies) : 0;
      const adjusted =
        row.avgPlace -
        series.seriesHardness -
        qualScoreP4PAdjustment(row.avgQualScore) -
        perSeriesBonus;

      const nSeries = seriesCountByPilot.get(row.pilot.id) ?? 0;
      const candidate: RankRow = {
        pilotId: row.pilot.id,
        firstName: row.pilot.firstName,
        lastName: row.pilot.lastName,
        slug: row.pilot.slug,
        bestSeriesSlug: series.slug,
        bestAdjusted: adjusted,
        trophies: seriesTrophies,
        trophyBonus: perSeriesBonus,
        nSeries,
        raw: 0,
        score: 0,
      };
      const existing = bestByPilot.get(row.pilot.id);
      if (!existing || adjusted < existing.bestAdjusted) {
        bestByPilot.set(row.pilot.id, candidate);
      }
    }
  }

  for (const row of bestByPilot.values()) {
    if (mode === 'all') {
      row.trophies = allSeriesTrophies(row.pilotId);
      row.trophyBonus = trophyBonus(row.trophies);
    } else if (mode === 'none') {
      row.trophies = emptyTrophies();
      row.trophyBonus = 0;
    }
    // mode=best: trophies/bonus already set from winning series

    row.raw = applyMultiSeriesBonus(row.bestAdjusted, row.nSeries) - row.trophyBonus;
    // For mode=best, bonus was already inside bestAdjusted — don't subtract again
    if (mode === 'best') {
      row.raw = applyMultiSeriesBonus(row.bestAdjusted, row.nSeries);
    }
    row.score = p4pDisplayScore(row.raw);
  }

  return [...bestByPilot.values()].sort(
    (a, b) => a.raw - b.raw || a.lastName.localeCompare(b.lastName),
  );
}

const baselineAll = rank('none');
const withCupsAll = rank(trophyScope);
const baseline = baselineAll.slice(0, 10);
const withCupsTop = withCupsAll.slice(0, 10);
const baselineRankBySlug = new Map(baselineAll.map((r, i) => [r.slug, i + 1]));

console.log(`Drift Index trophy preview · ${year}`);
console.log(`Weights: gold=${GOLD}  silver=${SILVER}  bronze=${BRONZE}  qual=${QUAL_WIN}`);
console.log(
  trophyScope === 'all'
    ? '(cups = sum across ALL featured series; best series chosen without cups; then −cups −0.1×N)\n'
    : '(cups only on best series; then −0.1×N)\n',
);

console.log('── Current top 10 (no trophies) ──');
for (let i = 0; i < baseline.length; i++) {
  const r = baseline[i]!;
  console.log(
    `${String(i + 1).padStart(2)}. ${r.score.toFixed(2).padStart(6)}  ${r.firstName} ${r.lastName}  [${r.bestSeriesSlug}]`,
  );
}

console.log(
  `\n── Preview top 10 (trophies: ${trophyScope === 'all' ? 'all series' : 'best series only'}) ──`,
);
console.log(
  `${'#'.padStart(2)}  ${'score'.padStart(6)}  Δrk  name                          series           cups              bonus`,
);
for (let i = 0; i < withCupsTop.length; i++) {
  const r = withCupsTop[i]!;
  const oldRank = baselineRankBySlug.get(r.slug) ?? null;
  const delta =
    oldRank == null
      ? 'new'
      : oldRank === i + 1
        ? '='
        : oldRank > i + 1
          ? `↑${oldRank - (i + 1)}`
          : `↓${i + 1 - oldRank}`;
  const name = `${r.firstName} ${r.lastName}`.padEnd(28).slice(0, 28);
  console.log(
    `${String(i + 1).padStart(2)}. ${r.score.toFixed(2).padStart(6)}  ${delta.padStart(3)}  ${name}  ${r.bestSeriesSlug.padEnd(15)}  ${formatTrophies(r.trophies).padEnd(16)}  −${r.trophyBonus.toFixed(2)}`,
  );
}

const oldSlugs = new Set(baseline.map((r) => r.slug));
const newSlugs = new Set(withCupsTop.map((r) => r.slug));
const entered = withCupsTop.filter((r) => !oldSlugs.has(r.slug));
const exited = baseline.filter((r) => !newSlugs.has(r.slug));
if (entered.length || exited.length) {
  console.log('\n── Top-10 churn ──');
  for (const r of entered) {
    console.log(`  + ${r.firstName} ${r.lastName} (was #${baselineRankBySlug.get(r.slug)})`);
  }
  for (const r of exited) {
    const newRank = withCupsAll.findIndex((x) => x.slug === r.slug) + 1;
    console.log(`  − ${r.firstName} ${r.lastName} (now #${newRank || '?'})`);
  }
}

await prisma.$disconnect();
