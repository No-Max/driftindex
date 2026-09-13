import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FEATURED = [
  { slug: 'formula-drift-pro', name: 'Formula Drift PRO', shortName: 'FD PRO', country: 'US', order: 1, weight: 1.0 },
  { slug: 'drift-masters', name: 'Drift Masters', shortName: 'DM', country: 'EU', order: 2, weight: 1.15 },
  { slug: 'd1gp', name: 'D1 Grand Prix', shortName: 'D1GP', country: 'JP', order: 3, weight: 1.1 },
  { slug: 'rds-gp', name: 'RDS GP', shortName: 'RDS GP', country: 'RU', order: 4, weight: 0.95 },
  { slug: 'royal-ds', name: 'Royal Drift Series', shortName: 'RDS', country: 'CN', order: 5, weight: 0.9 },
  { slug: 'drift-kings', name: 'Drift Kings', shortName: 'DK', country: 'INT', order: 6, weight: 0.85 },
] as const;

async function upsertSeriesCatalog(year: number) {
  for (const s of FEATURED) {
    const row = await prisma.series.upsert({
      where: { slug: s.slug },
      update: { name: s.name, shortName: s.shortName, featuredOrder: s.order, defaultWeight: s.weight },
      create: {
        slug: s.slug,
        name: s.name,
        shortName: s.shortName,
        country: s.country,
        featuredOrder: s.order,
        defaultWeight: s.weight,
      },
    });

    await prisma.seriesName.upsert({
      where: {
        seriesId_name: {
          seriesId: row.id,
          name: s.name,
        },
      },
      update: { shortName: s.shortName },
      create: {
        seriesId: row.id,
        name: s.name,
        shortName: s.shortName,
      },
    });

    await prisma.seriesWeight.upsert({
      where: { seriesId_year: { seriesId: row.id, year } },
      update: { weight: s.weight },
      create: { seriesId: row.id, year, weight: s.weight },
    });
  }
}

async function main() {
  const year = new Date().getFullYear();
  await upsertSeriesCatalog(year);

  console.log(
    `Seed complete: ${FEATURED.length} featured series catalog entries. ` +
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
