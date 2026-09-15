import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  DK_2026_DRIVERS,
  DK_2026_EVENTS,
  DK_2026_RESULTS,
  DK_2026_SOURCE_URL,
  DK_2026_STANDINGS_URL,
} from '../src/data/drift-kings-2026.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { upsertPilotSeriesAlias } from '../src/lib/pilotSeriesAlias.js';
import { toQualScore100 } from '../src/lib/qualScore.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';
import { findOrCreateTrack } from '../src/lib/track.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'drift-kings';
const YEAR = 2026;

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

async function main() {
  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found — run db:seed first`);
  }

  console.log(`\n=== Drift Kings ${YEAR} Pro ===`);
  console.log(`Calendar: ${DK_2026_SOURCE_URL}`);
  console.log(`Points: ${DK_2026_STANDINGS_URL}`);

  let season = await prisma.season.findUnique({
    where: { seriesId_year: { seriesId: series.id, year: YEAR } },
  });

  if (season) {
    await prisma.event.deleteMany({ where: { seasonId: season.id } });
    console.log('Cleared previous Drift Kings 2026 events');
  }

  season = await prisma.season.upsert({
    where: { seriesId_year: { seriesId: series.id, year: YEAR } },
    update: {
      nameEn: `Drift Kings ${YEAR}`,
      nameRu: `Drift Kings ${YEAR}`,
      sourceLabelEn: 'Drift Kings 2026 Pro — official calendar + driftas.eu standings',
      sourceLabelRu: 'Drift Kings 2026 Pro — официальный календарь + таблица driftas.eu',
      sourceUrl: DK_2026_SOURCE_URL,
    },
    create: {
      seriesId: series.id,
      year: YEAR,
      nameEn: `Drift Kings ${YEAR}`,
      nameRu: `Drift Kings ${YEAR}`,
      sourceLabelEn: 'Drift Kings 2026 Pro — official calendar + driftas.eu standings',
      sourceLabelRu: 'Drift Kings 2026 Pro — официальный календарь + таблица driftas.eu',
      sourceUrl: DK_2026_SOURCE_URL,
    },
  });

  const eventRecords = new Map<string, { id: string }>();
  for (const event of DK_2026_EVENTS) {
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

  for (const row of DK_2026_RESULTS) {
    const event = eventRecords.get(row.eventSlug);
    if (!event) {
      throw new Error(`Missing event ${row.eventSlug} for ${row.name}`);
    }

    // Curated English names — skip canonicalEnglishNames(), which title-cases
    // the whole last-name string and mangles "Du Pasquier" / "Trela-Muchewicz".
    const english = splitName(row.name);
    const slug = `dk-${driverSlugFromName(row.name)}`;
    const pilotSlug = await resolvePilotSlug(
      english.firstName,
      english.lastName,
      slug,
      series.id,
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
        seriesId: series.id,
        name: row.name,
      });
      for (const alias of row.aliases) {
        await upsertPilotSeriesAlias(prisma, {
          pilotId: pilotRecord.id,
          seriesId: series.id,
          name: alias,
        });
      }
    }

    const qualScore100 = toQualScore100(row.qualScore100, SERIES_SLUG);

    await prisma.eventResult.upsert({
      where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
      update: {
        number: row.number,
        qualPosition: row.qualPosition,
        qualScore100,
        tandemPosition: row.tandemPosition,
        tandemWins: row.tandemWins,
        tandemBattles: row.tandemBattles,
        points: row.points,
        dataStatus: 'UNVERIFIED',
      },
      create: {
        eventId: event.id,
        pilotId: pilotRecord.id,
        number: row.number,
        qualPosition: row.qualPosition,
        qualScore100,
        tandemPosition: row.tandemPosition,
        tandemWins: row.tandemWins,
        tandemBattles: row.tandemBattles,
        points: row.points,
        dataStatus: 'UNVERIFIED',
      },
    });
    if (row.tandemPosition != null || row.tandemBattles != null) tandemCount++;
    if (row.qualPosition != null || qualScore100 != null) qualCount++;
  }

  const orphaned = await prisma.pilot.deleteMany({
    where: {
      slug: { startsWith: 'dk-' },
      results: { none: {} },
    },
  });

  const stageCount = await refreshStageCoefficientsForSeason(prisma, season.id);
  const finishedEvents = DK_2026_EVENTS.filter((event) => event.status === 'FINISHED').length;

  console.log(
    `Import complete: ${DK_2026_EVENTS.length} events (${finishedEvents} finished), ` +
      `${DK_2026_DRIVERS.length} Pro drivers, ${DK_2026_RESULTS.length} results ` +
      `(${mergedSlugs.size} merged, ${tandemCount} tandem finishes, ${qualCount} with quali), ` +
      `${stageCount} stage coefficients` +
      (orphaned.count > 0 ? `, removed ${orphaned.count} orphan dk-* pilots` : ''),
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
