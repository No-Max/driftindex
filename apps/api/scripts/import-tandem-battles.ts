import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  aggregatePilotBattles,
  fetchAlmanacSeasonBattles,
} from '../src/importers/almanac-battles.js';
import { matchBattlePilot } from '../src/lib/battleMatch.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'rds-gp';

function parseYears(): number[] | 'all' {
  if (process.argv.includes('--all')) return 'all';

  const yearFlagIndex = process.argv.indexOf('--year');
  const yearArgs =
    yearFlagIndex !== -1
      ? process.argv.slice(yearFlagIndex + 1).filter((arg) => /^\d{4}$/.test(arg))
      : process.argv.filter((arg) => /^\d{4}$/.test(arg));

  return yearArgs.map((arg) => Number.parseInt(arg, 10));
}

async function importSeasonBattles(seriesId: string, seasonYear: number): Promise<number> {
  const season = await prisma.season.findUnique({
    where: { seriesId_year: { seriesId, year: seasonYear } },
    include: {
      events: {
        orderBy: { roundNumber: 'asc' },
        include: {
          results: {
            include: {
              pilot: {
                select: {
                  id: true,
                  number: true,
                  firstName: true,
                  lastName: true,
                  seriesAliases: {
                    where: { seriesId },
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!season) {
    console.log(`Skipped ${seasonYear}: season not in DB`);
    return 0;
  }

  console.log(`\n=== RDS GP ${seasonYear} tandem battles (Drift Almanac) ===`);

  await prisma.eventResult.updateMany({
    where: { event: { seasonId: season.id } },
    data: { tandemBattles: null, tandemWins: null },
  });

  const almanacEvents = await fetchAlmanacSeasonBattles(seasonYear);
  if (almanacEvents.length === 0) {
    console.log(`No battle data on Drift Almanac for ${seasonYear}`);
    return 0;
  }

  let updated = 0;
  for (const almanacEvent of almanacEvents) {
    const event = season.events.find((entry) => entry.roundNumber === almanacEvent.roundNumber);
    if (!event) {
      console.warn(`  Round ${almanacEvent.roundNumber}: no matching event in DB`);
      continue;
    }

    const participants = event.results.map((result) => ({
      ...result.pilot,
      number: result.number ?? result.pilot.number,
    }));
    const qualPositionByPilotId = new Map(
      event.results.map((result) => [result.pilotId, result.qualPosition]),
    );
    const totals = aggregatePilotBattles(almanacEvent.duels);

    for (const [, stats] of totals) {
      const pilot = matchBattlePilot(
        { name: stats.name, number: stats.number },
        participants,
        { qualPositionByPilotId },
      );
      if (!pilot) {
        console.warn(`  Round ${event.roundNumber}: unmatched pilot «${stats.name}» (#${stats.number ?? '?'})`);
        continue;
      }

      const result = event.results.find((entry) => entry.pilotId === pilot.id);
      if (!result) continue;

      await prisma.eventResult.update({
        where: { id: result.id },
        data: {
          tandemBattles: stats.battles,
          tandemWins: stats.wins,
        },
      });
      updated += 1;
    }

    console.log(`  Round ${event.roundNumber}: ${almanacEvent.duels.length} duels → ${totals.size} pilots`);
  }

  return updated;
}

async function main() {
  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found`);
  }

  const yearsArg = parseYears();
  const seasons =
    yearsArg === 'all'
      ? await prisma.season.findMany({
          where: { seriesId: series.id },
          orderBy: { year: 'asc' },
          select: { year: true },
        })
      : yearsArg.map((year) => ({ year }));

  let totalUpdated = 0;
  for (const { year } of seasons) {
    totalUpdated += await importSeasonBattles(series.id, year);
  }

  console.log(`\nDone: updated ${totalUpdated} event result row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
