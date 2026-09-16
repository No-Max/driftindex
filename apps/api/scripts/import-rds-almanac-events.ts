import 'dotenv/config';
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientCtor } from '@prisma/client';
import {
  almanacEventIdFromDbSlug,
  almanacPilotDbSlug,
  fetchAlmanacRdsEventDetails,
  pilotNamesFromAlmanacRow,
} from '../src/importers/almanac-rds-event.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { upsertPilotSeriesAlias } from '../src/lib/pilotSeriesAlias.js';
import { toQualScore100 } from '../src/lib/qualScore.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';

const prisma = new PrismaClientCtor();
const SERIES_SLUG = 'rds-gp';

function parseYears(): number[] | 'all' {
  if (process.argv.includes('--all')) return 'all';

  const yearFlagIndex = process.argv.indexOf('--year');
  const yearArgs =
    yearFlagIndex !== -1
      ? process.argv.slice(yearFlagIndex + 1).filter((arg) => /^\d{4}$/.test(arg))
      : process.argv.filter((arg) => /^\d{4}$/.test(arg));

  if (yearArgs.length === 0) {
    throw new Error('Pass --year YYYY or --all');
  }

  return yearArgs.map((arg) => Number.parseInt(arg, 10));
}

async function resolvePilotSlug(
  db: PrismaClient,
  almanacPilotSlug: string,
  nameAlias: string,
  seriesId: string,
): Promise<string> {
  const slug = almanacPilotDbSlug(almanacPilotSlug);
  const { firstName, lastName } = pilotNamesFromAlmanacRow(nameAlias);
  const match = await findMatchingPilot(
    db,
    { slug, nameAlias, firstName, lastName, number: null },
    { excludeSlugPrefix: 'da-', seriesId },
  );
  return match?.slug ?? slug;
}

async function importSeasonEventDetails(db: PrismaClient, seriesId: string, seasonYear: number) {
  const season = await db.season.findUnique({
    where: { seriesId_year: { seriesId, year: seasonYear } },
    include: {
      events: { orderBy: { roundNumber: 'asc' } },
    },
  });

  if (!season) {
    console.log(`Skipped ${seasonYear}: season not in DB`);
    return { upserts: 0, events: 0 };
  }

  console.log(`\n=== RDS GP ${seasonYear} event pages (Drift Almanac) ===`);

  let upserts = 0;
  let eventsProcessed = 0;

  for (const event of season.events) {
    const almanacEventId = almanacEventIdFromDbSlug(event.slug);
    if (!almanacEventId) {
      console.warn(`  Round ${event.roundNumber}: slug ${event.slug} is not da-e* — skipped`);
      continue;
    }

    const details = await fetchAlmanacRdsEventDetails(almanacEventId);
    if (!details || (details.qualification.length === 0 && details.results.length === 0)) {
      console.warn(`  Round ${event.roundNumber}: no qual/results on Almanac`);
      continue;
    }

    eventsProcessed += 1;

    const byAlmanacSlug = new Map<
      string,
      {
        nameAlias: string;
        qualPosition: number | null;
        qualScore100: number | null;
        tandemPosition: number | null;
        points: number | null;
      }
    >();

    for (const row of details.qualification) {
      const entry = byAlmanacSlug.get(row.almanacPilotSlug) ?? {
        nameAlias: row.nameAlias,
        qualPosition: null,
        qualScore100: null,
        tandemPosition: null,
        points: null,
      };
      entry.qualPosition = row.qualPosition;
      entry.qualScore100 = row.qualScore100;
      entry.nameAlias = row.nameAlias;
      byAlmanacSlug.set(row.almanacPilotSlug, entry);
    }

    for (const row of details.results) {
      const entry = byAlmanacSlug.get(row.almanacPilotSlug) ?? {
        nameAlias: row.nameAlias,
        qualPosition: null,
        qualScore100: null,
        tandemPosition: null,
        points: null,
      };
      entry.tandemPosition = row.tandemPosition;
      entry.points = row.points;
      entry.nameAlias = row.nameAlias;
      byAlmanacSlug.set(row.almanacPilotSlug, entry);
    }

    for (const [almanacPilotSlug, stats] of byAlmanacSlug) {
      const pilotSlug = await resolvePilotSlug(db, almanacPilotSlug, stats.nameAlias, seriesId);
      const names = pilotNamesFromAlmanacRow(stats.nameAlias);
      const english = canonicalEnglishNames({
        slug: pilotSlug,
        firstName: names.firstName,
        lastName: names.lastName,
        nameAlias: stats.nameAlias,
        country: null,
        number: null,
        photoSourceUrl: null,
        team: null,
        stages: [],
      });

      const pilotRecord = await db.pilot.upsert({
        where: { slug: pilotSlug },
        update: {
          firstName: english.firstName,
          lastName: english.lastName,
        },
        create: {
          slug: pilotSlug,
          firstName: english.firstName,
          lastName: english.lastName,
        },
      });
      await upsertPilotSeriesAlias(db, {
        pilotId: pilotRecord.id,
        seriesId,
        name: stats.nameAlias,
      });

      const existing = await db.eventResult.findUnique({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
      });

      const qualScore100 = toQualScore100(stats.qualScore100, SERIES_SLUG);

      await db.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        update: {
          qualPosition: stats.qualPosition ?? existing?.qualPosition ?? null,
          qualScore100: qualScore100 ?? existing?.qualScore100 ?? null,
          tandemPosition: stats.tandemPosition ?? existing?.tandemPosition ?? null,
          points: stats.points ?? existing?.points ?? 0,
          dataStatus: 'VERIFIED',
        },
        create: {
          eventId: event.id,
          pilotId: pilotRecord.id,
          number: existing?.number ?? null,
          qualPosition: stats.qualPosition,
          qualPoints: existing?.qualPoints ?? stats.qualPosition,
          qualScore100,
          tandemPosition: stats.tandemPosition,
          points: stats.points ?? 0,
          dataStatus: 'VERIFIED',
        },
      });
      upserts += 1;
    }

    console.log(
      `  Round ${event.roundNumber}: ${details.qualification.length} qual, ${details.results.length} results → ${byAlmanacSlug.size} pilots`,
    );
  }

  if (eventsProcessed > 0) {
    const stageCount = await refreshStageCoefficientsForSeason(db, season.id);
    console.log(`  Refreshed ${stageCount} stage coefficient(s)`);
  }

  return { upserts, events: eventsProcessed };
}

async function main() {
  const yearsArg = parseYears();
  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found`);
  }

  const seasons =
    yearsArg === 'all'
      ? await prisma.season.findMany({
          where: { seriesId: series.id },
          orderBy: { year: 'asc' },
          select: { year: true },
        })
      : yearsArg.map((year) => ({ year }));

  let totalUpserts = 0;
  for (const { year } of seasons) {
    const { upserts } = await importSeasonEventDetails(prisma, series.id, year);
    totalUpserts += upserts;
  }

  console.log(`\nDone: ${totalUpserts} event result row(s) upserted.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
