import { averageQualScore100 } from './qualScore.js';

export interface PilotResultForStats {
  qualScore100: number | null;
  tandemPosition: number | null;
  eventStatus: string;
  seriesSlug: string;
  seasonYear: number;
}

export interface PilotStats {
  eventsCount: number;
  seasonsCount: number;
  winsCount: number;
  winRate: number | null;
  avgQualScore: number | null;
}

export function computePilotStats(results: PilotResultForStats[]): PilotStats {
  const finished = results.filter((r) => r.eventStatus === 'FINISHED');
  const seasons = new Set(finished.map((r) => `${r.seriesSlug}:${r.seasonYear}`));
  const wins = finished.filter((r) => r.tandemPosition === 1).length;

  return {
    eventsCount: finished.length,
    seasonsCount: seasons.size,
    winsCount: wins,
    winRate:
      finished.length > 0 ? Math.round((wins / finished.length) * 1000) / 10 : null,
    avgQualScore: averageQualScore100(finished.map((r) => r.qualScore100)),
  };
}

export function toStatsInput(
  results: Array<{
    qualScore100: number | null;
    tandemPosition: number | null;
    event: {
      status: string;
      season: { year: number; series: { slug: string } };
    };
  }>,
): PilotResultForStats[] {
  return results.map((result) => ({
    qualScore100: result.qualScore100,
    tandemPosition: result.tandemPosition,
    eventStatus: result.event.status,
    seriesSlug: result.event.season.series.slug,
    seasonYear: result.event.season.year,
  }));
}
