import { eventResultPlace } from './standings.js';
import type { SeasonEventWithResults } from './standings.js';

export interface P4PSeasonEventRow {
  seriesSlug: string;
  seriesName: string;
  seriesShortName: string | null;
  eventSlug: string;
  roundNumber: number;
  eventName: string;
  startsAt: string | null;
  qualPosition: number | null;
  qualScore100: number | null;
  eventPlace: number | null;
  tandemBattles: number | null;
  tandemWins: number | null;
  points: number;
}

export interface SeasonEventWithSeries extends SeasonEventWithResults {
  series: { slug: string; name: string; shortName: string | null };
}

type ResultWithEvent = {
  pilotId: string;
  qualPosition: number | null;
  qualScore100: number | null;
  tandemPosition: number | null;
  tandemBattles: number | null;
  tandemWins: number | null;
  points: number;
  event: {
    id: string;
    slug: string;
    name: string;
    roundNumber: number;
    status: string;
    startsAt: Date | null;
    season: {
      year: number;
      series: { slug: string; name: string; shortName: string | null };
    };
  };
};

/** All finished featured-series events for one pilot in a season (chronological). */
export function buildP4PSeasonEvents(
  results: ResultWithEvent[],
  seasonYear: number,
  pointsPlaceByEventId: Map<string, Map<string, number>>,
  featuredSeriesSlugs: ReadonlySet<string>,
): P4PSeasonEventRow[] {
  return results
    .filter(
      (result) =>
        result.event.season.year === seasonYear &&
        result.event.status === 'FINISHED' &&
        featuredSeriesSlugs.has(result.event.season.series.slug),
    )
    .sort((a, b) => {
      const aTime = a.event.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.event.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      const seriesCmp = a.event.season.series.slug.localeCompare(b.event.season.series.slug);
      if (seriesCmp !== 0) return seriesCmp;
      return a.event.roundNumber - b.event.roundNumber;
    })
    .map((result) => ({
      seriesSlug: result.event.season.series.slug,
      seriesName: result.event.season.series.name,
      seriesShortName: result.event.season.series.shortName,
      eventSlug: result.event.slug,
      roundNumber: result.event.roundNumber,
      eventName: result.event.name,
      startsAt: result.event.startsAt?.toISOString() ?? null,
      qualPosition: result.qualPosition,
      qualScore100: result.qualScore100,
      eventPlace: eventResultPlace({
        pointsPlace: pointsPlaceByEventId.get(result.event.id)?.get(result.pilotId) ?? null,
        tandemPosition: result.tandemPosition,
        qualPosition: result.qualPosition,
      }),
      tandemBattles: result.tandemBattles,
      tandemWins: result.tandemWins,
      points: result.points,
    }));
}

/**
 * Build season event rows for one pilot from already-loaded featured-series events
 * (avoids a second DB round-trip when listing many pilots).
 */
export function buildPilotSeasonEventsFromLoaded(
  events: readonly SeasonEventWithSeries[],
  pilotId: string,
  pointsPlaceByEventId: Map<string, Map<string, number>>,
): P4PSeasonEventRow[] {
  return indexPilotSeasonEventsFromLoaded(events, pointsPlaceByEventId).get(pilotId) ?? [];
}

/** Precompute season event rows for every pilot that appears in loaded events. */
export function indexPilotSeasonEventsFromLoaded(
  events: readonly SeasonEventWithSeries[],
  pointsPlaceByEventId: Map<string, Map<string, number>>,
): Map<string, P4PSeasonEventRow[]> {
  const byPilot = new Map<string, P4PSeasonEventRow[]>();

  for (const event of events) {
    if (event.status !== 'FINISHED') continue;

    for (const result of event.results) {
      const row: P4PSeasonEventRow = {
        seriesSlug: event.series.slug,
        seriesName: event.series.name,
        seriesShortName: event.series.shortName,
        eventSlug: event.slug,
        roundNumber: event.roundNumber,
        eventName: event.name,
        startsAt: event.startsAt?.toISOString() ?? null,
        qualPosition: result.qualPosition,
        qualScore100: result.qualScore100,
        eventPlace: eventResultPlace({
          pointsPlace: pointsPlaceByEventId.get(event.id)?.get(result.pilotId) ?? null,
          tandemPosition: result.tandemPosition,
          qualPosition: result.qualPosition,
        }),
        tandemBattles: null,
        tandemWins: null,
        points: result.points,
      };
      const list = byPilot.get(result.pilotId);
      if (list) list.push(row);
      else byPilot.set(result.pilotId, [row]);
    }
  }

  for (const rows of byPilot.values()) {
    rows.sort((a, b) => {
      const aTime = a.startsAt ? Date.parse(a.startsAt) : Number.MAX_SAFE_INTEGER;
      const bTime = b.startsAt ? Date.parse(b.startsAt) : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      const seriesCmp = a.seriesSlug.localeCompare(b.seriesSlug);
      if (seriesCmp !== 0) return seriesCmp;
      return a.roundNumber - b.roundNumber;
    });
  }

  return byPilot;
}
