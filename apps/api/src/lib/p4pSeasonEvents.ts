import { eventResultPlace } from './standings.js';

export interface P4PSeasonEventRow {
  roundNumber: number;
  eventName: string;
  qualPosition: number | null;
  qualScore100: number | null;
  eventPlace: number | null;
  tandemBattles: number | null;
  tandemWins: number | null;
  points: number;
}

type ResultWithEvent = {
  qualPosition: number | null;
  qualScore100: number | null;
  tandemPosition: number | null;
  tandemBattles: number | null;
  tandemWins: number | null;
  points: number;
  event: {
    name: string;
    roundNumber: number;
    status: string;
    season: { year: number; series: { slug: string } };
  };
};

export function buildP4PBestSeriesEvents(
  results: ResultWithEvent[],
  bestSeriesSlug: string,
  seasonYear: number,
): P4PSeasonEventRow[] {
  return results
    .filter(
      (result) =>
        result.event.season.series.slug === bestSeriesSlug &&
        result.event.season.year === seasonYear &&
        result.event.status === 'FINISHED',
    )
    .sort((a, b) => a.event.roundNumber - b.event.roundNumber)
    .map((result) => ({
      roundNumber: result.event.roundNumber,
      eventName: result.event.name,
      qualPosition: result.qualPosition,
      qualScore100: result.qualScore100,
      eventPlace: eventResultPlace(result),
      tandemBattles: result.tandemBattles,
      tandemWins: result.tandemWins,
      points: result.points,
    }));
}
