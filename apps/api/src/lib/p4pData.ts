import type { PrismaClient } from '@prisma/client';
import type { P4PInputSeries } from './p4p.js';
import { computeStandings } from './standings.js';

export async function loadP4PInputs(
  prisma: PrismaClient,
  year: number,
  weightBySlug: Map<string, number>,
): Promise<P4PInputSeries[]> {
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

  for (const series of featuredSeries) {
    const season = series.seasons[0];
    if (!season) continue;

    const seriesWeight = weightBySlug.get(series.slug);
    if (seriesWeight == null || seriesWeight <= 0) continue;

    const standings = computeStandings(season.events);
    inputs.push({
      slug: series.slug,
      nameEn: series.nameEn,
      nameRu: series.nameRu,
      seriesWeight,
      standings: standings.map((row) => ({ rank: row.rank, pilot: row.pilot })),
    });
  }

  return inputs;
}
