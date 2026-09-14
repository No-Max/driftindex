import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  DK_ARCHIVE_SEASONS,
  dkArchiveSeason,
  expandDkArchiveResults,
  type DkArchiveSeason,
} from '../src/data/drift-kings/index.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { upsertPilotSeriesAlias } from '../src/lib/pilotSeriesAlias.js';
import { toQualScore100 } from '../src/lib/qualScore.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';
import { findOrCreateTrack } from '../src/lib/track.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'drift-kings';

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
  aliases: readonly string[],
): Promise<string> {
  const match = await findMatchingPilot(
    prisma,
    {
      slug,
      nameAlias: `${firstName} ${lastName}`,
      aliases: [...aliases],
      firstName,
      lastName,
      number: null,
    },
    { excludeSlugPrefix: 'dk-', seriesId },
  );
  return match?.slug ?? slug;
}

function parseYears(argv: string[]): number[] {
  if (argv.includes('--all')) {
    return DK_ARCHIVE_SEASONS.map((season) => season.year);
  }
  const years: number[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--year') {
      const value = argv[i + 1];
      if (!value) throw new Error('--year requires a year');
      years.push(...value.split(',').map((part) => Number.parseInt(part, 10)));
      i += 1;
      continue;
    }
    if (/^\d{4}$/.test(argv[i]!)) {
      years.push(Number.parseInt(argv[i]!, 10));
    }
  }
  if (years.length === 0) {
    throw new Error('Usage: import-drift-kings.ts --year 2025 | --year 2021,2022 | --all');
  }
  return years;
}

async function importSeason(seriesId: string, seasonData: DkArchiveSeason): Promise<void> {
  const year = seasonData.year;
  const results = expandDkArchiveResults(seasonData);

  console.log(`\n=== Drift Kings ${year} Pro ===`);
  console.log(`Calendar: ${seasonData.sourceUrl}`);
  console.log(`Points: ${seasonData.standingsUrl}`);

  let season = await prisma.season.findUnique({
    where: { seriesId_year: { seriesId, year } },
  });

  if (season) {
    await prisma.event.deleteMany({ where: { seasonId: season.id } });
    console.log(`Cleared previous Drift Kings ${year} events`);
  }

  season = await prisma.season.upsert({
    where: { seriesId_year: { seriesId, year } },
    update: {
      nameEn: `Drift Kings ${year}`,
      nameRu: `Drift Kings ${year}`,
      sourceLabelEn: seasonData.sourceLabelEn,
      sourceLabelRu: seasonData.sourceLabelRu,
      sourceUrl: seasonData.sourceUrl,
    },
    create: {
      seriesId,
      year,
      nameEn: `Drift Kings ${year}`,
      nameRu: `Drift Kings ${year}`,
      sourceLabelEn: seasonData.sourceLabelEn,
      sourceLabelRu: seasonData.sourceLabelRu,
      sourceUrl: seasonData.sourceUrl,
    },
  });

  const eventRecords = new Map<string, { id: string }>();
  for (const event of seasonData.events) {
    const track = await findOrCreateTrack(prisma, {
      name: event.trackName,
      country: event.country,
      city: event.city,
      sourceUrl: event.sourceUrl,
    });
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

  const mergedSlugs = new Set<string>();
  let tandemCount = 0;
  let qualCount = 0;
  const seenPilots = new Set<string>();

  for (const row of results) {
    const event = eventRecords.get(row.eventSlug);
    if (!event) {
      throw new Error(`Missing event ${row.eventSlug} for ${row.name}`);
    }

    const english = splitName(row.name);
    const slug = `dk-${driverSlugFromName(row.name)}`;
    const pilotSlug = await resolvePilotSlug(
      english.firstName,
      english.lastName,
      slug,
      seriesId,
      row.aliases,
    );
    if (pilotSlug !== slug) mergedSlugs.add(pilotSlug);

    const pilotRecord = await prisma.pilot.upsert({
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

    if (!seenPilots.has(pilotRecord.id)) {
      seenPilots.add(pilotRecord.id);
      await upsertPilotSeriesAlias(prisma, {
        pilotId: pilotRecord.id,
        seriesId,
        name: row.name,
      });
      for (const alias of row.aliases) {
        await upsertPilotSeriesAlias(prisma, {
          pilotId: pilotRecord.id,
          seriesId,
          name: alias,
        });
      }
    }

    const qualScore100 = toQualScore100(row.qualScore100, SERIES_SLUG);

    await prisma.eventResult.upsert({
      where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
      update: {
        qualPosition: row.qualPosition,
        qualPoints: row.qualPoints,
        qualScore100,
        tandemPosition: row.tandemPosition,
        points: row.points,
        dataStatus: 'UNVERIFIED',
      },
      create: {
        eventId: event.id,
        pilotId: pilotRecord.id,
        qualPosition: row.qualPosition,
        qualPoints: row.qualPoints,
        qualScore100,
        tandemPosition: row.tandemPosition,
        points: row.points,
        dataStatus: 'UNVERIFIED',
      },
    });
    if (row.tandemPosition != null) tandemCount += 1;
    if (row.qualPosition != null || qualScore100 != null || (row.qualPoints ?? 0) > 0) {
      qualCount += 1;
    }
  }

  const orphaned = await prisma.pilot.deleteMany({
    where: {
      slug: { startsWith: 'dk-' },
      results: { none: {} },
    },
  });

  const stageCount = await refreshStageCoefficientsForSeason(prisma, season.id);
  console.log(
    `Import complete: ${seasonData.events.length} events, ${seasonData.drivers.length} Pro drivers, ` +
      `${results.length} results (${mergedSlugs.size} merged, ${tandemCount} tandem finishes, ` +
      `${qualCount} with quali), ${stageCount} stage coefficients` +
      (orphaned.count > 0 ? `, removed ${orphaned.count} orphan dk-* pilots` : ''),
  );
}

async function main() {
  const years = parseYears(process.argv.slice(2));
  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found — run db:seed first`);
  }

  for (const year of years) {
    if (year === 2026) {
      throw new Error('Use db:import:drift-kings:2026 for the 2026 season');
    }
    const season = dkArchiveSeason(year);
    if (!season) {
      const available = DK_ARCHIVE_SEASONS.map((item) => item.year).join(', ');
      throw new Error(`No Drift Kings archive for ${year}. Available: ${available}`);
    }
    await importSeason(series.id, season);
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
