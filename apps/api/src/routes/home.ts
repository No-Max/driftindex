import type { HomeResponse } from '@drift-index/shared';
import { resolvePublicEventStatus } from '@drift-index/shared';
import { Router } from 'express';
import { computeP4P } from '../lib/p4p.js';
import { loadP4PInputs } from '../lib/p4pData.js';
import { buildP4PSeasonEvents } from '../lib/p4pSeasonEvents.js';
import { computeP4PTrophyBonusByPilotId } from '../lib/p4pTrophies.js';
import { toPilotCard } from '../lib/pilot.js';
import { seriesAliasMapForPilots } from '../lib/pilotNames.js';
import { resultDisplayNumber } from '../lib/resultNumber.js';
import { computePilotStats, toStatsInput } from '../lib/pilotStats.js';
import { loadSeriesLogoMap, seriesLogoFromMap } from '../lib/seriesLogos.js';
import { getOrSetCached } from '../lib/responseCache.js';
import { computePrestigeRanking } from '../lib/seriesOverlap.js';
import { computeStandings } from '../lib/standings.js';
import { prisma } from '../lib/prisma.js';
import { toTrackSummary } from '../lib/trackDto.js';

export const homeRouter = Router();

homeRouter.get('/home', async (req, res) => {
  const year = parseYear(req.query.year) ?? new Date().getFullYear();

  const payload = await getOrSetCached(`home:${year}`, () => buildHomePayload(year));
  res.json(payload);
});

async function buildHomePayload(year: number): Promise<HomeResponse> {
  const featuredSeries = await prisma.series.findMany({
    where: { featuredOrder: { not: null } },
    orderBy: { featuredOrder: 'asc' },
    include: {
      weights: { where: { year } },
      seasons: {
        where: { year },
        include: {
          events: {
            orderBy: { roundNumber: 'asc' },
            include: {
              track: true,
              results: { include: { pilot: true } },
            },
          },
        },
      },
    },
  });

  const prestige = await computePrestigeRanking(prisma, year);

  const seriesStartYears = await prisma.season.groupBy({
    by: ['seriesId'],
    _min: { year: true },
  });
  const startYearBySeriesId = new Map(
    seriesStartYears.map((row) => [row.seriesId, row._min.year ?? year]),
  );

  const championships = [];
  const qualWinners = [];

  for (const series of featuredSeries) {
    const season = series.seasons[0];
    if (!season) continue;

    const events = season.events;
    const standings = computeStandings(events);
    const leader = standings[0];
    const topThree = standings.slice(0, 3);

    const lastFinished = [...events].reverse().find((e) => e.status === 'FINISHED');
    const qualWinner = lastFinished
      ? lastFinished.results
          .filter((r) => r.qualPosition === 1)
          .sort((a, b) => (b.qualScore100 ?? 0) - (a.qualScore100 ?? 0))[0]
      : undefined;

    const featuredPilots = [
      ...(leader ? [leader.pilot] : []),
      ...topThree.map((row) => row.pilot),
      ...(qualWinner ? [qualWinner.pilot] : []),
    ];
    const featuredAliasMap = await seriesAliasMapForPilots(prisma, featuredPilots);
    const pilotCard = (
      pilot: (typeof featuredPilots)[number],
      number?: number | null,
    ) =>
      toPilotCard(pilot, number, undefined, {
        nameAlias: featuredAliasMap.get(pilot.id),
      });

    championships.push({
      series: {
        slug: series.slug,
        name: series.name,
        shortName: series.shortName,
        country: series.country,
        logoUrl: series.logoUrl,
      },
      seasonYear: season.year,
      seriesStartYear: startYearBySeriesId.get(series.id) ?? season.year,
      leader: leader ? pilotCard(leader.pilot, leader.number) : null,
      leaderPoints: leader?.totalPoints ?? null,
      topThree: topThree.map((row) => ({
        pilot: pilotCard(row.pilot, row.number),
        points: row.totalPoints,
      })),
      standingsPath: `/series/${series.slug}/${season.year}`,
    });

    if (lastFinished && qualWinner) {
        const runnerUp = lastFinished.results
          .filter((r) => r.qualPosition === 2)
          .sort((a, b) => (b.qualScore100 ?? 0) - (a.qualScore100 ?? 0))[0];

        qualWinners.push({
          pilot: pilotCard(qualWinner.pilot, resultDisplayNumber(qualWinner)),
          series: {
            slug: series.slug,
            name: series.name,
            shortName: series.shortName,
            country: series.country,
            logoUrl: series.logoUrl,
          },
          event: {
            slug: lastFinished.slug,
            roundNumber: lastFinished.roundNumber,
            name: lastFinished.name,
            track: toTrackSummary(lastFinished.track),
            startsAt: lastFinished.startsAt?.toISOString() ?? null,
          },
          qualScore: qualWinner.qualScore100,
          gapToSecond: runnerUp?.qualScore100 != null && qualWinner.qualScore100 != null
            ? Math.round((qualWinner.qualScore100 - runnerUp.qualScore100) * 10) / 10
            : null,
        });
    }
  }

  qualWinners.sort((a, b) => {
    const aTime = a.event.startsAt ? Date.parse(a.event.startsAt) : Number.POSITIVE_INFINITY;
    const bTime = b.event.startsAt ? Date.parse(b.event.startsAt) : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return a.series.slug.localeCompare(b.series.slug);
  });

  const calendarEvents = await prisma.event.findMany({
    where: {
      season: { year },
      startsAt: { not: null },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      track: true,
      season: { include: { series: true } },
    },
  });

  const { inputs: p4pInputs, pointsPlaceByEventId, seasonEvents } = await loadP4PInputs(
    prisma,
    year,
    prestige.hardnessBySlug,
  );
  const trophyBonusByPilotId = computeP4PTrophyBonusByPilotId(
    seasonEvents,
    pointsPlaceByEventId,
  );
  const p4pAllRows = computeP4P(p4pInputs, undefined, trophyBonusByPilotId);
  const p4pTopRows = p4pAllRows.slice(0, 10);
  const topPilotIds = new Set(p4pTopRows.map((row) => row.pilot.id));
  const p4pSeriesSlugs = new Set(p4pInputs.map((series) => series.slug));

  // Season points-leaders of featured (P4P) series.
  const ledSeriesByPilotId = new Map<
    string,
    Array<{ slug: string; name: string; shortName: string | null }>
  >();
  const seriesLeaderPilotIds = new Set<string>();
  for (const card of championships) {
    if (!p4pSeriesSlugs.has(card.series.slug) || !card.leader) continue;
    const leaderRow = p4pAllRows.find((row) => row.pilot.slug === card.leader!.slug);
    if (!leaderRow) continue;
    const led = ledSeriesByPilotId.get(leaderRow.pilot.id) ?? [];
    led.push({
      slug: card.series.slug,
      name: card.series.name,
      shortName: card.series.shortName,
    });
    ledSeriesByPilotId.set(leaderRow.pilot.id, led);
    if (!topPilotIds.has(leaderRow.pilot.id)) {
      seriesLeaderPilotIds.add(leaderRow.pilot.id);
    }
  }

  const p4pSeriesLeaderRows = p4pAllRows.filter((row) =>
    seriesLeaderPilotIds.has(row.pilot.id),
  );
  const p4pRows = [...p4pTopRows, ...p4pSeriesLeaderRows];
  const featuredSeriesSlugs = p4pSeriesSlugs;
  const p4pPilotIds = p4pRows.map((row) => row.pilot.id);
  const p4pPilotResults = await prisma.pilot.findMany({
    where: { id: { in: p4pPilotIds } },
    include: {
      results: {
        include: {
          event: {
            include: {
              season: { include: { series: true } },
            },
          },
        },
      },
    },
  });
  const statsByPilotId = new Map(
    p4pPilotResults.map((pilot) => [pilot.id, computePilotStats(toStatsInput(pilot.results))]),
  );
  const resultsByPilotId = new Map(p4pPilotResults.map((pilot) => [pilot.id, pilot.results]));

  const p4pAliasMap = await seriesAliasMapForPilots(
    prisma,
    p4pRows.map((row) => row.pilot),
  );
  const poundForPound = p4pRows.map((row) => ({
    rank: row.rank,
    score: row.score,
    section: (topPilotIds.has(row.pilot.id) ? 'top' : 'seriesLeader') as
      | 'top'
      | 'seriesLeader',
    ledSeries: ledSeriesByPilotId.get(row.pilot.id) ?? [],
    pilot: {
      ...toPilotCard(row.pilot, undefined, undefined, {
        nameAlias: p4pAliasMap.get(row.pilot.id),
      }),
      stats: statsByPilotId.get(row.pilot.id),
    },
    bestSeries: {
      slug: row.bestSeriesSlug,
      name: row.bestSeriesName,
      shortName: row.bestSeriesShortName,
      logoUrl: row.bestSeriesLogoUrl,
      weight: row.bestSeriesWeight,
      place: row.bestSeriesPlace,
      avgQualScore: row.bestSeriesAvgQual,
    },
    otherSeries: row.otherSeries,
    seasonEvents: buildP4PSeasonEvents(
      resultsByPilotId.get(row.pilot.id) ?? [],
      year,
      pointsPlaceByEventId,
      featuredSeriesSlugs,
    ),
  }));

  const logoBySlug = await loadSeriesLogoMap(prisma);

  const payload: HomeResponse = {
    year,
    seriesPrestige: {
      year,
      totalSeries: prestige.totalSeries,
      overlapGroups: prestige.overlapGroups,
      historyYears: prestige.historyYears,
      historyFromYear: prestige.historyFromYear,
      historyToYear: prestige.historyToYear,
      source: prestige.source,
      entries: prestige.entries.map((entry) => ({
        ...entry,
        logoUrl: seriesLogoFromMap(logoBySlug, entry.slug),
      })),
    },
    championships,
    qualWinners,
    calendar: calendarEvents.map((event) => ({
      seriesSlug: event.season.series.slug,
      seriesName: event.season.series.name,
      seriesShortName: event.season.series.shortName,
      logoUrl: event.season.series.logoUrl,
      seasonYear: event.season.year,
      eventSlug: event.slug,
      roundNumber: event.roundNumber,
      name: event.name,
      track: toTrackSummary(event.track),
      startsAt: event.startsAt!.toISOString(),
      status: resolvePublicEventStatus(event.status, event.startsAt),
      standingsPath: `/series/${event.season.series.slug}/${event.season.year}`,
    })),
    poundForPound,
    fanVotes: {
      bestPilot: { status: 'coming_soon' },
      bestCar: { status: 'coming_soon' },
    },
  };

  return payload;
}

function parseYear(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
}
