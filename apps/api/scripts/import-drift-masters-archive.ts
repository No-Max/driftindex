import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DM_2019_EVENTS } from '../src/data/drift-masters-2019-events.js';
import { applyArchiveResultOverrides } from '../src/data/drift-masters-archive-overrides.js';
import { applyArchivePilotNumbers } from '../src/data/drift-masters-pilot-numbers.js';
import {
  DM_ARCHIVE_SEASONS,
  fetchDriftMastersArchiveSeason,
} from '../src/importers/drift-masters-archive.js';
import { fetchDriftMastersQualByRound } from '../src/importers/drift-masters.js';
import type { DmPilot } from '../src/importers/drift-masters.js';
import { applyDriftMastersQualBackfill } from '../src/lib/driftMastersQualImport.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { upsertPilotSeriesAlias } from '../src/lib/pilotSeriesAlias.js';
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

  return [...DM_ARCHIVE_SEASONS];
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
  console.log(`\n=== Drift Masters ${year} (archive) ===`);
  const data = await fetchDriftMastersArchiveSeason(year);
  applyArchivePilotNumbers(data.seasonYear, data.pilots);
  console.log(`Loaded ${data.pilots.length} pilots, ${data.events.length} events`);

  const qualByRound = await fetchDriftMastersQualByRound(year, data.events.length);
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
      sourceLabelEn: 'Drift Masters — archived standings',
      sourceLabelRu: 'Drift Masters — архив таблицы',
      sourceUrl: data.sourceUrl,
    },
    create: {
      seriesId,
      year: data.seasonYear,
      nameEn: `Drift Masters ${data.seasonYear}`,
      nameRu: `Drift Masters ${data.seasonYear}`,
      sourceLabelEn: 'Drift Masters — archived standings',
      sourceLabelRu: 'Drift Masters — архив таблицы',
      sourceUrl: data.sourceUrl,
    },
  });

  const eventMetaByRound =
    year === 2019 ? new Map(DM_2019_EVENTS.map((event) => [event.roundNumber, event])) : null;

  const eventRecords = new Map<string, { id: string }>();
  for (const event of data.events) {
    const meta = eventMetaByRound?.get(event.roundNumber);
    const eventName = meta?.name ?? event.name;
    const trackName = meta?.trackName ?? event.trackName;
    const startsAt = meta?.startsAt ?? event.startsAt;

    const track = await findOrCreateTrack(prisma, { name: trackName, sourceUrl: data.sourceUrl });
    const record = await prisma.event.upsert({
      where: { seasonId_slug: { seasonId: season.id, slug: event.slug } },
      update: {
        roundNumber: event.roundNumber,
        name: eventName,
        trackId: track?.id ?? null,
        startsAt: new Date(startsAt),
        status: event.status,
      },
      create: {
        seasonId: season.id,
        slug: event.slug,
        roundNumber: event.roundNumber,
        name: eventName,
        trackId: track?.id ?? null,
        startsAt: new Date(startsAt),
        status: event.status,
      },
    });
    eventRecords.set(event.slug, record);
  }

  let resultCount = 0;
  let qualMatched = 0;
  let qualOnly = 0;
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
        country: pilot.country ?? undefined,
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

    for (const stage of pilot.stages) {
      const event = eventRecords.get(stage.eventSlug);
      if (!event) continue;

      await prisma.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        update: {
          number: pilot.number,
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          dataStatus: 'UNVERIFIED',
        },
        create: {
          eventId: event.id,
          pilotId: pilotRecord.id,
          number: pilot.number,
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          dataStatus: 'UNVERIFIED',
        },
      });
      resultCount++;
    }
  }

  const qualBackfill = await applyDriftMastersQualBackfill(prisma, {
    seriesId,
    seriesSlug: SERIES_SLUG,
    dataStatus: 'UNVERIFIED',
    pilots: data.pilots,
    qualByRound,
    eventRecords,
    pilotRecordsBySlug,
    resolvePilotSlug,
  });
  qualMatched += qualBackfill.qualMatched;
  qualOnly += qualBackfill.qualOnly;
  resultCount += qualBackfill.resultCount;

  const overrideCount = await applyArchiveResultOverrides(prisma, data.seasonYear, season.id);
  const stageCount = await refreshStageCoefficientsForSeason(prisma, season.id);

  console.log(
    `Import complete: ${data.pilots.length} pilots (${merged} merged), ${resultCount} results` +
      (qualMatched > 0 ? ` (${qualMatched} with qual scores, ${qualOnly} qual-only)` : '') +
      (overrideCount > 0 ? `, ${overrideCount} verified overrides` : '') +
      `, ${stageCount} stage coefficients`,
  );
}

async function main() {
  if (process.argv.includes('--list-seasons')) {
    console.log('Drift Masters archive seasons:');
    for (const year of DM_ARCHIVE_SEASONS) {
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
