import 'dotenv/config';
import {
  applyMultiSeriesBonus,
  applyTrophyBonus,
  computeP4P,
  P4P_MULTI_SERIES_BONUS,
  p4pDisplayScore,
  qualScoreP4PAdjustment,
} from '../src/lib/p4p.js';
import { loadP4PInputs } from '../src/lib/p4pData.js';
import { prisma } from '../src/lib/prisma.js';
import { computeP4PTrophyBonusByPilotId } from '../src/lib/p4pTrophies.js';
import { computePrestigeRanking } from '../src/lib/seriesOverlap.js';

const year = Number.parseInt(process.argv[2] ?? String(new Date().getFullYear()), 10);

const prestige = await computePrestigeRanking(prisma, year);
const { inputs, pointsPlaceByEventId, seasonEvents } = await loadP4PInputs(
  prisma,
  year,
  prestige.hardnessBySlug,
);
const trophyBonusByPilotId = computeP4PTrophyBonusByPilotId(seasonEvents, pointsPlaceByEventId);
const top = computeP4P(inputs, 4, trophyBonusByPilotId);

const seriesCountByPilot = new Map<string, number>();
for (const series of inputs) {
  for (const row of series.standings) {
    if (row.avgPlace <= 0) continue;
    seriesCountByPilot.set(row.pilot.id, (seriesCountByPilot.get(row.pilot.id) ?? 0) + 1);
  }
}

console.log(`Drift Index breakdown · year ${year}\n`);

for (const row of top) {
  const nSeries = seriesCountByPilot.get(row.pilot.id) ?? 0;
  const cups = trophyBonusByPilotId.get(row.pilot.id) ?? 0;
  console.log(`#${row.rank} ${row.pilot.firstName} ${row.pilot.lastName} (${row.pilot.slug})`);
  console.log(`  d-index (display): ${row.score} = 100 − rawP4P`);

  const perSeries: Array<{
    slug: string;
    avgPlace: number;
    hardness: number;
    qual: number;
    qualAdj: number;
    adjusted: number;
  }> = [];

  for (const series of inputs) {
    const standing = series.standings.find((s) => s.pilot.id === row.pilot.id);
    if (!standing || standing.avgPlace <= 0) continue;
    const qualAdj = qualScoreP4PAdjustment(standing.avgQualScore);
    const adjusted = standing.avgPlace - series.seriesHardness - qualAdj;
    perSeries.push({
      slug: series.slug,
      avgPlace: standing.avgPlace,
      hardness: series.seriesHardness,
      qual: standing.avgQualScore,
      qualAdj,
      adjusted,
    });
  }

  perSeries.sort((a, b) => a.adjusted - b.adjusted);

  for (const s of perSeries) {
    const mark = s.slug === row.bestSeriesSlug ? ' ← best' : '';
    console.log(
      `  ${s.slug}: adjusted = ${s.avgPlace} − ${s.hardness.toFixed(2)} (H) − ${s.qualAdj.toFixed(3)} (qual ${s.qual}/100) = ${s.adjusted.toFixed(3)}${mark}`,
    );
  }

  const bestAdj = perSeries[0]?.adjusted ?? 0;
  const afterMulti = applyMultiSeriesBonus(bestAdj, nSeries);
  const rawP4P = applyTrophyBonus(afterMulti, cups);
  const bonus = P4P_MULTI_SERIES_BONUS * nSeries;

  console.log(
    `  rawP4P = min(adjusted) − ${P4P_MULTI_SERIES_BONUS}×${nSeries} − cups = ${bestAdj.toFixed(3)} − ${bonus.toFixed(1)} − ${cups.toFixed(2)} = ${rawP4P.toFixed(3)}`,
  );
  console.log(`  display = 100 − ${rawP4P.toFixed(3)} = ${p4pDisplayScore(rawP4P)}\n`);
}

await prisma.$disconnect();
