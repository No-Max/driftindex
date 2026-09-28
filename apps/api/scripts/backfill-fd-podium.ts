import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchFormulaDriftSeason } from '../src/importers/formula-drift.js';
const prisma = new PrismaClient();
const SERIES_SLUG = 'formula-drift-pro';

function parseYears(): number[] {
  const args = process.argv.slice(2).filter((arg) => /^\d{4}$/.test(arg));
  if (args.length > 0) return args.map((arg) => Number.parseInt(arg, 10));
  const from = 2007;
  const to = new Date().getFullYear();
  const years: number[] = [];
  for (let year = to; year >= from; year -= 1) years.push(year);
  return years;
}

async function main() {
  const years = parseYears();
  let updated = 0;

  for (const year of years) {
    const season = await prisma.season.findFirst({
      where: { year, series: { slug: SERIES_SLUG } },
      include: { events: true },
    });
    if (!season) continue;

    const data = await fetchFormulaDriftSeason(year);
    const eventByRound = new Map(season.events.map((event) => [event.roundNumber, event]));

    for (const pilot of data.pilots) {
      const pilotRecord = await prisma.pilot.findFirst({ where: { slug: pilot.slug } });
      if (!pilotRecord) continue;

      for (const stage of pilot.stages) {
        if (stage.tandemPosition == null || stage.tandemPosition > 3) continue;
        const event = eventByRound.get(stage.roundNumber);
        if (!event) continue;

        const existing = await prisma.eventResult.findUnique({
          where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        });
        if (!existing) continue;
        if (existing.tandemPosition === stage.tandemPosition) continue;

        await prisma.eventResult.update({
          where: { id: existing.id },
          data: { tandemPosition: stage.tandemPosition },
        });
        updated += 1;
      }
    }

    console.log(`Formula Drift PRO ${year}: podium rows synced`);
  }

  console.log(`Updated ${updated} tandem podium rows (P1–P3).`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
