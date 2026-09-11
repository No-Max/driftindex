import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  fetchFormulaDriftSeason,
  listFormulaDriftSeasons,
  probeFormulaDriftArchiveSeasons,
  type FdPilot,
} from '../src/importers/formula-drift.js';
import { upsertPilotSeriesPhoto } from '../src/lib/media/pilotPhoto.js';
import { findMatchingPilot, mergePilotInto } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'formula-drift-pro';

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

async function resolvePilotSlug(pilot: FdPilot): Promise<{ slug: string; merged: boolean }> {
  const match = await findMatchingPilot(
    prisma,
    {
      slug: pilot.slug,
      nameRu: pilot.nameRu,
      firstName: pilot.firstName,
      lastName: pilot.lastName,
      number: pilot.number,
    },
    { excludeSlugPrefix: 'fd-' },
  );
  const slug = match?.slug ?? pilot.slug;

  if (match && match.slug !== pilot.slug) {
    const stub = await prisma.pilot.findUnique({ where: { slug: pilot.slug } });
    if (stub && stub.id !== match.id) {
      await mergePilotInto(prisma, stub.id, match.id);
    }
  }

  return { slug, merged: slug !== pilot.slug };
}

async function importSeason(year: number, seriesId: string) {
  console.log(`\n=== Formula Drift PRO ${year} ===`);
  const data = await fetchFormulaDriftSeason(year);
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
      nameEn: `Formula Drift PRO ${data.seasonYear}`,
      nameRu: `Formula Drift PRO ${data.seasonYear}`,
      sourceLabelEn: 'Formula Drift — official results',
      sourceLabelRu: 'Formula Drift — официальные результаты',
      sourceUrl: data.sourceUrl,
    },
    create: {
      seriesId,
      year: data.seasonYear,
      nameEn: `Formula Drift PRO ${data.seasonYear}`,
      nameRu: `Formula Drift PRO ${data.seasonYear}`,
      sourceLabelEn: 'Formula Drift — official results',
      sourceLabelRu: 'Formula Drift — официальные результаты',
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
    const { slug: pilotSlug, merged: wasMerged } = await resolvePilotSlug(pilot);
    if (wasMerged) merged++;

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

  const stageCount = await refreshStageCoefficientsForSeason(prisma, season.id);

  console.log(
    `Import complete: ${data.pilots.length} pilots (${merged} merged with existing), ` +
      `${resultCount} results, ${photosMirrored} photos mirrored` +
      `${photosFailed ? `, ${photosFailed} photo failures` : ''}, ${stageCount} stage coefficients`,
  );
}

async function main() {
  if (process.argv.includes('--probe-archives')) {
    const seasons = await probeFormulaDriftArchiveSeasons();
    console.log('Formula Drift PRO archive availability:');
    for (const season of seasons) {
      const status = season.importable
        ? season.api
          ? 'importable (api)'
          : 'importable (archive table)'
        : season.api
          ? 'api only'
          : season.archiveTable
            ? 'archive table only'
            : 'no data';
      console.log(
        `  ${season.year}  ${status}  api=${season.api ? 'yes' : 'no'}  archive=${season.archiveTable ? 'yes' : 'no'}  events=${season.pageEvents}`,
      );
    }
    return;
  }

  if (process.argv.includes('--list-seasons')) {
    const seasons = await listFormulaDriftSeasons();
    console.log('Formula Drift PRO seasons on formulad.com:');
    for (const year of seasons) {
      console.log(`  ${year}`);
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
