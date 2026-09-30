import type { PrismaClient } from '@prisma/client';
import { computeP4P } from './p4p.js';
import { loadP4PInputs } from './p4pData.js';
import type { SeasonEventWithSeries } from './p4pSeasonEvents.js';
import {
  computeP4PTrophyBonusByPilotId,
  computeP4PTrophyCountsByPilotId,
  emptyP4PTrophyCounts,
  type P4PTrophyCounts,
} from './p4pTrophies.js';
import { toPilotCard } from './pilot.js';
import { seriesAliasMapForPilots } from './pilotNames.js';
import { averageQualScore100 } from './qualScore.js';
import { loadSeriesLogoMap, seriesLogoFromMap } from './seriesLogos.js';
import { computePrestigeRanking } from './seriesOverlap.js';
import { computeStandings } from './standings.js';

/** How many Drift Index places to pair into duels (must be even). */
const DUEL_POOL_SIZE = 2;

export type DuelSnapshotSeries = {
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
};

export type DuelSnapshotStats = {
  eventsCount: number;
  avgQualScore: number | null;
  tandemBattles: number;
  tandemWins: number;
  tandemWinPct: number | null;
};

export type DuelSnapshotCandidate = {
  pilot: ReturnType<typeof toPilotCard>;
  rank: number;
  points: number;
  series?: DuelSnapshotSeries;
  trophies?: P4PTrophyCounts;
  stats?: DuelSnapshotStats;
};

export type DuelSnapshotPair = {
  pairId: string;
  rankA: number;
  rankB: number;
  /** Present for series-leader duels. */
  seriesA?: DuelSnapshotSeries;
  seriesB?: DuelSnapshotSeries;
  candidates: DuelSnapshotCandidate[];
};

export function duelPairId(rankA: number, rankB: number): string {
  return `${rankA}-${rankB}`;
}

function seasonStatsForPilot(
  events: readonly SeasonEventWithSeries[],
  pilotId: string,
): DuelSnapshotStats {
  let eventsCount = 0;
  const qualScores: Array<number | null> = [];
  let tandemBattles = 0;
  let tandemWins = 0;

  for (const event of events) {
    if (event.status !== 'FINISHED') continue;
    const result = event.results.find((row) => row.pilotId === pilotId) as
      | (typeof event.results)[number] & {
          tandemBattles?: number | null;
          tandemWins?: number | null;
        }
      | undefined;
    if (!result) continue;
    eventsCount += 1;
    qualScores.push(result.qualScore100);
    if (result.tandemBattles != null && result.tandemBattles > 0) {
      tandemBattles += result.tandemBattles;
      tandemWins += result.tandemWins ?? 0;
    }
  }

  return {
    eventsCount,
    avgQualScore: averageQualScore100(qualScores),
    tandemBattles,
    tandemWins,
    tandemWinPct:
      tandemBattles > 0 ? Math.round((tandemWins / tandemBattles) * 1000) / 10 : null,
  };
}

/**
 * Drift Index #1 vs #2 duel snapshot for seeding Poll options (not live).
 */
export async function listDriftIndexDuelSnapshot(
  prisma: PrismaClient,
  year: number,
): Promise<DuelSnapshotPair | null> {
  const prestige = await computePrestigeRanking(prisma, year);
  const { inputs, pointsPlaceByEventId, seasonEvents } = await loadP4PInputs(
    prisma,
    year,
    prestige.hardnessBySlug,
  );
  const trophyBonusByPilotId = computeP4PTrophyBonusByPilotId(
    seasonEvents,
    pointsPlaceByEventId,
  );
  const trophyCountsByPilotId = computeP4PTrophyCountsByPilotId(
    seasonEvents,
    pointsPlaceByEventId,
  );
  const ranking = computeP4P(inputs, undefined, trophyBonusByPilotId).slice(
    0,
    DUEL_POOL_SIZE,
  );

  if (ranking.length < 2) return null;

  const a = ranking[0]!;
  const b = ranking[1]!;
  const rows = [
    { pilot: a.pilot, rank: a.rank, score: a.score },
    { pilot: b.pilot, rank: b.rank, score: b.score },
  ];

  const aliasMap = await seriesAliasMapForPilots(
    prisma,
    rows.map((row) => row.pilot),
  );

  const pilotIds = rows.map((row) => row.pilot.id);
  const seriesPhotoRows = await prisma.pilotSeriesPhoto.findMany({
    where: { pilotId: { in: pilotIds } },
    include: { series: { select: { slug: true } } },
  });
  const photosByPilotId = new Map<
    string,
    Array<{ seriesSlug: string; photoUrl: string | null }>
  >();
  for (const row of seriesPhotoRows) {
    const list = photosByPilotId.get(row.pilotId) ?? [];
    list.push({ seriesSlug: row.series.slug, photoUrl: row.photoUrl });
    photosByPilotId.set(row.pilotId, list);
  }

  return {
    pairId: duelPairId(a.rank, b.rank),
    rankA: a.rank,
    rankB: b.rank,
    candidates: rows.map((row) => ({
      pilot: toPilotCard(row.pilot, undefined, photosByPilotId.get(row.pilot.id), {
        nameAlias: aliasMap.get(row.pilot.id),
      }),
      rank: row.rank,
      points: row.score,
      trophies: trophyCountsByPilotId.get(row.pilot.id) ?? emptyP4PTrophyCounts(),
      stats: seasonStatsForPilot(seasonEvents, row.pilot.id),
    })),
  };
}

/**
 * Consecutive featured-series leaders paired into duels (#1 vs #1).
 * With 5 featured series → 4 pairs: 1v2, 2v3, 3v4, 4v5.
 */
export async function listSeriesLeaderDuelSnapshots(
  prisma: PrismaClient,
  year: number,
): Promise<DuelSnapshotPair[]> {
  const logoBySlug = await loadSeriesLogoMap(prisma);
  const featuredSeries = await prisma.series.findMany({
    where: { featuredOrder: { not: null } },
    orderBy: { featuredOrder: 'asc' },
    include: {
      seasons: {
        where: { year },
        include: {
          events: {
            orderBy: { roundNumber: 'asc' },
            include: {
              results: { include: { pilot: true } },
            },
          },
        },
      },
    },
  });

  type Leader = {
    series: DuelSnapshotSeries;
    pilot: (typeof featuredSeries)[number]['seasons'][number]['events'][number]['results'][number]['pilot'];
    number: number | null;
    points: number;
  };

  const leaders: Leader[] = [];
  for (const series of featuredSeries) {
    const season = series.seasons[0];
    if (!season) continue;
    const top = computeStandings(season.events)[0];
    if (!top) continue;
    leaders.push({
      series: {
        slug: series.slug,
        name: series.name,
        shortName: series.shortName,
        logoUrl: seriesLogoFromMap(logoBySlug, series.slug),
      },
      pilot: top.pilot,
      number: top.number,
      points: top.totalPoints,
    });
  }

  const pairs: Array<{ a: Leader; b: Leader; pairId: string }> = [];
  for (let i = 0; i + 1 < leaders.length; i += 1) {
    const a = leaders[i]!;
    const b = leaders[i + 1]!;
    pairs.push({
      a,
      b,
      pairId: `${a.series.slug}-vs-${b.series.slug}`,
    });
  }

  const allPilots = pairs.flatMap((pair) => [pair.a.pilot, pair.b.pilot]);
  const aliasMap = await seriesAliasMapForPilots(prisma, allPilots);
  const pilotIds = [...new Set(allPilots.map((pilot) => pilot.id))];
  const seriesPhotoRows =
    pilotIds.length > 0
      ? await prisma.pilotSeriesPhoto.findMany({
          where: { pilotId: { in: pilotIds } },
          include: { series: { select: { slug: true } } },
        })
      : [];
  const photosByPilotId = new Map<
    string,
    Array<{ seriesSlug: string; photoUrl: string | null }>
  >();
  for (const row of seriesPhotoRows) {
    const list = photosByPilotId.get(row.pilotId) ?? [];
    list.push({ seriesSlug: row.series.slug, photoUrl: row.photoUrl });
    photosByPilotId.set(row.pilotId, list);
  }

  return pairs.map((pair) => ({
    pairId: pair.pairId,
    rankA: 1,
    rankB: 1,
    seriesA: pair.a.series,
    seriesB: pair.b.series,
    candidates: [
      {
        pilot: toPilotCard(
          pair.a.pilot,
          pair.a.number,
          photosByPilotId.get(pair.a.pilot.id),
          { nameAlias: aliasMap.get(pair.a.pilot.id) },
        ),
        rank: 1,
        points: pair.a.points,
        series: pair.a.series,
      },
      {
        pilot: toPilotCard(
          pair.b.pilot,
          pair.b.number,
          photosByPilotId.get(pair.b.pilot.id),
          { nameAlias: aliasMap.get(pair.b.pilot.id) },
        ),
        rank: 1,
        points: pair.b.points,
        series: pair.b.series,
      },
    ],
  }));
}
