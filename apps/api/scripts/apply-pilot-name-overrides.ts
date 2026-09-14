import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PILOT_NAME_OVERRIDES } from '../src/data/pilot-name-overrides.js';

const prisma = new PrismaClient();

async function main() {
  let updated = 0;
  for (const [slug, names] of Object.entries(PILOT_NAME_OVERRIDES)) {
    const result = await prisma.pilot.updateMany({
      where: { slug },
      data: { firstName: names.firstName, lastName: names.lastName },
    });
    updated += result.count;
  }
  console.log(`Pilot name overrides applied: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
