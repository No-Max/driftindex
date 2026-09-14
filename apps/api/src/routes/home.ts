import type { HomeResponse } from '@drift-index/shared';
import { Router } from 'express';
import { computeP4P } from '../lib/p4p.js';
import { loadP4PInputs } from '../lib/p4pData.js';
import { buildP4PBestSeriesEvents } from '../lib/p4pSeasonEvents.js';
import { toPilotCard } from '../lib/pilot.js';
import { computePilotStats, toStatsInput } from '../lib/pilotStats.js';
import { loadSeriesLogoMap, seriesLogoFromMap } from '../lib/seriesLogos.js';
import { computePrestigeRanking } from '../lib/seriesOverlap.js';
import { computeStandings } from '../lib/standings.js';
import { prisma } from '../lib/prisma.js';
import { toTrackSummary } from '../lib/trackDto.js';

export const homeRouter = Router();

homeRouter.get('/home', async (req, res) => {
  const year = parseYear(req.query.year) ?? new Date().getFullYear();

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
      leader: leader ? toPilotCard(leader.pilot) : null,
      leaderPoints: leader?.totalPoints ?? null,
      standingsPath: `/series/${series.slug}/${season.year}`,
    });

    const lastFinished = [...events].reverse().find((e) => e.status === 'FINISHED');
    if (lastFinished) {
      const qualWinner = lastFinished.results
        .filter((r) => r.qualPosition === 1)
        .sort((a, b) => (b.qualScore100 ?? 0) - (a.qualScore100 ?? 0))[0];

      if (qualWinner) {
        const runnerUp = lastFinished.results
          .filter((r) => r.qualPosition === 2)
          .sort((a, b) => (b.qualScore100 ?? 0) - (a.qualScore100 ?? 0))[0];

        qualWinners.push({
          pilot: toPilotCard(qualWinner.pilot),
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
          },
          qualScore: qualWinner.qualScore100,
          gapToSecond: runnerUp?.qualScore100 != null && qualWinner.qualScore100 != null
            ? Math.round((qualWinner.qualScore100 - runnerUp.qualScore100) * 10) / 10
            : null,
        });
      }
    }
  }

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

  const p4pInputs = await loadP4PInputs(prisma, year, prestige.hardnessBySlug);
  const p4pRows = computeP4P(p4pInputs, 10);
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

  const poundForPound = p4pRows.map((row) => ({
    rank: row.rank,
    score: row.score,
    pilot: {
      ...toPilotCard(row.pilot),
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
    bestSeriesEvents: buildP4PBestSeriesEvents(
      resultsByPilotId.get(row.pilot.id) ?? [],
      row.bestSeriesSlug,
      year,
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
      status: event.status,
      standingsPath: `/series/${event.season.series.slug}/${event.season.year}`,
    })),
    poundForPound,
    fanVotes: {
      bestPilot: { status: 'coming_soon' },
      bestCar: { status: 'coming_soon' },
    },
  };

  res.json(payload);
});

function parseYear(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
}
