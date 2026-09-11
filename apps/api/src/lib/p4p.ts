import type { Pilot } from '@prisma/client';

export interface P4PInputSeries {
  slug: string;
  nameEn: string;
  nameRu: string;
  /** Raw overlap hardness for the series. */
  seriesHardness: number;
  standings: Array<{ avgPlace: number; avgQualScore: number | null; pilot: Pilot }>;
}

/** Qual scores are 0–100; divide by 100 for a small P4P bonus. */
export function qualScoreP4PAdjustment(avgQualScore: number | null): number {
  return avgQualScore != null ? avgQualScore / 100 : 0;
}

export interface P4PResult {
  rank: number;
  score: number;
  pilot: Pilot;
  bestSeriesSlug: string;
  bestSeriesNameEn: string;
  bestSeriesNameRu: string;
  bestSeriesWeight: number;
  bestSeriesPlace: number;
  bestSeriesAvgQual: number | null;
}

/** P4P = min(avgPlace − Hardness − avgQual/100) + N, where N = pilots in the P4P pool (lower is better). */
export function computeP4P(
  seriesList: P4PInputSeries[],
  limit?: number,
): P4PResult[] {
  const bestByPilot = new Map<
    string,
    {
      pilot: Pilot;
      adjusted: number;
      seriesSlug: string;
      seriesNameEn: string;
      seriesNameRu: string;
      hardness: number;
      place: number;
      avgQualScore: number | null;
    }
  >();

  for (const series of seriesList) {
    for (const row of series.standings) {
      if (row.avgPlace <= 0) continue;

      const adjusted =
        row.avgPlace - series.seriesHardness - qualScoreP4PAdjustment(row.avgQualScore);
      const existing = bestByPilot.get(row.pilot.id);
      if (!existing || adjusted < existing.adjusted) {
        bestByPilot.set(row.pilot.id, {
          pilot: row.pilot,
          adjusted,
          seriesSlug: series.slug,
          seriesNameEn: series.nameEn,
          seriesNameRu: series.nameRu,
          hardness: series.seriesHardness,
          place: row.avgPlace,
          avgQualScore: row.avgQualScore,
        });
      }
    }
  }

  const p4pPilotCount = bestByPilot.size;
  const sorted = [...bestByPilot.values()].sort(
    (a, b) => a.adjusted - b.adjusted || a.pilot.lastName.localeCompare(b.pilot.lastName),
  );

  return (limit != null ? sorted.slice(0, limit) : sorted).map((row, index) => ({
      rank: index + 1,
      score: Math.round((row.adjusted + p4pPilotCount) * 100) / 100,
      pilot: row.pilot,
      bestSeriesSlug: row.seriesSlug,
      bestSeriesNameEn: row.seriesNameEn,
      bestSeriesNameRu: row.seriesNameRu,
      bestSeriesWeight: Math.round(row.hardness * 100) / 100,
      bestSeriesPlace: row.place,
      bestSeriesAvgQual: row.avgQualScore,
    }));
}
