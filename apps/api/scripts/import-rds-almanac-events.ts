import 'dotenv/config';
import type { Event, PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientCtor } from '@prisma/client';
import {
  almanacEventIdFromDbSlug,
  almanacPilotDbSlug,
  buildAlmanacToDbEventMapping,
  fetchAlmanacRdsEventDetails,
  pilotNamesFromAlmanacRow,
} from '../src/importers/almanac-rds-event.js';
import { listAlmanacRdsEvents } from '../src/importers/rds-almanac.js';
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

async function applyAlmanacEventDetails(
  db: PrismaClient,
  seriesId: string,
  event: Event,
  almanacEventId: string,
): Promise<number> {
  const details = await fetchAlmanacRdsEventDetails(almanacEventId);
  if (!details || (details.qualification.length === 0 && details.results.length === 0)) {
    return 0;
  }

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

  let upserts = 0;
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

    const almanacQualScore100 = toQualScore100(stats.qualScore100, SERIES_SLUG);
    const qualScore100 =
      almanacQualScore100 != null &&
      (existing?.qualScore100 == null || almanacQualScore100 >= 70 || existing.qualScore100 < 70)
        ? almanacQualScore100
        : (existing?.qualScore100 ?? almanacQualScore100);

    await db.eventResult.upsert({
      where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
      update: {
        qualPosition: stats.qualPosition ?? existing?.qualPosition ?? null,
        qualScore100,
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
    `  Round ${event.roundNumber} (Almanac ${almanacEventId}): ${details.qualification.length} qual, ${details.results.length} results → ${byAlmanacSlug.size} pilots`,
  );

  return upserts;
}

async function importSeasonEventDetails(db: PrismaClient, seriesId: string, seasonYear: number) {
  const season = await db.season.findUnique({
    where: { seriesId_year: { seriesId, year: seasonYear } },
    include: {
      events: {
        orderBy: { roundNumber: 'asc' },
        include: {
          results: {
            include: {
              pilot: {
                include: {
                  seriesAliases: { where: { seriesId }, select: { name: true } },
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
    return { upserts: 0, events: 0 };
  }

  console.log(`\n=== RDS GP ${seasonYear} event pages (Drift Almanac) ===`);

  const almanacMetas = await listAlmanacRdsEvents(seasonYear);
  if (almanacMetas.length === 0) {
    console.log(`No Drift Almanac events for ${seasonYear}`);
    return { upserts: 0, events: 0 };
  }

  const needsMapping = season.events.some((event) => !almanacEventIdFromDbSlug(event.slug));
  const mapping = needsMapping
    ? await buildAlmanacToDbEventMapping(seasonYear, season.events)
    : new Map<string, string>();

  if (needsMapping && mapping.size > 0) {
    const summary = [...mapping.entries()]
      .map(([almanacId, dbEventId]) => {
        const round = season.events.find((event) => event.id === dbEventId)?.roundNumber;
        return `${almanacId}→R${round ?? '?'}`;
      })
      .join(', ');
    console.log(`  Matched Almanac events to DB: ${summary}`);
  }

  let upserts = 0;
  let eventsProcessed = 0;

  for (const meta of almanacMetas) {
    const daSlug = `da-e${meta.almanacEventId}`;
    let event = season.events.find((entry) => entry.slug === daSlug);
    if (!event) {
      const dbEventId = mapping.get(meta.almanacEventId);
      event = dbEventId ? season.events.find((entry) => entry.id === dbEventId) : undefined;
    }
    if (!event) {
      console.warn(`  Almanac event ${meta.almanacEventId}: no matching DB event`);
      continue;
    }

    const count = await applyAlmanacEventDetails(db, seriesId, event, meta.almanacEventId);
    if (count > 0) {
      eventsProcessed += 1;
      upserts += count;
    }
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
