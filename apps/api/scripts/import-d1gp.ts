import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchD1gpSeason, listD1gpSeasons } from '../src/importers/d1gp.js';
import type { D1Pilot } from '../src/importers/d1gp.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { upsertPilotSeriesPhoto } from '../src/lib/media/pilotPhoto.js';
import { upsertPilotSeriesAlias } from '../src/lib/pilotSeriesAlias.js';
import { toQualScore100 } from '../src/lib/qualScore.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';
import { findOrCreateTrack } from '../src/lib/track.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'd1gp';

function parseYears(): number[] {
  if (process.argv.includes('--list-seasons')) return [];

  const supported = listD1gpSeasons();
  if (process.argv.includes('--all')) {
    return supported;
  }

  const yearArgs = process.argv.filter((arg) => /^\d{4}$/.test(arg));
  if (yearArgs.length > 0) {
    const years = yearArgs.map((arg) => Number.parseInt(arg, 10));
    const invalid = years.filter((year) => !supported.includes(year));
    if (invalid.length > 0) {
      throw new Error(
        `Unsupported season(s): ${invalid.join(', ')}. Available: ${supported.join(', ')}`,
      );
    }
    return years;
  }

  return [2026];
}

async function resolvePilotSlug(pilot: D1Pilot, seriesId: string): Promise<string> {
  const match = await findMatchingPilot(
    prisma,
    {
      slug: pilot.slug,
      nameAlias: pilot.nameAlias,
      firstName: pilot.firstName,
      lastName: pilot.lastName,
      number: pilot.number,
    },
    { excludeSlugPrefix: 'd1-', seriesId },
  );
  return match?.slug ?? pilot.slug;
}

async function importSeason(year: number, seriesId: string) {
  console.log(`\n=== D1 Grand Prix ${year} ===`);
  const data = await fetchD1gpSeason(year);
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
      nameEn: `D1 Grand Prix ${data.seasonYear}`,
      nameRu: `D1 Grand Prix ${data.seasonYear}`,
      sourceLabelEn: 'D1 Grand Prix — official results',
      sourceLabelRu: 'D1 Grand Prix — официальные результаты',
      sourceUrl: data.sourceUrl,
    },
    create: {
      seriesId,
      year: data.seasonYear,
      nameEn: `D1 Grand Prix ${data.seasonYear}`,
      nameRu: `D1 Grand Prix ${data.seasonYear}`,
      sourceLabelEn: 'D1 Grand Prix — official results',
      sourceLabelRu: 'D1 Grand Prix — официальные результаты',
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

  const teamCache = new Map<string, string>();
  async function teamId(name: string | null): Promise<string | null> {
    if (!name) return null;
    const cached = teamCache.get(name);
    if (cached) return cached;
    let team = await prisma.team.findFirst({ where: { name } });
    if (!team) team = await prisma.team.create({ data: { name } });
    teamCache.set(name, team.id);
    return team.id;
  }

  let resultCount = 0;
  let qualCount = 0;
  let merged = 0;
  let photosMirrored = 0;
  let photosFailed = 0;

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

      const qualScore100 = toQualScore100(stage.qualScore100, SERIES_SLUG);
      if (qualScore100 != null) qualCount++;

      await prisma.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        update: {
          number: pilot.number,
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          qualScore100,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          teamId: await teamId(pilot.team),
          dataStatus: 'VERIFIED',
        },
        create: {
          eventId: event.id,
          pilotId: pilotRecord.id,
          number: pilot.number,
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          qualScore100,
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          teamId: await teamId(pilot.team),
          dataStatus: 'VERIFIED',
        },
      });
      resultCount++;
    }
  }

  const stageCount = await refreshStageCoefficientsForSeason(prisma, season.id);

  const withPhotos = data.pilots.filter((p) => p.photoSourceUrl).length;
  console.log(
    `Import complete: ${data.pilots.length} pilots (${merged} merged with existing), ` +
      `${resultCount} results (${qualCount} with qual scores), ${stageCount} stage coefficients, ` +
      `${withPhotos} photo sources (${photosMirrored} mirrored, ${photosFailed} failed)`,
  );
}

async function cleanupOrphanD1Pilots() {
  const deleted = await prisma.pilot.deleteMany({
    where: {
      slug: { startsWith: 'd1-' },
      results: { none: {} },
    },
  });
  if (deleted.count > 0) {
    console.log(`Removed ${deleted.count} orphan d1-* pilot records`);
  }
}

async function main() {
  if (process.argv.includes('--list-seasons')) {
    console.log(listD1gpSeasons().join('\n'));
    return;
  }

  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found — run db:seed first`);
  }

  for (const year of parseYears()) {
    await importSeason(year, series.id);
  }

  await cleanupOrphanD1Pilots();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
