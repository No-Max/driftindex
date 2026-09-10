import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { mergeAlmanacPilotDuplicates } from '../src/lib/pilotMatch.js';

const prisma = new PrismaClient();

async function main() {
  const merged = await mergeAlmanacPilotDuplicates(prisma);
  console.log(`Merged ${merged} almanac pilot duplicate(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
