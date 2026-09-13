import type {
  DataSource,
  PilotListEntry,
  PilotProfileResponse,
  PilotsListResponse,
  SeasonStandingsResponse,
  SeriesPrestigeResponse,
  TrackProfileResponse,
  TracksListResponse,
} from '@drift-index/shared';
import { Router } from 'express';
import { computeP4P } from '../lib/p4p.js';
import { loadP4PInputs } from '../lib/p4pData.js';
import { toPilotCard } from '../lib/pilot.js';
import { computePilotStats, toStatsInput } from '../lib/pilotStats.js';
import { prisma } from '../lib/prisma.js';
import { computePrestigeRanking, persistPrestigeRanking } from '../lib/seriesOverlap.js';
import { computeStandings } from '../lib/standings.js';
import { toTrackSummary } from '../lib/trackDto.js';

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
    orderBy: { name: 'asc' },
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
      name: s.name,
      shortName: s.shortName,
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

publicRouter.get('/tracks', async (_req, res) => {
  const tracks = await prisma.track.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { events: true } },
      events: {
        orderBy: [{ startsAt: 'desc' }, { roundNumber: 'desc' }],
        include: { season: { include: { series: true } } },
      },
    },
  });

  const payload: TracksListResponse = {
    tracks: tracks.map((track) => {
      const seenSeries = new Set<string>();
      const series = [];
      for (const event of track.events) {
        if (seenSeries.has(event.season.series.slug)) continue;
        seenSeries.add(event.season.series.slug);
        series.push({
          slug: event.season.series.slug,
          name: event.season.series.name,
          shortName: event.season.series.shortName,
        });
      }

      const latestEvent = track.events[0];
      return {
        ...toTrackSummary(track)!,
        eventCount: track._count.events,
        series,
        latestEvent: latestEvent
          ? {
              seriesSlug: latestEvent.season.series.slug,
              seriesName: latestEvent.season.series.name,
              seasonYear: latestEvent.season.year,
              eventSlug: latestEvent.slug,
              eventName: latestEvent.name,
              startsAt: latestEvent.startsAt?.toISOString() ?? null,
            }
          : null,
      };
    }),
  };

  res.json(payload);
});

publicRouter.get('/tracks/:slug', async (req, res) => {
  const track = await prisma.track.findUnique({
    where: { slug: req.params.slug },
    include: {
      events: {
        orderBy: [{ startsAt: 'desc' }, { roundNumber: 'desc' }],
        include: { season: { include: { series: true } } },
      },
    },
  });

  if (!track) {
    res.status(404).json({ error: 'Track not found' });
    return;
  }

  const payload: TrackProfileResponse = {
    ...toTrackSummary(track)!,
    events: track.events.map((event) => ({
      seriesSlug: event.season.series.slug,
      seriesName: event.season.series.name,
      seriesShortName: event.season.series.shortName,
      seasonYear: event.season.year,
      eventSlug: event.slug,
      eventName: event.name,
      roundNumber: event.roundNumber,
      startsAt: event.startsAt?.toISOString() ?? null,
      status: event.status,
      standingsPath: `/series/${event.season.series.slug}/${event.season.year}`,
    })),
  };

  res.json(payload);
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
              track: true,
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
      name: series.name,
      shortName: series.shortName,
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
      name: event.name,
      track: toTrackSummary(event.track),
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
      name: row.bestSeriesName,
      shortName: row.bestSeriesShortName,
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
              track: true,
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
        seriesName: entry.series.name,
        seriesShortName: entry.series.shortName,
        photoUrl: entry.photoUrl!,
      })),
    stats,
    results: pilot.results.map((result) => ({
      seriesSlug: result.event.season.series.slug,
      seriesName: result.event.season.series.name,
      seriesShortName: result.event.season.series.shortName,
      seasonYear: result.event.season.year,
      eventSlug: result.event.slug,
      eventName: result.event.name,
      track: toTrackSummary(result.event.track),
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
