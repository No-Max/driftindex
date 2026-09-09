export interface PilotResultForStats {
  qualPoints: number | null;
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
  avgQualPoints: number | null;
}

export function computePilotStats(results: PilotResultForStats[]): PilotStats {
  const finished = results.filter((r) => r.eventStatus === 'FINISHED');
  const seasons = new Set(finished.map((r) => `${r.seriesSlug}:${r.seasonYear}`));
  const wins = finished.filter((r) => r.tandemPosition === 1).length;
  const qualScores = finished
    .map((r) => r.qualPoints)
    .filter((value): value is number => value != null);

  return {
    eventsCount: finished.length,
    seasonsCount: seasons.size,
    winsCount: wins,
    winRate:
      finished.length > 0 ? Math.round((wins / finished.length) * 1000) / 10 : null,
    avgQualPoints:
      qualScores.length > 0
        ? Math.round((qualScores.reduce((sum, value) => sum + value, 0) / qualScores.length) * 10) / 10
        : null,
  };
}

export function toStatsInput(
  results: Array<{
    qualPoints: number | null;
    tandemPosition: number | null;
    event: {
      status: string;
      season: { year: number; series: { slug: string } };
    };
  }>,
): PilotResultForStats[] {
  return results.map((result) => ({
    qualPoints: result.qualPoints,
    tandemPosition: result.tandemPosition,
    eventStatus: result.event.status,
    seriesSlug: result.event.season.series.slug,
    seasonYear: result.event.season.year,
  }));
}
