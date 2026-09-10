import type { PrismaClient } from '@prisma/client';
import { seriesCoefficient } from './p4p.js';
import { buildNameKey } from './transliterate.js';
import { computeStandings, type SeasonEventWithResults } from './standings.js';

/** How many past seasons feed overlap prestige for a target year (inclusive). */
export const PRESTIGE_HISTORY_YEARS = 5;
/** Recency decay per year back from the target year (1.0 = current season). */
export const PRESTIGE_YEAR_DECAY = 0.85;

export interface PilotSeasonStanding {
  pilotId: string;
  pilotSlug: string;
  firstName: string;
  lastName: string;
  nameRu: string | null;
  identityKey: string;
  seriesSlug: string;
  seasonYear: number;
  place: number;
}

export interface OverlapContribution {
  pilotSlug: string;
  firstName: string;
  lastName: string;
  seasonYear: number;
  harderSeriesSlug: string;
  easierSeriesSlug: string;
  placeInHarder: number;
  placeInEasier: number;
  delta: number;
}

export interface SeriesPrestigeEntry {
  slug: string;
  nameEn: string;
  nameRu: string;
  manualOrder: number;
  overlapOrder: number | null;
  effectiveOrder: number;
  coefficient: number;
  hardnessScore: number;
  overlapSamples: number;
  contributions: OverlapContribution[];
}

export interface PrestigeRankingResult {
  totalSeries: number;
  overlapGroups: number;
  historyYears: number;
  historyFromYear: number | null;
  historyToYear: number | null;
  source: 'stored' | 'overlap' | 'manual';
  entries: SeriesPrestigeEntry[];
  orderBySlug: Map<string, number>;
}

function pilotIdentityKey(firstName: string, lastName: string, nameRu: string | null): string {
  const key = buildNameKey(firstName, lastName, nameRu);
  return key.split('|').length >= 2 ? key : '';
}

function overlapGroupKey(row: PilotSeasonStanding): string {
  return row.identityKey ? row.identityKey : row.pilotId;
}

function recencyWeight(targetYear: number, seasonYear: number): number {
  const age = targetYear - seasonYear;
  if (age < 0 || age >= PRESTIGE_HISTORY_YEARS) return 0;
  return PRESTIGE_YEAR_DECAY ** age;
}

export async function loadPilotSeasonStandings(prisma: PrismaClient): Promise<PilotSeasonStanding[]> {
  const seriesList = await prisma.series.findMany({
    where: { featuredOrder: { not: null } },
    include: {
      seasons: {
        include: {
          events: {
            include: {
              results: { include: { pilot: true } },
            },
          },
        },
      },
    },
  });

  const standings: PilotSeasonStanding[] = [];

  for (const series of seriesList) {
    for (const season of series.seasons) {
      const events = season.events as SeasonEventWithResults[];
      if (!events.some((e) => e.status === 'FINISHED')) continue;

      const computed = computeStandings(events);
      for (const row of computed) {
        standings.push({
          pilotId: row.pilot.id,
          pilotSlug: row.pilot.slug,
          firstName: row.pilot.firstName,
          lastName: row.pilot.lastName,
          nameRu: row.pilot.nameRu,
          identityKey: pilotIdentityKey(
            row.pilot.firstName,
            row.pilot.lastName,
            row.pilot.nameRu,
          ),
          seriesSlug: series.slug,
          seasonYear: season.year,
          place: row.rank,
        });
      }
    }
  }

  return standings;
}

/**
 * Overlap: pilots in 2+ series (same season year).
 * If place_B > place_A → pilot did worse in B → B is harder → B gets hardness points.
 */
export function computeHardnessScores(
  standings: PilotSeasonStanding[],
  seriesSlugs: string[],
  targetYear?: number,
): {
  hardness: Map<string, number>;
  samples: Map<string, number>;
  contributions: OverlapContribution[];
  contributionsBySeries: Map<string, OverlapContribution[]>;
} {
  const hardness = new Map<string, number>();
  const samples = new Map<string, number>();
  const contributionsBySeries = new Map<string, OverlapContribution[]>();
  for (const slug of seriesSlugs) {
    hardness.set(slug, 0);
    samples.set(slug, 0);
    contributionsBySeries.set(slug, []);
  }

  const contributions: OverlapContribution[] = [];

  const byPilotSeason = new Map<string, PilotSeasonStanding[]>();
  for (const row of standings) {
    if (targetYear != null && recencyWeight(targetYear, row.seasonYear) <= 0) continue;

    const key = `${overlapGroupKey(row)}:${row.seasonYear}`;
    const group = byPilotSeason.get(key) ?? [];
    group.push(row);
    byPilotSeason.set(key, group);
  }

  for (const group of byPilotSeason.values()) {
    if (group.length < 2) continue;

    const uniqueSeries = new Set(group.map((row) => row.seriesSlug));
    if (uniqueSeries.size < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;

        if (a.seriesSlug === b.seriesSlug) continue;
        if (b.place === a.place) continue;

        const harder = b.place > a.place ? b : a;
        const easier = b.place > a.place ? a : b;
        const rawDelta = harder.place - easier.place;
        const weight =
          targetYear != null ? recencyWeight(targetYear, harder.seasonYear) : 1;
        if (weight <= 0) continue;

        const delta = rawDelta * weight;

        hardness.set(harder.seriesSlug, (hardness.get(harder.seriesSlug) ?? 0) + delta);
        samples.set(harder.seriesSlug, (samples.get(harder.seriesSlug) ?? 0) + weight);

        const contribution: OverlapContribution = {
          pilotSlug: harder.pilotSlug,
          firstName: harder.firstName,
          lastName: harder.lastName,
          seasonYear: harder.seasonYear,
          harderSeriesSlug: harder.seriesSlug,
          easierSeriesSlug: easier.seriesSlug,
          placeInHarder: harder.place,
          placeInEasier: easier.place,
          delta: Math.round(delta * 100) / 100,
        };

        contributions.push(contribution);
        contributionsBySeries.get(harder.seriesSlug)!.push(contribution);
      }
    }
  }

  for (const list of contributionsBySeries.values()) {
    list.sort((a, b) => b.delta - a.delta || a.lastName.localeCompare(b.lastName));
  }

  contributions.sort((a, b) => b.delta - a.delta || a.lastName.localeCompare(b.lastName));

  return { hardness, samples, contributions, contributionsBySeries };
}

export function buildPrestigeRanking(
  seriesList: Array<{ slug: string; nameEn: string; nameRu: string; featuredOrder: number | null }>,
  standings: PilotSeasonStanding[],
  storedRanks?: Map<string, number>,
  targetYear?: number,
): PrestigeRankingResult {
  const featured = seriesList
    .filter((s) => s.featuredOrder != null)
    .sort((a, b) => a.featuredOrder! - b.featuredOrder!);

  const slugs = featured.map((s) => s.slug);
  const totalSeries = slugs.length;
  const { hardness, samples, contributionsBySeries } = computeHardnessScores(
    standings,
    slugs,
    targetYear,
  );

  const pilotSeasonCounts = standings.reduce((acc, row) => {
    if (targetYear != null && recencyWeight(targetYear, row.seasonYear) <= 0) return acc;
    const key = `${overlapGroupKey(row)}:${row.seasonYear}`;
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());
  const multiSeriesGroups = [...pilotSeasonCounts.values()].filter((count) => count >= 2).length;

  const historyFromYear =
    targetYear != null ? targetYear - PRESTIGE_HISTORY_YEARS + 1 : null;
  const historyToYear = targetYear ?? null;

  const hasOverlap = [...samples.values()].some((n) => n > 0);

  const ranked = featured.map((series) => ({
    ...series,
    manualOrder: series.featuredOrder!,
    hardnessScore: hardness.get(series.slug) ?? 0,
    overlapSamples: samples.get(series.slug) ?? 0,
  }));

  let overlapOrderBySlug = new Map<string, number>();

  if (hasOverlap) {
    const sorted = [...ranked].sort((a, b) => {
      if (b.hardnessScore !== a.hardnessScore) return b.hardnessScore - a.hardnessScore;
      return a.manualOrder - b.manualOrder;
    });
    overlapOrderBySlug = new Map(sorted.map((s, index) => [s.slug, index + 1]));
  }

  const entries: SeriesPrestigeEntry[] = ranked.map((series) => {
    const overlapOrder = overlapOrderBySlug.get(series.slug) ?? null;
    const storedOrder = storedRanks?.get(series.slug);
    const effectiveOrder = storedOrder ?? overlapOrder ?? series.manualOrder;
    return {
      slug: series.slug,
      nameEn: series.nameEn,
      nameRu: series.nameRu,
      manualOrder: series.manualOrder,
      overlapOrder,
      effectiveOrder,
      coefficient: seriesCoefficient(effectiveOrder, totalSeries),
      hardnessScore: Math.round(series.hardnessScore * 100) / 100,
      overlapSamples: series.overlapSamples,
      contributions: contributionsBySeries.get(series.slug) ?? [],
    };
  });

  entries.sort((a, b) => a.effectiveOrder - b.effectiveOrder);

  const orderBySlug = new Map(entries.map((e) => [e.slug, e.effectiveOrder]));

  let source: 'stored' | 'overlap' | 'manual' = 'manual';
  if (storedRanks && storedRanks.size > 0) source = 'stored';
  else if (hasOverlap) source = 'overlap';

  return {
    totalSeries,
    overlapGroups: multiSeriesGroups,
    historyYears: PRESTIGE_HISTORY_YEARS,
    historyFromYear,
    historyToYear,
    source,
    entries,
    orderBySlug,
  };
}

export async function computePrestigeRanking(prisma: PrismaClient, year?: number): Promise<PrestigeRankingResult> {
  const seriesList = await prisma.series.findMany({
    where: { featuredOrder: { not: null } },
    orderBy: { featuredOrder: 'asc' },
  });

  const standings = await loadPilotSeasonStandings(prisma);

  let storedRanks: Map<string, number> | undefined;
  if (year != null) {
    const weights = await prisma.seriesWeight.findMany({
      where: { year, prestigeRank: { not: null } },
      include: { series: true },
    });
    if (weights.length > 0) {
      storedRanks = new Map(
        weights.filter((w) => w.prestigeRank != null).map((w) => [w.series.slug, w.prestigeRank!]),
      );
    }
  }

  const targetYear = year ?? new Date().getFullYear();
  return buildPrestigeRanking(seriesList, standings, storedRanks, targetYear);
}

/** Persist overlap-based prestige for a year (end-of-season job). */
export async function persistPrestigeRanking(prisma: PrismaClient, year: number): Promise<PrestigeRankingResult> {
  const seriesList = await prisma.series.findMany({
    where: { featuredOrder: { not: null } },
    orderBy: { featuredOrder: 'asc' },
  });
  const standings = await loadPilotSeasonStandings(prisma);
  const result = buildPrestigeRanking(seriesList, standings, undefined, year);

  for (const entry of result.entries) {
    const series = await prisma.series.findUnique({ where: { slug: entry.slug } });
    if (!series) continue;

    const order = entry.overlapOrder ?? entry.manualOrder;
    const coefficient = seriesCoefficient(order, result.totalSeries);

    await prisma.seriesWeight.upsert({
      where: { seriesId_year: { seriesId: series.id, year } },
      update: {
        prestigeRank: order,
        weight: coefficient,
        calculatedAt: new Date(),
      },
      create: {
        seriesId: series.id,
        year,
        prestigeRank: order,
        weight: coefficient,
      },
    });
  }

  return computePrestigeRanking(prisma, year);
}
