import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FEATURED = [
  { slug: 'formula-drift-pro', name: 'Formula Drift Pro', shortName: 'FD Pro', country: 'US', order: 1, weight: 1.0 },
  { slug: 'drift-masters', name: 'Drift Masters', shortName: 'DM', country: 'EU', order: 2, weight: 1.15 },
  { slug: 'd1gp', name: 'D1 Grand Prix', shortName: 'D1GP', country: 'JP', order: 3, weight: 1.1 },
  { slug: 'rds-gp', name: 'Russian Drift Series GP', shortName: 'RDS GP', country: 'RU', order: 4, weight: 0.95 },
  { slug: 'royal-ds', name: 'Royal Drift Series', shortName: 'Royal DS', country: 'CN', order: 5, weight: 0.9 },
] as const;

/** Kept for imports and pilot history; not shown in prestige / home / P4P. */
const CATALOG_ONLY = [
  { slug: 'drift-kings', name: 'Drift Kings', shortName: 'DK', country: 'INT', weight: 0.85 },
] as const;

type CatalogSeries = (typeof FEATURED)[number] | (typeof CATALOG_ONLY)[number];

async function upsertSeriesCatalog(year: number, catalog: readonly CatalogSeries[]) {
  for (const s of catalog) {
    const featuredOrder = 'order' in s ? s.order : null;
    const row = await prisma.series.upsert({
      where: { slug: s.slug },
      update: { name: s.name, shortName: s.shortName, featuredOrder, defaultWeight: s.weight },
      create: {
        slug: s.slug,
        name: s.name,
        shortName: s.shortName,
        country: s.country,
        featuredOrder,
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
  await upsertSeriesCatalog(year, FEATURED);
  await upsertSeriesCatalog(year, CATALOG_ONLY);

  console.log(
    `Seed complete: ${FEATURED.length} featured + ${CATALOG_ONLY.length} catalog-only series. ` +
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
