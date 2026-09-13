import type {
  DataSource,
  PilotListEntry,
  PilotProfileResponse,
  PilotsListResponse,
  SeasonStandingsResponse,
  SeriesPrestigeResponse,
} from '@drift-index/shared';
import { Router } from 'express';
import { computeP4P } from '../lib/p4p.js';
import { loadP4PInputs } from '../lib/p4pData.js';
import { toPilotCard } from '../lib/pilot.js';
import { computePilotStats, toStatsInput } from '../lib/pilotStats.js';
import { prisma } from '../lib/prisma.js';
import { computePrestigeRanking, persistPrestigeRanking } from '../lib/seriesOverlap.js';
import { computeStandings } from '../lib/standings.js';

export const publicRouter = Router();

publicRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'drift-index-api' });
});

publicRouter.get('/series/prestige', async (req, res) => {
  const year = parseOptionalYear(req.query.year);
  const prestige = await computePrestigeRanking(prisma, year ?? undefined);

  const payload: SeriesPrestigeResponse = {
    year: year ?? null,
    totalSeries: prestige.totalSeries,
    overlapGroups: prestige.overlapGroups,
    historyYears: prestige.historyYears,
    historyFromYear: prestige.historyFromYear,
    historyToYear: prestige.historyToYear,
    source: prestige.source,
    entries: prestige.entries,
  };

  res.json(payload);
});

publicRouter.post('/series/prestige/recalculate', async (req, res) => {
  const year = parseOptionalYear(req.query.year) ?? new Date().getFullYear();
  const prestige = await persistPrestigeRanking(prisma, year);

  const payload: SeriesPrestigeResponse = {
    year,
    totalSeries: prestige.totalSeries,
    overlapGroups: prestige.overlapGroups,
    historyYears: prestige.historyYears,
    historyFromYear: prestige.historyFromYear,
    historyToYear: prestige.historyToYear,
    source: prestige.source,
    entries: prestige.entries,
  };

  res.json(payload);
});

publicRouter.get('/series', async (_req, res) => {
  const series = await prisma.series.findMany({
    orderBy: { nameEn: 'asc' },
    include: {
      seasons: {
        orderBy: { year: 'desc' },
        include: { _count: { select: { events: true } } },
      },
    },
  });

  res.json(
    series.map((s) => ({
      slug: s.slug,
      nameEn: s.nameEn,
      nameRu: s.nameRu,
      country: s.country,
      seasons: s.seasons.map((season) => ({
        year: season.year,
        nameEn: season.nameEn,
        nameRu: season.nameRu,
        eventCount: season._count.events,
      })),
    })),
  );
});

publicRouter.get('/series/:slug/seasons/:year/standings', async (req, res) => {
  const year = Number(req.params.year);
  if (!Number.isFinite(year)) {
    res.status(400).json({ error: 'Invalid year' });
    return;
  }

  const series = await prisma.series.findUnique({
    where: { slug: req.params.slug },
    include: {
      seasons: {
        where: { year },
        include: {
          events: {
            orderBy: { roundNumber: 'asc' },
            include: {
              results: {
                include: { pilot: true },
              },
            },
          },
        },
      },
    },
  });

  const season = series?.seasons[0];
  if (!series || !season) {
    res.status(404).json({ error: 'Season not found' });
    return;
  }

  const events = season.events;
  const computed = computeStandings(events);
  const standings = computed.map((row) => ({
    rank: row.rank,
    pilotSlug: row.pilot.slug,
    firstName: row.pilot.firstName,
    lastName: row.pilot.lastName,
    country: row.pilot.country,
    number: row.pilot.number,
    totalPoints: row.totalPoints,
    eventPoints: row.eventPoints,
  }));

  const payload: SeasonStandingsResponse = {
    series: {
      slug: series.slug,
      nameEn: series.nameEn,
      nameRu: series.nameRu,
      country: series.country,
    },
    season: {
      year: season.year,
      nameEn: season.nameEn,
      nameRu: season.nameRu,
      eventCount: events.length,
      finishedEventCount: events.filter((e) => e.status === 'FINISHED').length,
    },
    events: events.map((event) => ({
      slug: event.slug,
      roundNumber: event.roundNumber,
      nameEn: event.nameEn,
      nameRu: event.nameRu,
      status: event.status,
    })),
    standings,
    source: seasonSource(season),
  };

  res.json(payload);
});

function seasonSource(season: {
  sourceLabelEn: string | null;
  sourceLabelRu: string | null;
  sourceUrl: string | null;
}): DataSource | null {
  if (!season.sourceLabelEn && !season.sourceLabelRu) return null;
  return {
    labelEn: season.sourceLabelEn ?? season.sourceLabelRu ?? 'Unknown source',
    labelRu: season.sourceLabelRu ?? season.sourceLabelEn ?? 'Неизвестный источник',
    url: season.sourceUrl,
  };
}

publicRouter.get('/pilots', async (req, res) => {
  const year = parseOptionalYear(req.query.year) ?? new Date().getFullYear();
  const prestige = await computePrestigeRanking(prisma, year);
  const p4pInputs = await loadP4PInputs(prisma, year, prestige.hardnessBySlug);
  const p4pRows = computeP4P(p4pInputs);

  const rankedPilotIds = p4pRows.map((row) => row.pilot.id);
  const rankedPilotResults = await prisma.pilot.findMany({
    where: { id: { in: rankedPilotIds } },
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
    rankedPilotResults.map((pilot) => [pilot.id, computePilotStats(toStatsInput(pilot.results))]),
  );

  const rankedSlugs = new Set(p4pRows.map((row) => row.pilot.slug));
  const unrankedPilots = await prisma.pilot.findMany({
    where: { slug: { notIn: [...rankedSlugs] } },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const ranked: PilotListEntry[] = p4pRows.map((row) => ({
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
      avgQualScore: row.bestSeriesAvgQual,
    },
  }));

  const unranked: PilotListEntry[] = unrankedPilots.map((pilot) => ({
    rank: null,
    score: null,
    pilot: toPilotCard(pilot),
    bestSeries: null,
  }));

  const payload: PilotsListResponse = {
    year,
    pilots: [...ranked, ...unranked],
  };

  res.json(payload);
});

publicRouter.get('/pilots/:slug', async (req, res) => {
  const pilot = await prisma.pilot.findUnique({
    where: { slug: req.params.slug },
    include: {
      seriesPhotos: {
        where: { photoUrl: { not: null } },
        include: { series: true },
        orderBy: { series: { featuredOrder: 'asc' } },
      },
      results: {
        include: {
          event: {
            include: {
              season: {
                include: { series: true },
              },
            },
          },
        },
        orderBy: [{ event: { startsAt: 'desc' } }, { event: { roundNumber: 'desc' } }],
      },
    },
  });

  if (!pilot) {
    res.status(404).json({ error: 'Pilot not found' });
    return;
  }

  const stats = computePilotStats(toStatsInput(pilot.results));

  const payload: PilotProfileResponse = {
    slug: pilot.slug,
    firstName: pilot.firstName,
    lastName: pilot.lastName,
    country: pilot.country,
    number: pilot.number,
    photoUrl: pilot.photoUrl,
    photos: pilot.seriesPhotos
      .filter((entry) => entry.photoUrl)
      .map((entry) => ({
        seriesSlug: entry.series.slug,
        seriesNameEn: entry.series.nameEn,
        seriesNameRu: entry.series.nameRu,
        photoUrl: entry.photoUrl!,
      })),
    stats,
    results: pilot.results.map((result) => ({
      seriesSlug: result.event.season.series.slug,
      seriesNameEn: result.event.season.series.nameEn,
      seriesNameRu: result.event.season.series.nameRu,
      seasonYear: result.event.season.year,
      eventSlug: result.event.slug,
      eventNameEn: result.event.nameEn,
      eventNameRu: result.event.nameRu,
      roundNumber: result.event.roundNumber,
      qualPosition: result.qualPosition,
      qualScore100: result.qualScore100,
      qualPoints: result.qualPoints,
      eventPlace: result.tandemPosition,
      tandemBattles: result.tandemBattles,
      tandemWins: result.tandemWins,
      points: result.points,
      source: seasonSource(result.event.season),
    })),
  };

  res.json(payload);
});

function parseOptionalYear(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
}
