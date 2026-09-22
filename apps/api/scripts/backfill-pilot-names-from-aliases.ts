import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { pilotNameFieldsForUpsert } from '../src/lib/pilotNames.js';
import { newestSeriesAliasNameByPilotIds } from '../src/lib/pilotSeriesAlias.js';
import { toEnglishPilotNames } from '../src/lib/transliterate.js';

async function main() {
  const pilots = await prisma.pilot.findMany({
    where: { firstName: '', lastName: '' },
    select: { id: true, slug: true },
  });

  const aliasByPilotId = await newestSeriesAliasNameByPilotIds(
    prisma,
    pilots.map((pilot) => pilot.id),
  );

  let updated = 0;
  let skippedNoAlias = 0;

  for (const pilot of pilots) {
    const alias = aliasByPilotId.get(pilot.id);
    if (!alias?.trim()) {
      skippedNoAlias++;
      continue;
    }

    const names = toEnglishPilotNames({ firstName: '', lastName: '', nameAlias: alias });
    const fields = pilotNameFieldsForUpsert(names);
    if (!fields.firstName && !fields.lastName) continue;

    await prisma.pilot.update({
      where: { id: pilot.id },
      data: fields,
    });
    updated++;
  }

  console.log(
    JSON.stringify(
      {
        emptyBefore: pilots.length,
        updated,
        skippedNoAlias,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
