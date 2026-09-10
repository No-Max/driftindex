import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FEATURED = [
  { slug: 'formula-drift-pro', nameEn: 'Formula Drift PRO', nameRu: 'Formula Drift PRO', country: 'US', order: 1, weight: 1.0 },
  { slug: 'drift-masters', nameEn: 'Drift Masters', nameRu: 'Drift Masters', country: 'EU', order: 2, weight: 1.15 },
  { slug: 'd1gp', nameEn: 'D1 Grand Prix', nameRu: 'D1 Grand Prix', country: 'JP', order: 3, weight: 1.1 },
  { slug: 'rds-gp', nameEn: 'RDS GP', nameRu: 'RDS GP', country: 'RU', order: 4, weight: 0.95 },
  { slug: 'royal-ds', nameEn: 'Royal Drift Series', nameRu: 'Royal Drift Series', country: 'CN', order: 5, weight: 0.9 },
  { slug: 'drift-kings', nameEn: 'Drift Kings', nameRu: 'Drift Kings', country: 'INT', order: 6, weight: 0.85 },
] as const;

const REAL_DATA_SERIES = ['royal-ds', 'drift-masters'] as const;

async function upsertSeriesCatalog(year: number) {
  for (const s of FEATURED) {
    const row = await prisma.series.upsert({
      where: { slug: s.slug },
      update: { featuredOrder: s.order, defaultWeight: s.weight },
      create: {
        slug: s.slug,
        nameEn: s.nameEn,
        nameRu: s.nameRu,
        country: s.country,
        featuredOrder: s.order,
        defaultWeight: s.weight,
      },
    });

    await prisma.seriesWeight.upsert({
      where: { seriesId_year: { seriesId: row.id, year } },
      update: { weight: s.weight },
      create: { seriesId: row.id, year, weight: s.weight },
    });
  }
}

/** Remove placeholder seasons/events and pilots not tied to imported data. */
async function removeMockData() {
  const realSeries = await prisma.series.findMany({
    where: { slug: { in: [...REAL_DATA_SERIES] } },
    select: { id: true },
  });
  const realSeriesIds = realSeries.map((s) => s.id);

  const removedSeasons = await prisma.season.deleteMany({
    where: { seriesId: { notIn: realSeriesIds } },
  });

  const pilotIdsWithResults = (
    await prisma.eventResult.findMany({
      select: { pilotId: true },
      distinct: ['pilotId'],
    })
  ).map((row) => row.pilotId);

  const removedPilots = await prisma.pilot.deleteMany({
    where: pilotIdsWithResults.length
      ? { id: { notIn: pilotIdsWithResults } }
      : {},
  });

  const removedTeams = await prisma.team.deleteMany({
    where: { results: { none: {} } },
  });

  return { removedSeasons: removedSeasons.count, removedPilots: removedPilots.count, removedTeams: removedTeams.count };
}

async function main() {
  const year = new Date().getFullYear();
  await upsertSeriesCatalog(year);
  const cleanup = await removeMockData();

  console.log(
    `Seed complete: ${FEATURED.length} featured series (catalog only). ` +
      `Removed ${cleanup.removedSeasons} mock seasons, ${cleanup.removedPilots} orphan pilots, ${cleanup.removedTeams} orphan teams. ` +
      `Import real data with: npm run db:import:royal-ds`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
