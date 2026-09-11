import type { Pilot } from '@prisma/client';

export interface P4PInputSeries {
  slug: string;
  nameEn: string;
  nameRu: string;
  /** Overlap hardness coefficient H = (raw + 32) / 32 */
  seriesWeight: number;
  standings: Array<{ rank: number; pilot: Pilot }>;
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
}

/** P4P = max(H / P) × 1000 across series, H = overlap coefficient, P = standing place */
export function computeP4P(
  seriesList: P4PInputSeries[],
  limit?: number,
): P4PResult[] {
  const bestByPilot = new Map<
    string,
    {
      pilot: Pilot;
      score: number;
      seriesSlug: string;
      seriesNameEn: string;
      seriesNameRu: string;
      weight: number;
      place: number;
    }
  >();

  for (const series of seriesList) {
    if (series.seriesWeight <= 0) continue;

    for (const row of series.standings) {
      if (row.rank <= 0) continue;

      const score = series.seriesWeight / row.rank;
      const existing = bestByPilot.get(row.pilot.id);
      if (!existing || score > existing.score) {
        bestByPilot.set(row.pilot.id, {
          pilot: row.pilot,
          score,
          seriesSlug: series.slug,
          seriesNameEn: series.nameEn,
          seriesNameRu: series.nameRu,
          weight: series.seriesWeight,
          place: row.rank,
        });
      }
    }
  }

  const sorted = [...bestByPilot.values()].sort(
    (a, b) => b.score - a.score || a.pilot.lastName.localeCompare(b.pilot.lastName),
  );

  return (limit != null ? sorted.slice(0, limit) : sorted).map((row, index) => ({
      rank: index + 1,
      score: Math.round(row.score * 1000),
      pilot: row.pilot,
      bestSeriesSlug: row.seriesSlug,
      bestSeriesNameEn: row.seriesNameEn,
      bestSeriesNameRu: row.seriesNameRu,
      bestSeriesWeight: Math.round(row.weight * 1000) / 1000,
      bestSeriesPlace: row.place,
    }));
}
