import type { Pilot } from '@prisma/client';

/** S = (N − seriesRank + 1) / N — top series = 1, last = 1/N */
export function seriesCoefficient(seriesRank: number, totalSeries: number): number {
  if (totalSeries <= 0 || seriesRank <= 0) return 1;
  return (totalSeries - seriesRank + 1) / totalSeries;
}

export interface P4PInputSeries {
  slug: string;
  nameEn: string;
  nameRu: string;
  seriesOrder: number;
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

/** P4P = max(S / P) × 1000 across series, S = series weight, P = standing place */
export function computeP4P(
  seriesList: P4PInputSeries[],
  limit = 10,
  totalFeaturedSeries?: number,
): P4PResult[] {
  const totalSeries = totalFeaturedSeries ?? seriesList.length;
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
    const s = seriesCoefficient(series.seriesOrder, totalSeries);

    for (const row of series.standings) {
      if (row.rank <= 0) continue;

      const score = s / row.rank;
      const existing = bestByPilot.get(row.pilot.id);
      if (!existing || score > existing.score) {
        bestByPilot.set(row.pilot.id, {
          pilot: row.pilot,
          score,
          seriesSlug: series.slug,
          seriesNameEn: series.nameEn,
          seriesNameRu: series.nameRu,
          weight: s,
          place: row.rank,
        });
      }
    }
  }

  return [...bestByPilot.values()]
    .sort((a, b) => b.score - a.score || a.pilot.lastName.localeCompare(b.pilot.lastName))
    .slice(0, limit)
    .map((row, index) => ({
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
