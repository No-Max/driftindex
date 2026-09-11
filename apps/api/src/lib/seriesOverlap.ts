import type { PrismaClient } from '@prisma/client';
import { seriesCoefficient } from './p4p.js';
import { buildNameKey } from './transliterate.js';
import { computeStandings, type SeasonEventWithResults } from './standings.js';

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

export interface PilotSeriesIndexAverage {
  pilotId: string;
  pilotSlug: string;
  firstName: string;
  lastName: string;
  identityKey: string;
  seriesSlug: string;
  avgIndexPoints: number;
  avgPlace: number;
  eventCount: number;
}

export interface OverlapContribution {
  pilotSlug: string;
  firstName: string;
  lastName: string;
  targetSeriesSlug: string;
  otherSeriesSlug: string;
  avgPlaceTarget: number;
  avgPlaceOther: number;
  delta: number;
}

export interface SeriesPrestigeEntry {
  slug: string;
  nameEn: string;
  nameRu: string;
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
  source: 'overlap' | 'insufficient';
  entries: SeriesPrestigeEntry[];
  orderBySlug: Map<string, number>;
}

function pilotIdentityKey(firstName: string, lastName: string, nameRu: string | null): string {
  const key = buildNameKey(firstName, lastName, nameRu);
  return key.split('|').length >= 2 ? key : '';
}

function overlapGroupKey(row: { identityKey: string; pilotId: string }): string {
  return row.identityKey ? row.identityKey : row.pilotId;
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

export async function loadPilotSeriesIndexAverages(
  prisma: PrismaClient,
): Promise<PilotSeriesIndexAverage[]> {
  const rows = await prisma.eventResult.findMany({
    where: {
      indexPoints: { not: null },
      event: {
        status: 'FINISHED',
        season: { series: { featuredOrder: { not: null } } },
      },
    },
    select: {
      indexPoints: true,
      tandemPosition: true,
      qualPosition: true,
      pilot: {
        select: {
          id: true,
          slug: true,
          firstName: true,
          lastName: true,
          nameRu: true,
        },
      },
      event: {
        select: {
          season: { select: { series: { select: { slug: true } } } },
        },
      },
    },
  });

  const buckets = new Map<
    string,
    {
      pilotId: string;
      pilotSlug: string;
      firstName: string;
      lastName: string;
      identityKey: string;
      seriesSlug: string;
      indexSum: number;
      placeSum: number;
      count: number;
    }
  >();

  for (const row of rows) {
    const place = row.tandemPosition ?? row.qualPosition;
    if (place == null) continue;

    const seriesSlug = row.event.season.series.slug;
    const key = `${row.pilot.id}:${seriesSlug}`;
    const identityKey = pilotIdentityKey(row.pilot.firstName, row.pilot.lastName, row.pilot.nameRu);
    const bucket = buckets.get(key) ?? {
      pilotId: row.pilot.id,
      pilotSlug: row.pilot.slug,
      firstName: row.pilot.firstName,
      lastName: row.pilot.lastName,
      identityKey,
      seriesSlug,
      indexSum: 0,
      placeSum: 0,
      count: 0,
    };
    bucket.indexSum += row.indexPoints!;
    bucket.placeSum += place;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.values()].map((bucket) => ({
    pilotId: bucket.pilotId,
    pilotSlug: bucket.pilotSlug,
    firstName: bucket.firstName,
    lastName: bucket.lastName,
    identityKey: bucket.identityKey,
    seriesSlug: bucket.seriesSlug,
    avgIndexPoints: bucket.indexSum / bucket.count,
    avgPlace: bucket.placeSum / bucket.count,
    eventCount: bucket.count,
  }));
}

function roundPlace(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Prestige overlap via career mean indexPoints per series.
 * For target series X: P = S_X − S_Y; prestige hardness = −mean(P) across all pairs.
 */
export function computeIndexPointsHardnessScores(
  averages: PilotSeriesIndexAverage[],
  seriesSlugs: string[],
): {
  hardness: Map<string, number>;
  samples: Map<string, number>;
  contributions: OverlapContribution[];
  contributionsBySeries: Map<string, OverlapContribution[]>;
  overlapPilotCount: number;
} {
  const hardness = new Map<string, number>();
  const samples = new Map<string, number>();
  const sumP = new Map<string, number>();
  const contributionsBySeries = new Map<string, OverlapContribution[]>();
  for (const slug of seriesSlugs) {
    hardness.set(slug, 0);
    samples.set(slug, 0);
    sumP.set(slug, 0);
    contributionsBySeries.set(slug, []);
  }

  const contributions: OverlapContribution[] = [];

  const byPilot = new Map<string, PilotSeriesIndexAverage[]>();
  for (const row of averages) {
    const key = overlapGroupKey(row);
    const group = byPilot.get(key) ?? [];
    group.push(row);
    byPilot.set(key, group);
  }

  const overlapPilotCount = [...byPilot.values()].filter((group) => {
    const uniqueSeries = new Set(group.map((row) => row.seriesSlug));
    return uniqueSeries.size >= 2;
  }).length;

  for (const group of byPilot.values()) {
    const seriesSlugsForPilot = [...new Set(group.map((row) => row.seriesSlug))];
    if (seriesSlugsForPilot.length < 2) continue;

    for (const targetSlug of seriesSlugsForPilot) {
      const targetRow = group.find((row) => row.seriesSlug === targetSlug);
      if (!targetRow) continue;

      for (const otherSlug of seriesSlugsForPilot) {
        if (otherSlug === targetSlug) continue;
        const otherRow = group.find((row) => row.seriesSlug === otherSlug);
        if (!otherRow) continue;

        const delta = targetRow.avgIndexPoints - otherRow.avgIndexPoints;
        const roundedDelta = Math.round(delta * 100) / 100;

        sumP.set(targetSlug, (sumP.get(targetSlug) ?? 0) + delta);
        samples.set(targetSlug, (samples.get(targetSlug) ?? 0) + 1);

        const contribution: OverlapContribution = {
          pilotSlug: targetRow.pilotSlug,
          firstName: targetRow.firstName,
          lastName: targetRow.lastName,
          targetSeriesSlug: targetSlug,
          otherSeriesSlug: otherSlug,
          avgPlaceTarget: roundPlace(targetRow.avgPlace),
          avgPlaceOther: roundPlace(otherRow.avgPlace),
          delta: roundedDelta,
        };

        contributions.push(contribution);
        contributionsBySeries.get(targetSlug)!.push(contribution);
      }
    }
  }

  for (const slug of seriesSlugs) {
    const n = samples.get(slug) ?? 0;
    if (n > 0) {
      const meanP = (sumP.get(slug) ?? 0) / n;
      hardness.set(slug, Math.round(-meanP * 100) / 100);
    }
  }

  for (const list of contributionsBySeries.values()) {
    list.sort((a, b) => b.delta - a.delta || a.lastName.localeCompare(b.lastName));
  }

  contributions.sort((a, b) => b.delta - a.delta || a.lastName.localeCompare(b.lastName));

  return { hardness, samples, contributions, contributionsBySeries, overlapPilotCount };
}

export function buildPrestigeRanking(
  seriesList: Array<{ slug: string; nameEn: string; nameRu: string; featuredOrder: number | null }>,
  indexAverages: PilotSeriesIndexAverage[],
): PrestigeRankingResult {
  const featured = seriesList
    .filter((s) => s.featuredOrder != null)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const slugs = featured.map((s) => s.slug);
  const totalSeries = slugs.length;
  const { hardness, samples, contributionsBySeries, overlapPilotCount } =
    computeIndexPointsHardnessScores(indexAverages, slugs);

  const ranked = featured.map((series) => ({
    ...series,
    hardnessScore: hardness.get(series.slug) ?? 0,
    overlapSamples: samples.get(series.slug) ?? 0,
  }));

  const withData = ranked.filter((series) => series.overlapSamples > 0);
  const withoutData = ranked.filter((series) => series.overlapSamples === 0);

  withData.sort((a, b) => {
    if (b.hardnessScore !== a.hardnessScore) return b.hardnessScore - a.hardnessScore;
    return a.slug.localeCompare(b.slug);
  });
  withoutData.sort(
    (a, b) => a.nameEn.localeCompare(b.nameEn) || a.slug.localeCompare(b.slug),
  );

  const entries: SeriesPrestigeEntry[] = [...withData, ...withoutData].map((series, index) => {
    return {
      slug: series.slug,
      nameEn: series.nameEn,
      nameRu: series.nameRu,
      effectiveOrder: index + 1,
      coefficient: seriesCoefficient(index + 1, totalSeries),
      hardnessScore: series.hardnessScore,
      overlapSamples: series.overlapSamples,
      contributions: contributionsBySeries.get(series.slug) ?? [],
    };
  });

  const orderBySlug = new Map(entries.map((e) => [e.slug, e.effectiveOrder]));

  const source: 'overlap' | 'insufficient' = withData.length > 0 ? 'overlap' : 'insufficient';

  return {
    totalSeries,
    overlapGroups: overlapPilotCount,
    historyYears: 0,
    historyFromYear: null,
    historyToYear: null,
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

  const indexAverages = await loadPilotSeriesIndexAverages(prisma);

  return buildPrestigeRanking(seriesList, indexAverages);
}

/** Persist overlap-based prestige for a year (end-of-season job). */
export async function persistPrestigeRanking(prisma: PrismaClient, year: number): Promise<PrestigeRankingResult> {
  const seriesList = await prisma.series.findMany({
    where: { featuredOrder: { not: null } },
    orderBy: { featuredOrder: 'asc' },
  });
  const indexAverages = await loadPilotSeriesIndexAverages(prisma);
  const result = buildPrestigeRanking(seriesList, indexAverages);

  for (const entry of result.entries) {
    const series = await prisma.series.findUnique({ where: { slug: entry.slug } });
    if (!series) continue;

    const order = entry.effectiveOrder;
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
