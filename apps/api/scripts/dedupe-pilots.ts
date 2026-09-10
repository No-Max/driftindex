import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { dedupePilotsByTransliteration } from '../src/lib/pilotMatch.js';

const prisma = new PrismaClient();

async function main() {
  const report = await dedupePilotsByTransliteration(prisma);

  console.log(`Merged ${report.merged.length} duplicate pilot record(s).`);
  for (const entry of report.merged) {
    console.log(`  ${entry.from} → ${entry.to} [${entry.nameKey}]`);
  }

  if (report.reviewSuggested.length > 0) {
    console.log(`\nReview suggested for ${report.reviewSuggested.length} merge(s) with different car numbers:`);
    for (const entry of report.reviewSuggested) {
      console.log(`  [${entry.nameKey}] ${entry.reason}`);
      console.log(`    ${entry.slugs.join(', ')}`);
    }
  }

  console.log(`\nNormalized English names on ${report.normalized} pilot(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
