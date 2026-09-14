import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { SERIES_LOGO_SOURCES } from '../src/data/series-logos.js';
import { mirrorSeriesLogo } from '../src/lib/media/mirror.js';

const prisma = new PrismaClient();

async function main() {
  let mirrored = 0;

  for (const [slug, source] of Object.entries(SERIES_LOGO_SOURCES)) {
    const series = await prisma.series.findUnique({ where: { slug } });
    if (!series) {
      console.warn(`Skip ${slug}: series not in catalog`);
      continue;
    }

    const logo = await mirrorSeriesLogo(slug, source);
    if (!logo.logoUrl) {
      console.warn(`  ${slug}: mirror failed (${source.sourceUrl})`);
      continue;
    }

    await prisma.series.update({
      where: { id: series.id },
      data: { logoUrl: logo.logoUrl },
    });

    mirrored += 1;
    console.log(`  ${slug} → ${logo.logoUrl}`);
  }

  console.log(`\nSeries logos synced: ${mirrored}/${Object.keys(SERIES_LOGO_SOURCES).length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
