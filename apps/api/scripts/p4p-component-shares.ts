/**
 * Show how each Drift Index formula term contributes (with trophy weights).
 * Usage: npx tsx scripts/p4p-component-shares.ts [year]
 */
import 'dotenv/config';
import {
  applyMultiSeriesBonus,
  P4P_MULTI_SERIES_BONUS,
  p4pDisplayScore,
  qualScoreP4PAdjustment,
} from '../src/lib/p4p.js';
import { loadP4PInputs } from '../src/lib/p4pData.js';
import { prisma } from '../src/lib/prisma.js';
import { computePrestigeRanking } from '../src/lib/seriesOverlap.js';
import { eventResultPlace } from '../src/lib/standings.js';

const GOLD = 0.5;
const SILVER = 0.4;
const BRONZE = 0.3;
const QUAL_WIN = 0.3;

const year = Number.parseInt(process.argv[2] ?? String(new Date().getFullYear()), 10);

const prestige = await computePrestigeRanking(prisma, year);
const { inputs, pointsPlaceByEventId, seasonEvents } = await loadP4PInputs(
  prisma,
  year,
  prestige.hardnessBySlug,
);

type T = { gold: number; silver: number; bronze: number; qual: number };
const trophiesByPilotSeries = new Map<string, Map<string, T>>();

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
    let c = bySeries.get(event.series.slug);
    if (!c) {
      c = { gold: 0, silver: 0, bronze: 0, qual: 0 };
      bySeries.set(event.series.slug, c);
    }
    if (place === 1) c.gold += 1;
    else if (place === 2) c.silver += 1;
    else if (place === 3) c.bronze += 1;
    if (result.qualPosition === 1) c.qual += 1;
  }
}

function trophyBonus(t: T): number {
  return t.gold * GOLD + t.silver * SILVER + t.bronze * BRONZE + t.qual * QUAL_WIN;
}

const seriesCountByPilot = new Map<string, number>();
for (const series of inputs) {
  for (const row of series.standings) {
    if (row.avgPlace <= 0) continue;
    seriesCountByPilot.set(row.pilot.id, (seriesCountByPilot.get(row.pilot.id) ?? 0) + 1);
  }
}

type Row = {
  name: string;
  series: string;
  place: number;
  hardness: number;
  qualAdj: number;
  cups: number;
  multi: number;
  raw: number;
  score: number;
  adjusted: number;
};

const bestByPilot = new Map<string, Row>();

for (const series of inputs) {
  for (const row of series.standings) {
    if (row.avgPlace <= 0) continue;
    const t =
      trophiesByPilotSeries.get(row.pilot.id)?.get(series.slug) ?? {
        gold: 0,
        silver: 0,
        bronze: 0,
        qual: 0,
      };
    const cups = trophyBonus(t);
    const qualAdj = qualScoreP4PAdjustment(row.avgQualScore);
    const hardness = series.seriesHardness;
    const place = row.avgPlace;
    const adjusted = place - hardness - qualAdj - cups;
    const existing = bestByPilot.get(row.pilot.id);
    if (!existing || adjusted < existing.adjusted) {
      const n = seriesCountByPilot.get(row.pilot.id) ?? 0;
      const multi = P4P_MULTI_SERIES_BONUS * n;
      const raw = applyMultiSeriesBonus(adjusted, n);
      bestByPilot.set(row.pilot.id, {
        name: `${row.pilot.firstName} ${row.pilot.lastName}`,
        series: series.slug,
        place,
        hardness,
        qualAdj,
        cups,
        multi,
        adjusted,
        raw,
        score: p4pDisplayScore(raw),
      });
    }
  }
}

const all = [...bestByPilot.values()].sort((a, b) => a.raw - b.raw);
const top = all.slice(0, 10);

function avg(list: Row[], fn: (r: Row) => number): number {
  return list.reduce((s, r) => s + fn(r), 0) / list.length;
}

function boostShares(list: Row[]) {
  const h = list.reduce((s, r) => s + r.hardness, 0);
  const q = list.reduce((s, r) => s + r.qualAdj, 0);
  const c = list.reduce((s, r) => s + r.cups, 0);
  const m = list.reduce((s, r) => s + r.multi, 0);
  const tot = h + q + c + m || 1;
  return {
    hardness: (h / tot) * 100,
    qual: (q / tot) * 100,
    cups: (c / tot) * 100,
    multi: (m / tot) * 100,
    avgBoost: (h + q + c + m) / list.length,
    avgPlace: avg(list, (r) => r.place),
    avgScore: avg(list, (r) => r.score),
    avgH: h / list.length,
    avgQ: q / list.length,
    avgC: c / list.length,
    avgM: m / list.length,
  };
}

console.log(`Drift Index component weights · ${year}`);
console.log('score = 100 − avgPlace + Hardness + qual/100 + cups + 0.1×N');
console.log(`cups = ${GOLD}·🥇 + ${SILVER}·🥈 + ${BRONZE}·🥉 + ${QUAL_WIN}·Q\n`);

console.log('── 1) Marginal weight (relative to +1 place = 100%) ──');
console.log('  avgPlace +1         −1.00   100%');
console.log('  Hardness +1         +1.00   100%');
console.log(`  gold                +${GOLD.toFixed(2)}    ${(GOLD * 100).toFixed(0)}%`);
console.log(`  silver              +${SILVER.toFixed(2)}    ${(SILVER * 100).toFixed(0)}%`);
console.log(`  bronze              +${BRONZE.toFixed(2)}    ${(BRONZE * 100).toFixed(0)}%`);
console.log(`  qual win            +${QUAL_WIN.toFixed(2)}    ${(QUAL_WIN * 100).toFixed(0)}%`);
console.log('  qual score +10      +0.10    10%');
console.log('  +1 series           +0.10    10%');

for (const [label, list] of [
  ['Top 10', top],
  ['All ranked', all],
] as const) {
  const s = boostShares(list);
  console.log(`\n── 2) ${label}: share of POSITIVE boosts (H + qual + cups + multi) ──`);
  console.log(`  Hardness      ${s.hardness.toFixed(1).padStart(5)}%   (avg ${s.avgH.toFixed(2)})`);
  console.log(`  Cups          ${s.cups.toFixed(1).padStart(5)}%   (avg ${s.avgC.toFixed(2)})`);
  console.log(`  Qual/100      ${s.qual.toFixed(1).padStart(5)}%   (avg ${s.avgQ.toFixed(2)})`);
  console.log(`  Multi-series  ${s.multi.toFixed(1).padStart(5)}%   (avg ${s.avgM.toFixed(2)})`);
  console.log(
    `  avgPlace ${s.avgPlace.toFixed(2)} · avgBoost +${s.avgBoost.toFixed(2)} · avgScore ${s.avgScore.toFixed(2)}`,
  );
}

console.log('\n── 3) Mean |term| across all ranked, as % of total magnitude ──');
const means = {
  avgPlace: avg(all, (r) => r.place),
  Hardness: avg(all, (r) => r.hardness),
  Cups: avg(all, (r) => r.cups),
  'Qual/100': avg(all, (r) => r.qualAdj),
  Multi: avg(all, (r) => r.multi),
};
const mag = Object.values(means).reduce((a, b) => a + b, 0);
for (const [k, v] of Object.entries(means)) {
  console.log(`  ${k.padEnd(10)}  mean ${v.toFixed(3).padStart(6)}   ${((v / mag) * 100).toFixed(1).padStart(5)}%`);
}

console.log('\n── 4) Top 10: boost mix per pilot ──');
console.log(
  'name                         place     H   qual  cups multi |  %H %cups %qual %multi  score',
);
for (const r of top) {
  const boost = r.hardness + r.qualAdj + r.cups + r.multi;
  const pct = (x: number) => (boost > 0 ? Math.round((x / boost) * 100) : 0);
  console.log(
    `${r.name.padEnd(28).slice(0, 28)}  ${r.place.toFixed(1).padStart(5)}  ${r.hardness.toFixed(2).padStart(5)}  ${r.qualAdj.toFixed(2).padStart(5)}  ${r.cups.toFixed(2).padStart(5)}  ${r.multi.toFixed(1).padStart(4)} | ${String(pct(r.hardness)).padStart(3)}%  ${String(pct(r.cups)).padStart(3)}%   ${String(pct(r.qualAdj)).padStart(3)}%   ${String(pct(r.multi)).padStart(3)}%  ${r.score.toFixed(2)}`,
  );
}

await prisma.$disconnect();
