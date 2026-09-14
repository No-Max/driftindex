import 'dotenv/config';
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientCtor } from '@prisma/client';
import {
  fetchRdsGpSeason,
  fetchRdsPilotPhotoSourceUrl,
  RDS_GP_SEASONS_WITH_DATA,
  type RdsGpSeasonData,
  rdsPilotIdFromSlug,
} from '../src/importers/rds-gp.js';
import { upsertPilotSeriesPhoto } from '../src/lib/media/pilotPhoto.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { findMatchingPilot, mergePilotInto } from '../src/lib/pilotMatch.js';
import { upsertPilotSeriesAlias } from '../src/lib/pilotSeriesAlias.js';
import { toQualScore100 } from '../src/lib/qualScore.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';
import { findOrCreateTrack } from '../src/lib/track.js';

const prisma = new PrismaClientCtor();
const SERIES_SLUG = 'rds-gp';

interface ImportArgs {
  listSeasons: boolean;
  importAll: boolean;
  years: number[];
  skipPhotos: boolean;
}

function readFlagValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

function parseArgs(): ImportArgs {
  if (process.argv.includes('--list-seasons')) {
    return { listSeasons: true, importAll: false, years: [], skipPhotos: false };
  }

  const skipPhotos = process.argv.includes('--skip-photos');
  const importAll = process.argv.includes('--all');

  const fromYear = Number.parseInt(readFlagValue('--from') ?? '', 10);
  const toYear = Number.parseInt(readFlagValue('--to') ?? '', 10);
  const singleYear = Number.parseInt(readFlagValue('--year') ?? process.argv.find((arg) => /^\d{4}$/.test(arg)) ?? '', 10);

  if (importAll) {
    return { listSeasons: false, importAll: true, years: [...RDS_GP_SEASONS_WITH_DATA], skipPhotos };
  }

  if (Number.isFinite(fromYear) && Number.isFinite(toYear)) {
    const years = RDS_GP_SEASONS_WITH_DATA.filter((year) => year >= fromYear && year <= toYear);
    return { listSeasons: false, importAll: false, years, skipPhotos };
  }

  if (Number.isFinite(singleYear)) {
    return { listSeasons: false, importAll: false, years: [singleYear], skipPhotos };
  }

  return {
    listSeasons: false,
    importAll: false,
    years: [new Date().getFullYear()],
    skipPhotos,
  };
}

async function importSeason(
  db: PrismaClient,
  seriesId: string,
  year: number,
  skipPhotos: boolean,
): Promise<boolean> {
  console.log(`\n=== RDS GP ${year} ===`);
  console.log(`Fetching from rdsgp.com…`);
  const data = await fetchRdsGpSeason(year);

  const finishedEvents = data.events.filter((event) => event.status === 'FINISHED').length;
  console.log(
    `Loaded ${data.pilots.length} pilots, ${data.events.length} events (${finishedEvents} finished)`,
  );

  if (data.pilots.length === 0) {
    console.log(`Skipped ${year}: no result rows on rdsgp.com`);
    return false;
  }

  let season = await db.season.findUnique({
    where: { seriesId_year: { seriesId, year: data.seasonYear } },
  });

  if (season) {
    await db.event.deleteMany({ where: { seasonId: season.id } });
    console.log('Cleared previous season events');
  }

  season = await db.season.upsert({
    where: { seriesId_year: { seriesId, year: data.seasonYear } },
    update: {
      nameEn: `RDS GP ${data.seasonYear}`,
      nameRu: `RDS GP ${data.seasonYear}`,
      sourceLabelEn: 'RDS GP — official results',
      sourceLabelRu: 'RDS GP — официальные результаты',
      sourceUrl: data.sourceUrl,
    },
    create: {
      seriesId,
      year: data.seasonYear,
      nameEn: `RDS GP ${data.seasonYear}`,
      nameRu: `RDS GP ${data.seasonYear}`,
      sourceLabelEn: 'RDS GP — official results',
      sourceLabelRu: 'RDS GP — официальные результаты',
      sourceUrl: data.sourceUrl,
    },
  });

  const eventRecords = await upsertEvents(db, season.id, data);
  const { resultCount, photosMirrored, photosFailed } = await upsertPilotsAndResults(
    db,
    seriesId,
    data,
    eventRecords,
    skipPhotos,
  );

  const stageCount = await refreshStageCoefficientsForSeason(db, season.id);

  console.log(
    `Import complete: ${data.pilots.length} pilots, ${resultCount} event results` +
      (skipPhotos ? '' : `, ${photosMirrored} photos mirrored${photosFailed ? `, ${photosFailed} failed` : ''}`) +
      `, ${stageCount} stage coefficients`,
  );
  return true;
}

async function upsertEvents(db: PrismaClient, seasonId: string, data: RdsGpSeasonData) {
  const eventRecords = new Map<string, { id: string }>();
  for (const event of data.events) {
    const track = await findOrCreateTrack(db, { name: event.trackName, sourceUrl: data.sourceUrl });
    const record = await db.event.upsert({
      where: { seasonId_slug: { seasonId, slug: event.slug } },
      update: {
        roundNumber: event.roundNumber,
        name: event.name,
        trackId: track?.id ?? null,
        startsAt: new Date(event.startsAt),
        status: event.status,
      },
      create: {
        seasonId,
        slug: event.slug,
        roundNumber: event.roundNumber,
        name: event.name,
        trackId: track?.id ?? null,
        startsAt: new Date(event.startsAt),
        status: event.status,
      },
    });
    eventRecords.set(event.slug, record);
  }
  return eventRecords;
}

async function upsertPilotsAndResults(
  db: PrismaClient,
  seriesId: string,
  data: RdsGpSeasonData,
  eventRecords: Map<string, { id: string }>,
  skipPhotos: boolean,
) {
  let resultCount = 0;
  let photosMirrored = 0;
  let photosFailed = 0;
  const photoCache = new Map<string, string | null>();

  for (const pilot of data.pilots) {
    const english = canonicalEnglishNames(pilot);
    const existing = await findMatchingPilot(db, { ...pilot, ...english }, { seriesId });
    const pilotSlug = existing?.slug ?? pilot.slug;

    if (existing && existing.slug !== pilot.slug) {
      const stub = await db.pilot.findUnique({ where: { slug: pilot.slug } });
      if (stub && stub.id !== existing.id) {
        await mergePilotInto(db, stub.id, existing.id);
      }
    }

    const pilotRecord = await db.pilot.upsert({
      where: { slug: pilotSlug },
      update: {
        firstName: english.firstName,
        lastName: english.lastName,
        number: pilot.number,
      },
      create: {
        slug: pilot.slug,
        firstName: english.firstName,
        lastName: english.lastName,
        country: pilot.country,
        number: pilot.number,
      },
    });
    await upsertPilotSeriesAlias(db, { pilotId: pilotRecord.id, seriesId, name: pilot.nameAlias });

    if (!skipPhotos) {
      const pilotId = rdsPilotIdFromSlug(pilot.slug);
      if (pilotId) {
        if (!photoCache.has(pilotId)) {
          photoCache.set(pilotId, await fetchRdsPilotPhotoSourceUrl(pilotId));
        }
        const photoSourceUrl = photoCache.get(pilotId) ?? null;
        if (photoSourceUrl) {
          const { mirrored } = await upsertPilotSeriesPhoto(db, {
            pilotId: pilotRecord.id,
            seriesId,
            pilotSlug: pilot.slug,
            seriesSlug: SERIES_SLUG,
            photoSourceUrl,
          });
          if (mirrored) photosMirrored++;
          else photosFailed++;
        }
      }
    }

    for (const stage of pilot.stages) {
      const event = eventRecords.get(stage.eventSlug);
      if (!event) continue;

      const qualScore100 = toQualScore100(stage.qualScore100, SERIES_SLUG);

      await db.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        update: {
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          qualScore100,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          dataStatus: 'VERIFIED',
        },
        create: {
          eventId: event.id,
          pilotId: pilotRecord.id,
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          qualScore100,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          dataStatus: 'VERIFIED',
        },
      });
      resultCount++;
    }
  }

  return { resultCount, photosMirrored, photosFailed };
}

async function main() {
  const args = parseArgs();

  if (args.listSeasons) {
    console.log(`RDS GP seasons on rdsgp.com (${RDS_GP_SEASONS_WITH_DATA.length} total):`);
    console.log(RDS_GP_SEASONS_WITH_DATA.join(', '));
    console.log('Note: 2010 pages exist but have empty tables; 2025 has no rounds yet.');
    return;
  }

  const years = args.importAll ? [...RDS_GP_SEASONS_WITH_DATA] : args.years;
  const invalid = years.filter(
    (year) => !RDS_GP_SEASONS_WITH_DATA.includes(year as (typeof RDS_GP_SEASONS_WITH_DATA)[number]),
  );
  if (invalid.length > 0) {
    throw new Error(
      `Unavailable season(s): ${invalid.join(', ')}. Use --list-seasons or pick: ${RDS_GP_SEASONS_WITH_DATA.join(', ')}`,
    );
  }

  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found — run db:seed first`);
  }

  let imported = 0;
  for (const year of years) {
    const skipPhotos = args.skipPhotos || year !== years[years.length - 1];
    if (await importSeason(prisma, series.id, year, skipPhotos)) imported++;
  }

  console.log(`\nDone: ${imported}/${years.length} season(s) imported.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
