import 'dotenv/config';
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientCtor } from '@prisma/client';
import {
  fetchRdsAlmanacSeason,
  RDS_ALMANAC_SEASONS,
} from '../src/importers/rds-almanac.js';
import type { RdsGpPilot, RdsGpSeasonData } from '../src/importers/rds-gp.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';

const prisma = new PrismaClientCtor();
const SERIES_SLUG = 'rds-gp';

function parseYears(): number[] {
  if (process.argv.includes('--list-seasons')) return [];

  const all = process.argv.includes('--all');
  if (all) return [...RDS_ALMANAC_SEASONS];

  const yearFlagIndex = process.argv.indexOf('--year');
  const yearArgs =
    yearFlagIndex !== -1
      ? process.argv.slice(yearFlagIndex + 1).filter((arg) => /^\d{4}$/.test(arg))
      : process.argv.filter((arg) => /^\d{4}$/.test(arg));

  if (yearArgs.length > 0) {
    return yearArgs.map((arg) => Number.parseInt(arg, 10));
  }

  return [...RDS_ALMANAC_SEASONS];
}

async function upsertSeason(db: PrismaClient, seriesId: string, data: RdsGpSeasonData) {
  let season = await db.season.findUnique({
    where: { seriesId_year: { seriesId, year: data.seasonYear } },
  });

  if (season) {
    await db.event.deleteMany({ where: { seasonId: season.id } });
    console.log('Cleared previous season events');
  }

  return db.season.upsert({
    where: { seriesId_year: { seriesId, year: data.seasonYear } },
    update: {
      nameEn: `RDS GP ${data.seasonYear}`,
      nameRu: `RDS GP ${data.seasonYear}`,
      sourceLabelEn: 'Drift Almanac — RDS GP results',
      sourceLabelRu: 'Альманах дрифта — результаты RDS GP',
      sourceUrl: data.sourceUrl,
    },
    create: {
      seriesId,
      year: data.seasonYear,
      nameEn: `RDS GP ${data.seasonYear}`,
      nameRu: `RDS GP ${data.seasonYear}`,
      sourceLabelEn: 'Drift Almanac — RDS GP results',
      sourceLabelRu: 'Альманах дрифта — результаты RDS GP',
      sourceUrl: data.sourceUrl,
    },
  });
}

async function resolvePilotSlug(db: PrismaClient, pilot: RdsGpPilot): Promise<string> {
  const match = await findMatchingPilot(
    db,
    {
      slug: pilot.slug,
      nameRu: pilot.nameRu,
      firstName: pilot.firstName,
      lastName: pilot.lastName,
      number: pilot.number,
    },
    { excludeSlugPrefix: 'da-' },
  );
  return match?.slug ?? pilot.slug;
}

async function importSeason(db: PrismaClient, seriesId: string, year: number) {
  console.log(`\n=== RDS GP ${year} (Drift Almanac) ===`);
  const data = await fetchRdsAlmanacSeason(year);
  console.log(
    `Loaded ${data.pilots.length} pilots, ${data.events.length} events ` +
      `(${data.events.filter((event) => event.status === 'FINISHED').length} finished)`,
  );

  if (data.pilots.length === 0) {
    console.log(`Skipped ${year}: no standings rows`);
    return false;
  }

  const season = await upsertSeason(db, seriesId, data);
  const eventRecords = new Map<string, { id: string }>();

  for (const event of data.events) {
    const record = await db.event.upsert({
      where: { seasonId_slug: { seasonId: season.id, slug: event.slug } },
      update: {
        roundNumber: event.roundNumber,
        nameEn: event.nameEn,
        nameRu: event.nameRu,
        trackEn: event.trackEn,
        trackRu: event.trackRu,
        startsAt: new Date(event.startsAt),
        status: event.status,
      },
      create: {
        seasonId: season.id,
        slug: event.slug,
        roundNumber: event.roundNumber,
        nameEn: event.nameEn,
        nameRu: event.nameRu,
        trackEn: event.trackEn,
        trackRu: event.trackRu,
        startsAt: new Date(event.startsAt),
        status: event.status,
      },
    });
    eventRecords.set(event.slug, record);
  }

  let resultCount = 0;
  for (const pilot of data.pilots) {
    const pilotSlug = await resolvePilotSlug(db, pilot);
    const english = canonicalEnglishNames(pilot);
    const pilotRecord = await db.pilot.upsert({
      where: { slug: pilotSlug },
      update: {
        firstName: english.firstName,
        lastName: english.lastName,
        nameRu: pilot.nameRu,
        country: pilot.country,
        number: pilot.number,
      },
      create: {
        slug: pilotSlug,
        firstName: english.firstName,
        lastName: english.lastName,
        nameRu: pilot.nameRu,
        country: pilot.country,
        number: pilot.number,
      },
    });

    for (const stage of pilot.stages) {
      const event = eventRecords.get(stage.eventSlug);
      if (!event) continue;

      await db.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        update: {
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          qualScore100: stage.qualScore100,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          dataStatus: 'VERIFIED',
        },
        create: {
          eventId: event.id,
          pilotId: pilotRecord.id,
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          qualScore100: stage.qualScore100,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          dataStatus: 'VERIFIED',
        },
      });
      resultCount++;
    }
  }

  const stageCount = await refreshStageCoefficientsForSeason(db, season.id);

  console.log(
    `Import complete: ${data.pilots.length} pilots, ${resultCount} event results, ${stageCount} stage coefficients`,
  );
  return true;
}

async function main() {
  if (process.argv.includes('--list-seasons')) {
    console.log(`RDS GP seasons available via Drift Almanac: ${RDS_ALMANAC_SEASONS.join(', ')}`);
    return;
  }

  const years = parseYears();
  const invalid = years.filter(
    (year) => !RDS_ALMANAC_SEASONS.includes(year as (typeof RDS_ALMANAC_SEASONS)[number]),
  );
  if (invalid.length > 0) {
    throw new Error(`Unsupported almanac season(s): ${invalid.join(', ')}`);
  }

  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found — run db:seed first`);
  }

  let imported = 0;
  for (const year of years) {
    if (await importSeason(prisma, series.id, year)) imported++;
  }

  console.log(`\nDone: ${imported}/${years.length} season(s) imported from Drift Almanac.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
