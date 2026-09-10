import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  fetchDriftMastersSeason,
  listDriftMastersSeasons,
} from '../src/importers/drift-masters.js';
import type { DmPilot } from '../src/importers/drift-masters.js';
import { upsertPilotSeriesPhoto } from '../src/lib/media/pilotPhoto.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'drift-masters';

function parseYears(): number[] {
  if (process.argv.includes('--list-seasons')) return [];

  const yearFlagIndex = process.argv.indexOf('--year');
  const yearArgs =
    yearFlagIndex !== -1
      ? process.argv.slice(yearFlagIndex + 1).filter((arg) => /^\d{4}$/.test(arg))
      : process.argv.filter((arg) => /^\d{4}$/.test(arg));

  if (yearArgs.length > 0) {
    return yearArgs.map((arg) => Number.parseInt(arg, 10));
  }

  return [new Date().getFullYear()];
}

async function resolvePilotSlug(pilot: DmPilot): Promise<string> {
  const match = await findMatchingPilot(
    prisma,
    {
      slug: pilot.slug,
      nameRu: pilot.nameRu,
      firstName: pilot.firstName,
      lastName: pilot.lastName,
      number: pilot.number,
    },
    { excludeSlugPrefix: 'dm-' },
  );
  return match?.slug ?? pilot.slug;
}

async function importSeason(year: number, seriesId: string) {
  console.log(`\n=== Drift Masters ${year} ===`);
  const data = await fetchDriftMastersSeason(year);
  console.log(`Loaded ${data.pilots.length} pilots, ${data.events.length} events`);

  let season = await prisma.season.findUnique({
    where: { seriesId_year: { seriesId, year: data.seasonYear } },
  });

  if (season) {
    await prisma.event.deleteMany({ where: { seasonId: season.id } });
    console.log('Cleared previous season events');
  }

  season = await prisma.season.upsert({
    where: { seriesId_year: { seriesId, year: data.seasonYear } },
    update: {
      nameEn: `Drift Masters ${data.seasonYear}`,
      nameRu: `Drift Masters ${data.seasonYear}`,
      sourceLabelEn: 'Drift Masters — official results',
      sourceLabelRu: 'Drift Masters — официальные результаты',
      sourceUrl: data.sourceUrl,
    },
    create: {
      seriesId,
      year: data.seasonYear,
      nameEn: `Drift Masters ${data.seasonYear}`,
      nameRu: `Drift Masters ${data.seasonYear}`,
      sourceLabelEn: 'Drift Masters — official results',
      sourceLabelRu: 'Drift Masters — официальные результаты',
      sourceUrl: data.sourceUrl,
    },
  });

  const eventRecords = new Map<string, { id: string }>();
  for (const event of data.events) {
    const record = await prisma.event.upsert({
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
  let photosMirrored = 0;
  let photosFailed = 0;
  let merged = 0;

  for (const pilot of data.pilots) {
    const english = canonicalEnglishNames(pilot);
    const pilotSlug = await resolvePilotSlug(pilot);
    if (pilotSlug !== pilot.slug) merged++;

    const pilotRecord = await prisma.pilot.upsert({
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

    if (pilot.photoSourceUrl) {
      const { mirrored } = await upsertPilotSeriesPhoto(prisma, {
        pilotId: pilotRecord.id,
        seriesId,
        pilotSlug,
        seriesSlug: SERIES_SLUG,
        photoSourceUrl: pilot.photoSourceUrl,
      });
      if (mirrored) photosMirrored++;
      else photosFailed++;
    }

    for (const stage of pilot.stages) {
      const event = eventRecords.get(stage.eventSlug);
      if (!event) continue;

      await prisma.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        update: {
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          dataStatus: 'VERIFIED',
        },
        create: {
          eventId: event.id,
          pilotId: pilotRecord.id,
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          dataStatus: 'VERIFIED',
        },
      });
      resultCount++;
    }
  }

  console.log(
    `Import complete: ${data.pilots.length} pilots (${merged} merged with existing), ` +
      `${resultCount} results, ${photosMirrored} photos mirrored` +
      `${photosFailed ? `, ${photosFailed} photo failures` : ''}`,
  );
}

async function main() {
  if (process.argv.includes('--list-seasons')) {
    const seasons = await listDriftMastersSeasons();
    console.log('Drift Masters seasons on dm.gp:');
    for (const season of seasons) {
      console.log(`  ${season.year}  ${season.slug}  ${season.id}${season.isCurrent ? ' (current)' : ''}`);
    }
    return;
  }

  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found — run db:seed first`);
  }

  for (const year of parseYears()) {
    await importSeason(year, series.id);
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
