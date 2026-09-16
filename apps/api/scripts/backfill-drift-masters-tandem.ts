import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchDriftMastersTandemByRound } from '../src/importers/drift-masters-rawmotion-tandem.js';
import { applyDriftMastersTandemBackfill } from '../src/lib/driftMastersTandemImport.js';
import type { DmPilot } from '../src/importers/drift-masters.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'drift-masters';

function parseYears(): number[] {
  const yearFlagIndex = process.argv.indexOf('--year');
  const yearArgs =
    yearFlagIndex !== -1
      ? process.argv.slice(yearFlagIndex + 1).filter((arg) => /^\d{4}$/.test(arg))
      : process.argv.filter((arg) => /^\d{4}$/.test(arg));
  return yearArgs.map((arg) => Number.parseInt(arg, 10));
}

async function main() {
  const years = parseYears();
  if (years.length === 0) {
    console.error('Usage: backfill-drift-masters-tandem.ts --year 2021 [--year 2022]');
    process.exit(1);
  }

  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) throw new Error(`Series ${SERIES_SLUG} not found`);

  for (const year of years) {
    const season = await prisma.season.findUnique({
      where: { seriesId_year: { seriesId: series.id, year } },
      include: { events: { orderBy: { roundNumber: 'asc' } } },
    });
    if (!season) {
      console.warn(`Season ${year} not found — skip`);
      continue;
    }

    const eventRecords = new Map(season.events.map((event) => [event.slug, { id: event.id }]));
    const roundCount = season.events.length;
    const tandemByRound = await fetchDriftMastersTandemByRound(year, roundCount);
    for (const [roundNumber, rows] of tandemByRound) {
      console.log(`${year}: round ${roundNumber} — ${rows.length} tandem rows from RawMotion`);
    }

    const resultRows = await prisma.eventResult.findMany({
      where: { event: { seasonId: season.id } },
      include: {
        pilot: { select: { slug: true, firstName: true, lastName: true } },
        event: { select: { roundNumber: true } },
      },
    });

    const pilotsBySlug = new Map<string, DmPilot>();
    for (const row of resultRows) {
      if (pilotsBySlug.has(row.pilot.slug)) continue;
      pilotsBySlug.set(row.pilot.slug, {
        slug: row.pilot.slug,
        firstName: row.pilot.firstName,
        lastName: row.pilot.lastName,
        nameAlias: `${row.pilot.firstName} ${row.pilot.lastName}`,
        country: null,
        number: row.number,
        photoSourceUrl: null,
        team: null,
        totalPoints: 0,
        stages: resultRows
          .filter((other) => other.pilot.slug === row.pilot.slug)
          .map((other) => ({
            eventSlug: `dm-r${other.event.roundNumber}`,
            roundNumber: other.event.roundNumber ?? 0,
            qualifyingPosition: other.qualPosition,
            qualifyingPoints: other.qualPoints,
            tandemPosition: other.tandemPosition,
            points: other.points,
          })),
      });
    }

    const pilotRecordsBySlug = new Map(
      [...pilotsBySlug.keys()].map((slug) => {
        const pilotId = resultRows.find((row) => row.pilot.slug === slug)!.pilotId;
        return [slug, { id: pilotId }] as const;
      }),
    );

    const { tandemMatched } = await applyDriftMastersTandemBackfill(prisma, {
      seriesId: series.id,
      pilots: [...pilotsBySlug.values()],
      tandemByRound,
      eventRecords,
      pilotRecordsBySlug,
      resolvePilotSlug: async (pilot) => pilot.slug,
    });

    console.log(`${year}: updated ${tandemMatched} tandem positions`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
