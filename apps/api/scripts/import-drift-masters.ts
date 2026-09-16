import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  fetchDriftMastersQualByRound,
  fetchDriftMastersSeason,
  findDmQualResult,
  listDriftMastersSeasons,
} from '../src/importers/drift-masters.js';
import type { DmPilot } from '../src/importers/drift-masters.js';
import {
  fetchDriftMastersDriftNewsQualByRound,
  fetchDriftMastersLocalQualByRound,
} from '../src/importers/drift-masters-wp-qual.js';
import { applyDriftMastersQualBackfill } from '../src/lib/driftMastersQualImport.js';
import { applyDriftMastersTandemBackfill } from '../src/lib/driftMastersTandemImport.js';
import { fetchDriftMastersTandemByRound } from '../src/importers/drift-masters-rawmotion-tandem.js';
import { upsertPilotSeriesPhoto } from '../src/lib/media/pilotPhoto.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { upsertPilotSeriesAlias } from '../src/lib/pilotSeriesAlias.js';
import { toQualScore100 } from '../src/lib/qualScore.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';
import { findOrCreateTrack } from '../src/lib/track.js';

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

async function resolvePilotSlug(pilot: DmPilot, seriesId: string): Promise<string> {
  const match = await findMatchingPilot(
    prisma,
    {
      slug: pilot.slug,
      nameAlias: pilot.nameAlias,
      firstName: pilot.firstName,
      lastName: pilot.lastName,
      number: pilot.number,
    },
    { excludeSlugPrefix: 'dm-', seriesId },
  );
  return match?.slug ?? pilot.slug;
}

async function importSeason(year: number, seriesId: string) {
  console.log(`\n=== Drift Masters ${year} ===`);
  const data = await fetchDriftMastersSeason(year);
  console.log(`Loaded ${data.pilots.length} pilots, ${data.events.length} events`);

  const qualByRound = await fetchDriftMastersQualByRound(year, data.events.length);
  const driftNewsQualByRound = await fetchDriftMastersDriftNewsQualByRound(year, data.events.length);
  for (const [roundNumber, rows] of driftNewsQualByRound) {
    qualByRound.set(roundNumber, rows);
  }
  const localQualByRound = await fetchDriftMastersLocalQualByRound(year);
  for (const [roundNumber, rows] of localQualByRound) {
    if (rows.length > 0) qualByRound.set(roundNumber, rows);
  }
  for (const [roundNumber, rows] of qualByRound) {
    console.log(`Loaded ${rows.length} qual results for round ${roundNumber}`);
  }

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
    const track = await findOrCreateTrack(prisma, { name: event.trackName, sourceUrl: data.sourceUrl });
    const record = await prisma.event.upsert({
      where: { seasonId_slug: { seasonId: season.id, slug: event.slug } },
      update: {
        roundNumber: event.roundNumber,
        name: event.name,
        trackId: track?.id ?? null,
        startsAt: new Date(event.startsAt),
        status: event.status,
      },
      create: {
        seasonId: season.id,
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

  let resultCount = 0;
  let qualMatched = 0;
  let qualOnly = 0;
  let photosMirrored = 0;
  let photosFailed = 0;
  let merged = 0;
  const pilotRecordsBySlug = new Map<string, { id: string }>();

  for (const pilot of data.pilots) {
    const english = canonicalEnglishNames(pilot);
    const pilotSlug = await resolvePilotSlug(pilot, seriesId);
    if (pilotSlug !== pilot.slug) merged++;

    const pilotRecord = await prisma.pilot.upsert({
      where: { slug: pilotSlug },
      update: {
        firstName: english.firstName,
        lastName: english.lastName,
        country: pilot.country,
      },
      create: {
        slug: pilotSlug,
        firstName: english.firstName,
        lastName: english.lastName,
        country: pilot.country,
      },
    });
    await upsertPilotSeriesAlias(prisma, { pilotId: pilotRecord.id, seriesId, name: pilot.nameAlias });
    pilotRecordsBySlug.set(pilotSlug, pilotRecord);

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

      const qualRows = qualByRound.get(stage.roundNumber);
      const qual = qualRows
        ? findDmQualResult(qualRows, english.firstName, english.lastName, pilot.nameAlias)
        : undefined;
      const qualScore100 = qual ? toQualScore100(qual.qualScore100, SERIES_SLUG) : null;
      if (qual) qualMatched++;

      await prisma.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        update: {
          number: qual?.bib ?? pilot.number,
          qualPosition: qual?.rank ?? stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          qualScore100,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          dataStatus: 'VERIFIED',
        },
        create: {
          eventId: event.id,
          pilotId: pilotRecord.id,
          number: qual?.bib ?? pilot.number,
          qualPosition: qual?.rank ?? stage.qualifyingPosition,
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

  const qualBackfill = await applyDriftMastersQualBackfill(prisma, {
    seriesId,
    seriesSlug: SERIES_SLUG,
    dataStatus: 'VERIFIED',
    pilots: data.pilots,
    qualByRound,
    eventRecords,
    pilotRecordsBySlug,
    resolvePilotSlug,
  });
  qualMatched += qualBackfill.qualMatched;
  qualOnly += qualBackfill.qualOnly;
  resultCount += qualBackfill.resultCount;

  const tandemByRound = await fetchDriftMastersTandemByRound(year, data.events.length);
  const tandemBackfill = await applyDriftMastersTandemBackfill(prisma, {
    seriesId,
    pilots: data.pilots,
    tandemByRound,
    eventRecords,
    pilotRecordsBySlug,
    resolvePilotSlug,
  });

  const stageCount = await refreshStageCoefficientsForSeason(prisma, season.id);

  console.log(
    `Import complete: ${data.pilots.length} pilots (${merged} merged with existing), ` +
      `${resultCount} results (${qualMatched} with qual scores, ${qualOnly} qual-only` +
      (tandemBackfill.tandemMatched > 0 ? `, ${tandemBackfill.tandemMatched} tandem from RawMotion` : '') +
      '), ' +
      `${photosMirrored} photos mirrored` +
      `${photosFailed ? `, ${photosFailed} photo failures` : ''}, ${stageCount} stage coefficients`,
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
