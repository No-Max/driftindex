import type { HomeResponse } from '@drift-index/shared';
import { Router } from 'express';
import { computeP4P } from '../lib/p4p.js';
import { toPilotCard } from '../lib/pilot.js';
import { computePilotStats, toStatsInput } from '../lib/pilotStats.js';
import { computePrestigeRanking } from '../lib/seriesOverlap.js';
import { computeStandings } from '../lib/standings.js';
import { prisma } from '../lib/prisma.js';

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
              results: { include: { pilot: true } },
            },
          },
        },
      },
    },
  });

  const prestige = await computePrestigeRanking(prisma, year);

  const championships = [];
  const superPodium = [];
  const qualWinners = [];
  const p4pInputs = [];

  for (const series of featuredSeries) {
    const season = series.seasons[0];
    if (!season) continue;

    const events = season.events;
    const standings = computeStandings(events);
    const leader = standings[0];

    p4pInputs.push({
      slug: series.slug,
      nameEn: series.nameEn,
      nameRu: series.nameRu,
      seriesOrder: prestige.orderBySlug.get(series.slug) ?? series.featuredOrder!,
      standings: standings.map((row) => ({ rank: row.rank, pilot: row.pilot })),
    });

    championships.push({
      series: {
        slug: series.slug,
        nameEn: series.nameEn,
        nameRu: series.nameRu,
        country: series.country,
        logoUrl: series.logoUrl,
      },
      seasonYear: season.year,
      leader: leader ? toPilotCard(leader.pilot) : null,
      leaderPoints: leader?.totalPoints ?? null,
      standingsPath: `/series/${series.slug}/${season.year}`,
    });

    if (leader) {
      superPodium.push({
        pilot: toPilotCard(leader.pilot),
        series: {
          slug: series.slug,
          nameEn: series.nameEn,
          nameRu: series.nameRu,
          country: series.country,
          logoUrl: series.logoUrl,
        },
        seasonYear: season.year,
        totalPoints: leader.totalPoints,
        standingsPath: `/series/${series.slug}/${season.year}`,
      });
    }

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
            nameEn: series.nameEn,
            nameRu: series.nameRu,
            country: series.country,
            logoUrl: series.logoUrl,
          },
          event: {
            slug: lastFinished.slug,
            roundNumber: lastFinished.roundNumber,
            nameEn: lastFinished.nameEn,
            nameRu: lastFinished.nameRu,
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
      season: { include: { series: true } },
    },
  });

  const p4pRows = computeP4P(p4pInputs, 10, prestige.totalSeries);
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

  const poundForPound = p4pRows.map((row) => ({
    rank: row.rank,
    score: row.score,
    pilot: {
      ...toPilotCard(row.pilot),
      stats: statsByPilotId.get(row.pilot.id),
    },
    bestSeries: {
      slug: row.bestSeriesSlug,
      nameEn: row.bestSeriesNameEn,
      nameRu: row.bestSeriesNameRu,
      weight: row.bestSeriesWeight,
      place: row.bestSeriesPlace,
    },
  }));

  const payload: HomeResponse = {
    year,
    seriesPrestige: {
      year,
      totalSeries: prestige.totalSeries,
      overlapGroups: prestige.overlapGroups,
      source: prestige.source,
      entries: prestige.entries,
    },
    championships,
    superPodium,
    qualWinners,
    calendar: calendarEvents.map((event) => ({
      seriesSlug: event.season.series.slug,
      seriesNameEn: event.season.series.nameEn,
      seriesNameRu: event.season.series.nameRu,
      logoUrl: event.season.series.logoUrl,
      seasonYear: event.season.year,
      eventSlug: event.slug,
      roundNumber: event.roundNumber,
      nameEn: event.nameEn,
      nameRu: event.nameRu,
      trackEn: event.trackEn,
      trackRu: event.trackRu,
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
