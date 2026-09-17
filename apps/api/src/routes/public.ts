import {
  compareEventResultsChronologically,
  type DataSource,
  type PilotListEntry,
  type PilotProfileResponse,
  type PilotsListResponse,
  type SeasonEventResponse,
  type SeasonStandingsResponse,
  type SeriesPrestigeResponse,
  type SeriesProfileResponse,
  seriesEventPath,
  seriesStandingsPath,
  type TrackProfileResponse,
  type TracksListResponse,
} from '@drift-index/shared';
import { Router } from 'express';
import { computeP4P } from '../lib/p4p.js';
import { loadP4PInputs } from '../lib/p4pData.js';
import { preferredSeriesPhotoUrl, resolveSeriesPhotoUrl } from '../lib/media/pilotPhoto.js';
import { toPilotCard } from '../lib/pilot.js';
import { resultDisplayNumber } from '../lib/resultNumber.js';
import { resolvePilotDisplayNames } from '../lib/pilotNames.js';
import { computePilotStats, toStatsInput } from '../lib/pilotStats.js';
import { prisma } from '../lib/prisma.js';
import { loadSeriesLogoMap, seriesLogoFromMap } from '../lib/seriesLogos.js';
import { computePrestigeRanking, persistPrestigeRanking } from '../lib/seriesOverlap.js';
import { computeStandings } from '../lib/standings.js';
import { toTrackSummary } from '../lib/trackDto.js';

export const publicRouter = Router();

publicRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'drift-index-api' });
});

publicRouter.get('/series/prestige', async (req, res) => {
  const year = parseOptionalYear(req.query.year);
  const [prestige, logoBySlug] = await Promise.all([
    computePrestigeRanking(prisma, year ?? undefined),
    loadSeriesLogoMap(prisma),
  ]);

  const payload: SeriesPrestigeResponse = {
    year: year ?? null,
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
  };

  res.json(payload);
});

publicRouter.post('/series/prestige/recalculate', async (req, res) => {
  const year = parseOptionalYear(req.query.year) ?? new Date().getFullYear();
  const [prestige, logoBySlug] = await Promise.all([
    persistPrestigeRanking(prisma, year),
    loadSeriesLogoMap(prisma),
  ]);

  const payload: SeriesPrestigeResponse = {
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
      logoUrl: s.logoUrl,
      seasons: s.seasons.map((season) => ({
        year: season.year,
        nameEn: season.nameEn,
        nameRu: season.nameRu,
        eventCount: season._count.events,
      })),
    })),
  );
});

publicRouter.get('/series/:slug', async (req, res) => {
  const series = await prisma.series.findUnique({
    where: { slug: req.params.slug },
    include: {
      seasons: {
        orderBy: { year: 'desc' },
        include: {
          events: {
            orderBy: { roundNumber: 'asc' },
            include: { track: true },
          },
        },
      },
    },
  });

  if (!series) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  const payload: SeriesProfileResponse = {
    series: {
      slug: series.slug,
      name: series.name,
      shortName: series.shortName,
      country: series.country,
      logoUrl: series.logoUrl,
    },
    seasons: series.seasons.map((season) => {
      const events = season.events;
      const source: DataSource | null =
        season.sourceLabelEn || season.sourceLabelRu
          ? {
              labelEn: season.sourceLabelEn ?? season.sourceLabelRu ?? '',
              labelRu: season.sourceLabelRu ?? season.sourceLabelEn ?? '',
              url: season.sourceUrl,
            }
          : null;

      return {
        year: season.year,
        nameEn: season.nameEn,
        nameRu: season.nameRu,
        eventCount: events.length,
        finishedEventCount: events.filter((event) => event.status === 'FINISHED').length,
        source,
        standingsPath: seriesStandingsPath(series.slug, season.year),
        events: events.map((event) => ({
          slug: event.slug,
          roundNumber: event.roundNumber,
          name: event.name,
          track: toTrackSummary(event.track),
          status: event.status,
          startsAt: event.startsAt?.toISOString() ?? null,
          standingsPath: seriesStandingsPath(series.slug, season.year),
          eventPath: seriesEventPath(series.slug, season.year, event.slug),
        })),
      };
    }),
  };

  res.json(payload);
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
      standingsPath: seriesStandingsPath(event.season.series.slug, event.season.year),
      eventPath: seriesEventPath(
        event.season.series.slug,
        event.season.year,
        event.slug,
      ),
    })),
  };

  res.json(payload);
});

publicRouter.get('/series/:slug/seasons/:year/events/:eventSlug', async (req, res) => {
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
            where: { slug: req.params.eventSlug },
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
  const event = season?.events[0];
  if (!series || !season || !event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const results = [...event.results].sort((a, b) => {
    const aTandem = a.tandemPosition;
    const bTandem = b.tandemPosition;
    if (aTandem != null && bTandem != null) return aTandem - bTandem;
    if (aTandem != null) return -1;
    if (bTandem != null) return 1;

    const aQual = a.qualPosition;
    const bQual = b.qualPosition;
    if (aQual != null && bQual != null) return aQual - bQual;
    if (aQual != null) return -1;
    if (bQual != null) return 1;

    return b.points - a.points || a.pilot.lastName.localeCompare(b.pilot.lastName);
  });

  const payload: SeasonEventResponse = {
    series: {
      slug: series.slug,
      name: series.name,
      shortName: series.shortName,
      country: series.country,
      logoUrl: series.logoUrl,
    },
    season: {
      year: season.year,
      nameEn: season.nameEn,
      nameRu: season.nameRu,
      eventCount: 0,
      finishedEventCount: 0,
    },
    event: {
      slug: event.slug,
      roundNumber: event.roundNumber,
      name: event.name,
      track: toTrackSummary(event.track),
      status: event.status,
      startsAt: event.startsAt?.toISOString() ?? null,
      standingsPath: seriesStandingsPath(series.slug, season.year),
    },
    source: seasonSource(season),
    results: results.map((result) => {
      const { firstName, lastName } = resolvePilotDisplayNames(result.pilot);
      return {
        pilotSlug: result.pilot.slug,
        firstName,
        lastName,
        country: result.pilot.country,
        number: resultDisplayNumber(result),
        qualPosition: result.qualPosition,
        qualScore100: result.qualScore100,
        qualPoints: result.qualPoints,
        tandemPosition: result.tandemPosition,
        tandemBattles: result.tandemBattles,
        tandemWins: result.tandemWins,
        points: result.points,
      };
    }),
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
    number: row.number,
    totalPoints: row.totalPoints,
    eventPoints: row.eventPoints,
    eventQual: row.eventQual,
  }));

  const payload: SeasonStandingsResponse = {
    series: {
      slug: series.slug,
      name: series.name,
      shortName: series.shortName,
      country: series.country,
      logoUrl: series.logoUrl,
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
      eventPath: seriesEventPath(series.slug, season.year, event.slug),
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
      logoUrl: row.bestSeriesLogoUrl,
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
  const resultsByEventDate = [...pilot.results].sort((a, b) =>
    compareEventResultsChronologically(
      {
        startsAt: a.event.startsAt?.toISOString() ?? null,
        seasonYear: a.event.season.year,
        roundNumber: a.event.roundNumber,
        seriesSlug: a.event.season.series.slug,
        eventSlug: a.event.slug,
      },
      {
        startsAt: b.event.startsAt?.toISOString() ?? null,
        seasonYear: b.event.season.year,
        roundNumber: b.event.roundNumber,
        seriesSlug: b.event.season.series.slug,
        eventSlug: b.event.slug,
      },
    ),
  );

  const { firstName, lastName } = resolvePilotDisplayNames(pilot);
  const seriesPhotoRows = pilot.seriesPhotos
    .filter((entry) => entry.photoUrl)
    .map((entry) => ({
      seriesSlug: entry.series.slug,
      seriesName: entry.series.name,
      seriesShortName: entry.series.shortName,
      photoUrl: entry.photoUrl!,
    }));
  const preferUrl = preferredSeriesPhotoUrl(pilot.slug, seriesPhotoRows);

  const payload: PilotProfileResponse = {
    slug: pilot.slug,
    firstName,
    lastName,
    country: pilot.country,
    number: null,
    photoUrl: preferUrl ?? pilot.photoUrl,
    photos: seriesPhotoRows.map((entry) => ({
      ...entry,
      photoUrl: resolveSeriesPhotoUrl(pilot.slug, entry.seriesSlug, entry.photoUrl, preferUrl)!,
    })),
    stats,
    results: resultsByEventDate.map((result) => ({
      seriesSlug: result.event.season.series.slug,
      seriesName: result.event.season.series.name,
      seriesShortName: result.event.season.series.shortName,
      seasonYear: result.event.season.year,
      eventSlug: result.event.slug,
      eventName: result.event.name,
      track: toTrackSummary(result.event.track),
      startsAt: result.event.startsAt?.toISOString() ?? null,
      roundNumber: result.event.roundNumber,
      qualPosition: result.qualPosition,
      qualScore100: result.qualScore100,
      qualPoints: result.qualPoints,
      eventPlace: result.tandemPosition,
      number: resultDisplayNumber(result),
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

