import {
  compareEventResultsChronologically,
  type DataSource,
  type PilotListEntry,
  type PilotsListSeriesFilter,
  type PilotListSeriesParticipation,
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
import { computeP4P, pilotSeriesParticipations, type P4PSeriesParticipation } from '../lib/p4p.js';
import { loadP4PInputs } from '../lib/p4pData.js';
import { preferredSeriesPhotoUrl, resolveSeriesPhotoUrl } from '../lib/media/pilotPhoto.js';
import { toPilotCard } from '../lib/pilot.js';
import { resultDisplayNumber } from '../lib/resultNumber.js';
import { resolvePilotDisplayNames } from '../lib/pilotNames.js';
import { computePilotStats, toStatsInput } from '../lib/pilotStats.js';
import { pilotSlugLookupCandidates, stripSeriesPilotSlugPrefix } from '../lib/pilotSlug.js';
import { prisma } from '../lib/prisma.js';
import { loadSeriesLogoMap, seriesLogoFromMap } from '../lib/seriesLogos.js';
import { computePrestigeRanking, persistPrestigeRanking } from '../lib/seriesOverlap.js';
import { computeStandings, computeTeamStandings } from '../lib/standings.js';
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
                include: { pilot: true, team: true },
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
        team: result.team?.name ?? null,
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
              teamResults: {
                include: { team: true },
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
  const standings = computed.map((row) => {
    const { firstName, lastName } = resolvePilotDisplayNames(row.pilot);
    return {
      rank: row.rank,
      pilotSlug: row.pilot.slug,
      firstName,
      lastName,
      country: row.pilot.country,
      number: row.number,
      totalPoints: row.totalPoints,
      eventPoints: row.eventPoints,
      eventQual: row.eventQual,
    };
  });
  const teamStandings = computeTeamStandings(events);

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
    teamStandings,
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

function toPilotListSeries(participation: P4PSeriesParticipation): PilotListSeriesParticipation {
  return {
    slug: participation.slug,
    name: participation.name,
    shortName: participation.shortName,
    logoUrl: participation.logoUrl,
    weight: participation.weight,
    place: participation.place,
    avgQualScore: participation.avgQualScore,
  };
}

function listPilotSeasonSeries(
  p4pInputs: Awaited<ReturnType<typeof loadP4PInputs>>['inputs'],
  pilotId: string,
): PilotListSeriesParticipation[] {
  return pilotSeriesParticipations(p4pInputs, pilotId).map(toPilotListSeries);
}

publicRouter.get('/pilots', async (req, res) => {
  const year = parseOptionalYear(req.query.year) ?? new Date().getFullYear();
  const pageSize = parsePageSize(req.query.pageSize, PILOTS_PAGE_SIZE_DEFAULT);
  const searchQuery = parseSearchQuery(req.query.q);
  const seriesSlug = parseSeriesSlug(req.query.series);
  const prestige = await computePrestigeRanking(prisma, year);
  const { inputs: p4pInputs } = await loadP4PInputs(prisma, year, prestige.hardnessBySlug);
  const p4pRows = computeP4P(p4pInputs);

  const seriesFilters: PilotsListSeriesFilter[] = p4pInputs.map((series) => ({
    slug: series.slug,
    name: series.name,
    shortName: series.shortName,
    logoUrl: series.logoUrl ?? null,
  }));

  const rankedSlugs = new Set(p4pRows.map((row) => row.pilot.slug));
  const unrankedPilots = await prisma.pilot.findMany({
    where: { slug: { notIn: [...rankedSlugs] } },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const ranked: PilotListEntry[] = p4pRows.map((row) => {
    const seriesParticipations = listPilotSeasonSeries(p4pInputs, row.pilot.id);
    return {
      rank: row.rank,
      score: row.score,
      pilot: toPilotCard(row.pilot),
      bestSeries: seriesParticipations[0] ?? null,
      seriesParticipations,
    };
  });

  const unranked: PilotListEntry[] = unrankedPilots.map((pilot) => {
    const seriesParticipations = listPilotSeasonSeries(p4pInputs, pilot.id);
    return {
      rank: null,
      score: null,
      pilot: toPilotCard(pilot),
      bestSeries: seriesParticipations[0] ?? null,
      seriesParticipations,
    };
  });

  const pilotCount = ranked.length + unranked.length;
  let listed = [...ranked, ...unranked];
  if (searchQuery) {
    listed = listed.filter((entry) => pilotMatchesSearch(entry, searchQuery));
  }

  if (seriesSlug && seriesFilters.some((series) => series.slug === seriesSlug)) {
    listed = listed.filter((entry) =>
      entry.seriesParticipations.some((participation) => participation.slug === seriesSlug),
    );
  }

  const total = listed.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(parsePage(req.query.page, 1), pageCount);
  const pagePilots = listed.slice((page - 1) * pageSize, page * pageSize);

  const pilotIdBySlug = new Map(p4pRows.map((row) => [row.pilot.slug, row.pilot.id]));
  const rankedIdsOnPage = pagePilots
    .filter((entry) => entry.rank != null)
    .map((entry) => pilotIdBySlug.get(entry.pilot.slug))
    .filter((id): id is string => id != null);

  const statsByPilotSlug = new Map<string, ReturnType<typeof computePilotStats>>();
  if (rankedIdsOnPage.length > 0) {
    const rankedPilotResults = await prisma.pilot.findMany({
      where: { id: { in: rankedIdsOnPage } },
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
    for (const pilot of rankedPilotResults) {
      statsByPilotSlug.set(pilot.slug, computePilotStats(toStatsInput(pilot.results)));
    }
  }

  const pilots: PilotListEntry[] = pagePilots.map((entry) => {
    if (entry.rank == null) return entry;
    const stats = statsByPilotSlug.get(entry.pilot.slug);
    if (!stats) return entry;
    return {
      ...entry,
      pilot: {
        ...entry.pilot,
        stats,
      },
    };
  });

  const payload: PilotsListResponse = {
    year,
    pilotCount,
    seriesCount: p4pInputs.length,
    rankedCount: ranked.length,
    seriesFilters,
    page,
    pageSize,
    total,
    pageCount,
    pilots,
  };

  res.json(payload);
});

publicRouter.get('/pilots/:slug', async (req, res) => {
  const requestedSlug = String(req.params.slug);
  const candidates = pilotSlugLookupCandidates(requestedSlug);
  const matches = await prisma.pilot.findMany({
    where: { slug: { in: candidates } },
    select: { slug: true },
  });
  const resolvedSlug =
    matches.find((row) => row.slug === requestedSlug)?.slug ??
    matches.find((row) => row.slug === stripSeriesPilotSlugPrefix(requestedSlug))?.slug ??
    matches[0]?.slug ??
    requestedSlug;
  const pilot = await prisma.pilot.findUnique({
    where: { slug: resolvedSlug },
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

const PILOTS_PAGE_SIZE_DEFAULT = 50;
const PILOTS_PAGE_SIZE_MAX = 100;

function parseOptionalYear(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
}

function parsePage(value: unknown, defaultPage = 1): number {
  if (typeof value !== 'string') return defaultPage;
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page >= 1 ? page : defaultPage;
}

function parsePageSize(value: unknown, defaultSize: number): number {
  if (typeof value !== 'string') return defaultSize;
  const size = Number.parseInt(value, 10);
  if (!Number.isFinite(size) || size < 1) return defaultSize;
  return Math.min(size, PILOTS_PAGE_SIZE_MAX);
}

function parseSearchQuery(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parseSeriesSlug(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function pilotMatchesSearch(entry: PilotListEntry, query: string): boolean {
  const q = query.toLowerCase();
  const pilot = entry.pilot;
  const haystack = [
    pilot.firstName,
    pilot.lastName,
    pilot.number?.toString(),
    pilot.country,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

