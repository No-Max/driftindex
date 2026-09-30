import { averageQualScore100 } from './qualScore.js';

export interface PilotResultForStats {
  qualScore100: number | null;
  tandemBattles: number | null;
  tandemWins: number | null;
  tandemPosition: number | null;
  eventStatus: string;
  seriesSlug: string;
  seasonYear: number;
}

export interface PilotStats {
  eventsCount: number;
  seasonsCount: number;
  tandemBattles: number;
  tandemWins: number;
  tandemWinPct: number | null;
  avgQualScore: number | null;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
}

export function computePilotStats(results: PilotResultForStats[]): PilotStats {
  const finished = results.filter((r) => r.eventStatus === 'FINISHED');
  const seasons = new Set(finished.map((r) => `${r.seriesSlug}:${r.seasonYear}`));

  const withBattles = finished.filter((r) => r.tandemBattles != null && r.tandemBattles > 0);
  const tandemBattles = withBattles.reduce((sum, r) => sum + (r.tandemBattles ?? 0), 0);
  const tandemWins = withBattles.reduce((sum, r) => sum + (r.tandemWins ?? 0), 0);

  let firstPlaces = 0;
  let secondPlaces = 0;
  let thirdPlaces = 0;
  for (const result of finished) {
    if (result.tandemPosition === 1) firstPlaces += 1;
    else if (result.tandemPosition === 2) secondPlaces += 1;
    else if (result.tandemPosition === 3) thirdPlaces += 1;
  }

  return {
    eventsCount: finished.length,
    seasonsCount: seasons.size,
    tandemBattles,
    tandemWins,
    tandemWinPct:
      tandemBattles > 0 ? Math.round((tandemWins / tandemBattles) * 1000) / 10 : null,
    avgQualScore: averageQualScore100(finished.map((r) => r.qualScore100)),
    firstPlaces,
    secondPlaces,
    thirdPlaces,
  };
}

export function formatTandemRecord(stats: Pick<PilotStats, 'tandemBattles' | 'tandemWins' | 'tandemWinPct'>): string {
  if (stats.tandemBattles <= 0 || stats.tandemWinPct == null) return '—';
  return `${stats.tandemBattles}/${stats.tandemWins} (${stats.tandemWinPct}%)`;
}

export function toStatsInput(
  results: Array<{
    qualScore100: number | null;
    tandemBattles: number | null;
    tandemWins: number | null;
    tandemPosition: number | null;
    event: {
      status: string;
      season: { year: number; series: { slug: string } };
    };
  }>,
): PilotResultForStats[] {
  return results.map((result) => ({
    qualScore100: result.qualScore100,
    tandemBattles: result.tandemBattles,
    tandemWins: result.tandemWins,
    tandemPosition: result.tandemPosition,
    eventStatus: result.event.status,
    seriesSlug: result.event.season.series.slug,
    seasonYear: result.event.season.year,
  }));
}
