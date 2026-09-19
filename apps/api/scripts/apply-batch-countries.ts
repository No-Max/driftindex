import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PILOT_COUNTRY_OVERRIDES } from '../src/data/pilot-country-overrides.js';
import { pilotSlugLookupCandidates } from '../src/lib/pilotSlug.js';

const prisma = new PrismaClient();

async function main() {
  let overrides = 0;
  for (const [slug, country] of Object.entries(PILOT_COUNTRY_OVERRIDES)) {
    const result = await prisma.pilot.updateMany({
      where: { slug: { in: pilotSlugLookupCandidates(slug) } },
      data: { country },
    });
    overrides += result.count;
  }

  const batchRu = await prisma.pilot.updateMany({
    where: { country: null },
    data: { country: 'RU' },
  });

  const withCountry = await prisma.pilot.count({ where: { country: { not: null } } });
  const total = await prisma.pilot.count();
  const missing = total - withCountry;

  console.log(`Overrides refreshed: ${overrides}`);
  console.log(`Batch RU applied: ${batchRu.count}`);
  console.log(`Total with country: ${withCountry}/${total}`);
  if (missing > 0) console.log(`Still missing: ${missing}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
