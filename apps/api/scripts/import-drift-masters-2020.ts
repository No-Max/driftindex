import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  DM_2020_EVENT,
  DM_2020_RESULTS,
  DM_2020_RESULTS_SOURCE_URL,
  DM_2020_SOURCE_URL,
} from '../src/data/drift-masters-2020.js';
import { normalizeCountryCode } from '../src/lib/countryCode.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { upsertPilotSeriesAlias } from '../src/lib/pilotSeriesAlias.js';
import { toQualScore100 } from '../src/lib/qualScore.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';
import { findOrCreateTrack } from '../src/lib/track.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'drift-masters';
const YEAR = 2020;

function splitName(rawName: string): { firstName: string; lastName: string } {
  const parts = rawName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: parts[0]! };
  }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

function driverSlugFromName(rawName: string): string {
  return rawName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function resolvePilotSlug(
  firstName: string,
  lastName: string,
  slug: string,
  seriesId: string,
): Promise<string> {
  const match = await findMatchingPilot(
    prisma,
    { slug, nameAlias: `${firstName} ${lastName}`, firstName, lastName, number: null },
    { excludeSlugPrefix: 'dm-', seriesId },
  );
  return match?.slug ?? slug;
}

async function main() {
  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found — run db:seed first`);
  }

  console.log(`\n=== Drift Masters ${YEAR} (King of Riga) ===`);

  let season = await prisma.season.findUnique({
    where: { seriesId_year: { seriesId: series.id, year: YEAR } },
  });

  if (season) {
    await prisma.event.deleteMany({ where: { seasonId: season.id } });
    console.log('Cleared previous season events');
  }

  season = await prisma.season.upsert({
    where: { seriesId_year: { seriesId: series.id, year: YEAR } },
    update: {
      nameEn: `Drift Masters ${YEAR}`,
      nameRu: `Drift Masters ${YEAR}`,
      sourceLabelEn: 'Drift Masters — King of Riga 2020 (single event)',
      sourceLabelRu: 'Drift Masters — King of Riga 2020 (один этап)',
      sourceUrl: DM_2020_RESULTS_SOURCE_URL,
    },
    create: {
      seriesId: series.id,
      year: YEAR,
      nameEn: `Drift Masters ${YEAR}`,
      nameRu: `Drift Masters ${YEAR}`,
      sourceLabelEn: 'Drift Masters — King of Riga 2020 (single event)',
      sourceLabelRu: 'Drift Masters — King of Riga 2020 (один этап)',
      sourceUrl: DM_2020_RESULTS_SOURCE_URL,
    },
  });

  const track = await findOrCreateTrack(prisma, {
    name: DM_2020_EVENT.trackName,
    sourceUrl: DM_2020_SOURCE_URL,
  });

  const event = await prisma.event.upsert({
    where: { seasonId_slug: { seasonId: season.id, slug: DM_2020_EVENT.slug } },
    update: {
      roundNumber: DM_2020_EVENT.roundNumber,
      name: DM_2020_EVENT.name,
      trackId: track?.id ?? null,
      startsAt: new Date(DM_2020_EVENT.startsAt),
      status: 'FINISHED',
    },
    create: {
      seasonId: season.id,
      slug: DM_2020_EVENT.slug,
      roundNumber: DM_2020_EVENT.roundNumber,
      name: DM_2020_EVENT.name,
      trackId: track?.id ?? null,
      startsAt: new Date(DM_2020_EVENT.startsAt),
      status: 'FINISHED',
    },
  });

  let merged = 0;
  let qualCount = 0;
  let tandemCount = 0;

  for (const row of DM_2020_RESULTS) {
    const parsed = splitName(row.name);
    const english = canonicalEnglishNames({ ...parsed, nameRu: null });
    const slug = `dm-${driverSlugFromName(row.name)}`;
    const pilotSlug = await resolvePilotSlug(english.firstName, english.lastName, slug, series.id);
    if (pilotSlug !== slug) merged++;

    const country = normalizeCountryCode(row.country);

    const pilotRecord = await prisma.pilot.upsert({
      where: { slug: pilotSlug },
      update: {
        firstName: english.firstName,
        lastName: english.lastName,
        number: row.bib,
        country,
      },
      create: {
        slug: pilotSlug,
        firstName: english.firstName,
        lastName: english.lastName,
        country,
      },
    });
    await upsertPilotSeriesAlias(prisma, {
      pilotId: pilotRecord.id,
      seriesId: series.id,
      name: row.name,
    });

    const qualScore100 = toQualScore100(row.qualScore100, SERIES_SLUG);
    qualCount++;

    await prisma.eventResult.upsert({
      where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
      update: {
        number: row.bib,
        qualPosition: row.qualPosition,
        qualScore100,
        tandemPosition: row.tandemPosition,
        points: row.points,
        dataStatus: 'VERIFIED',
      },
      create: {
        eventId: event.id,
        pilotId: pilotRecord.id,
        number: row.bib,
        qualPosition: row.qualPosition,
        qualScore100,
        tandemPosition: row.tandemPosition,
        points: row.points,
        dataStatus: 'VERIFIED',
      },
    });
    if (row.tandemPosition != null) tandemCount++;
  }

  const stageCount = await refreshStageCoefficientsForSeason(prisma, season.id);

  console.log(
    `Import complete: ${DM_2020_RESULTS.length} pilots (${merged} merged), ` +
      `${qualCount} qual, ${tandemCount} tandem finishes, ${stageCount} stage coefficients`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
