import type { Pilot } from '@prisma/client';

export interface P4PInputSeries {
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl?: string | null;
  /** Raw overlap hardness for the series. */
  seriesHardness: number;
  standings: Array<{ avgPlace: number; avgQualScore: number; pilot: Pilot }>;
}

/** Bonus subtracted from raw P4P per featured series the pilot entered (lower raw is better). */
export const P4P_MULTI_SERIES_BONUS = 0.1;

/** Qual scores are 0–100; divide by 100 for a small P4P bonus. */
export function qualScoreP4PAdjustment(p4pQualScore: number): number {
  return p4pQualScore / 100;
}

function countP4PSeriesByPilot(seriesList: P4PInputSeries[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const series of seriesList) {
    for (const row of series.standings) {
      if (row.avgPlace <= 0) continue;
      counts.set(row.pilot.id, (counts.get(row.pilot.id) ?? 0) + 1);
    }
  }
  return counts;
}

export function applyMultiSeriesBonus(rawP4P: number, seriesCount: number): number {
  return rawP4P - P4P_MULTI_SERIES_BONUS * seriesCount;
}

/** Raw P4P (lower is better) → display score where #1 has the most points. */
export function p4pDisplayScore(rawP4P: number): number {
  return Math.round((100 - rawP4P) * 100) / 100;
}

/** Featured-series participations for one pilot in a season (best P4P series first). */
export function pilotSeriesParticipations(
  seriesList: P4PInputSeries[],
  pilotId: string,
): P4PSeriesParticipation[] {
  type Scored = P4PSeriesParticipation & { adjusted: number };
  const rows: Scored[] = [];

  for (const series of seriesList) {
    const row = series.standings.find((standing) => standing.pilot.id === pilotId);
    if (!row || row.avgPlace <= 0) continue;

    const adjusted =
      row.avgPlace - series.seriesHardness - qualScoreP4PAdjustment(row.avgQualScore);
    rows.push({
      slug: series.slug,
      name: series.name,
      shortName: series.shortName,
      logoUrl: series.logoUrl ?? null,
      weight: Math.round(series.seriesHardness * 100) / 100,
      place: row.avgPlace,
      avgQualScore: row.avgQualScore,
      adjusted,
    });
  }

  rows.sort((a, b) => a.adjusted - b.adjusted);
  return rows.map(({ adjusted: _adjusted, ...participation }) => participation);
}

export interface P4PSeriesParticipation {
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  weight: number;
  place: number;
  avgQualScore: number | null;
}

export interface P4PResult {
  rank: number;
  score: number;
  pilot: Pilot;
  bestSeriesSlug: string;
  bestSeriesName: string;
  bestSeriesShortName: string | null;
  bestSeriesLogoUrl: string | null;
  bestSeriesWeight: number;
  bestSeriesPlace: number;
  bestSeriesAvgQual: number | null;
  /** Other featured series the pilot entered in the same season (excluding best). */
  otherSeries: P4PSeriesParticipation[];
}

/** P4P = min(avgPlace − Hardness − qual/100) − 0.1×series (lower raw is better). */
export function computeP4P(
  seriesList: P4PInputSeries[],
  limit?: number,
): P4PResult[] {
  const seriesCountByPilot = countP4PSeriesByPilot(seriesList);
  type PilotSeriesRow = {
    pilot: Pilot;
    adjusted: number;
    seriesSlug: string;
    seriesName: string;
    seriesShortName: string | null;
    seriesLogoUrl: string | null;
    hardness: number;
    place: number;
    avgQualScore: number;
  };

  const bestByPilot = new Map<string, PilotSeriesRow>();
  const allSeriesByPilot = new Map<string, PilotSeriesRow[]>();

  for (const series of seriesList) {
    for (const row of series.standings) {
      if (row.avgPlace <= 0) continue;

      const adjusted =
        row.avgPlace - series.seriesHardness - qualScoreP4PAdjustment(row.avgQualScore);
      const participation: PilotSeriesRow = {
        pilot: row.pilot,
        adjusted,
        seriesSlug: series.slug,
        seriesName: series.name,
        seriesShortName: series.shortName,
        seriesLogoUrl: series.logoUrl ?? null,
        hardness: series.seriesHardness,
        place: row.avgPlace,
        avgQualScore: row.avgQualScore,
      };

      const seriesListForPilot = allSeriesByPilot.get(row.pilot.id) ?? [];
      seriesListForPilot.push(participation);
      allSeriesByPilot.set(row.pilot.id, seriesListForPilot);

      const existing = bestByPilot.get(row.pilot.id);
      if (!existing || adjusted < existing.adjusted) {
        bestByPilot.set(row.pilot.id, participation);
      }
    }
  }

  function toSeriesParticipation(row: PilotSeriesRow): P4PSeriesParticipation {
    return {
      slug: row.seriesSlug,
      name: row.seriesName,
      shortName: row.seriesShortName,
      logoUrl: row.seriesLogoUrl,
      weight: Math.round(row.hardness * 100) / 100,
      place: row.place,
      avgQualScore: row.avgQualScore,
    };
  }

  const sorted = [...bestByPilot.values()].sort((a, b) => {
    const rawA = applyMultiSeriesBonus(a.adjusted, seriesCountByPilot.get(a.pilot.id) ?? 0);
    const rawB = applyMultiSeriesBonus(b.adjusted, seriesCountByPilot.get(b.pilot.id) ?? 0);
    return rawA - rawB || a.pilot.lastName.localeCompare(b.pilot.lastName);
  });

  return (limit != null ? sorted.slice(0, limit) : sorted).map((row, index) => {
    const rawP4P = applyMultiSeriesBonus(
      row.adjusted,
      seriesCountByPilot.get(row.pilot.id) ?? 0,
    );
    const otherSeries = (allSeriesByPilot.get(row.pilot.id) ?? [])
      .filter((entry) => entry.seriesSlug !== row.seriesSlug)
      .sort((a, b) => a.adjusted - b.adjusted)
      .map(toSeriesParticipation);

    return {
      rank: index + 1,
      score: p4pDisplayScore(rawP4P),
      pilot: row.pilot,
      bestSeriesSlug: row.seriesSlug,
      bestSeriesName: row.seriesName,
      bestSeriesShortName: row.seriesShortName,
      bestSeriesLogoUrl: row.seriesLogoUrl,
      bestSeriesWeight: Math.round(row.hardness * 100) / 100,
      bestSeriesPlace: row.place,
      bestSeriesAvgQual: row.avgQualScore,
      otherSeries,
    };
  });
}
