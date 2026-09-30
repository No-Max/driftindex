import type { PrismaClient } from '@prisma/client';
import type { P4PInputSeries } from './p4p.js';
import type { SeasonEventWithSeries } from './p4pSeasonEvents.js';
import {
  buildPointsPlaceByEventId,
  computeSeasonP4PMetrics,
  type SeasonEventWithResults,
} from './standings.js';

export interface P4PInputsLoadResult {
  inputs: P4PInputSeries[];
  pointsPlaceByEventId: Map<string, Map<string, number>>;
  /** Finished/upcoming featured-series events with series metadata attached. */
  seasonEvents: SeasonEventWithSeries[];
}

export async function loadP4PInputs(
  prisma: PrismaClient,
  year: number,
  hardnessBySlug: Map<string, number>,
): Promise<P4PInputsLoadResult> {
  const featuredSeries = await prisma.series.findMany({
    where: { featuredOrder: { not: null } },
    orderBy: { featuredOrder: 'asc' },
    include: {
      seasons: {
        where: { year },
        include: {
          events: {
            orderBy: { roundNumber: 'asc' },
            include: {
              results: { include: { pilot: true } },
            },
          },
        },
      },
    },
  });

  const inputs: P4PInputSeries[] = [];
  const seasonEvents: SeasonEventWithSeries[] = [];

  for (const series of featuredSeries) {
    const season = series.seasons[0];
    if (!season) continue;

    const seriesHardness = hardnessBySlug.get(series.slug);
    if (seriesHardness == null) continue;

    const seriesMeta = {
      slug: series.slug,
      name: series.name,
      shortName: series.shortName,
    };
    for (const event of season.events as SeasonEventWithResults[]) {
      seasonEvents.push({ ...event, series: seriesMeta });
    }
    const metrics = computeSeasonP4PMetrics(season.events);
    inputs.push({
      slug: series.slug,
      name: series.name,
      shortName: series.shortName,
      logoUrl: series.logoUrl,
      seriesHardness,
      standings: metrics.map((row) => ({
        avgPlace: row.avgPlace,
        avgQualScore: row.avgQualScore ?? 90,
        pilot: row.pilot,
      })),
    });
  }

  return {
    inputs,
    pointsPlaceByEventId: buildPointsPlaceByEventId(seasonEvents),
    seasonEvents,
  };
}
