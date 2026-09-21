import { eventResultPlace } from './standings.js';

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
