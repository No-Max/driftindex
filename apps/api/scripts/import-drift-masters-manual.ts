import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DM_2014_ROUNDS } from '../src/data/drift-masters-2014.js';
import type { DmManualEvent, DmManualRoundResult } from '../src/data/drift-masters-2014-r1.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'drift-masters';
const YEAR = 2014;

const NAME_ALIASES: Record<string, string> = {
  'Mateusz Fiał': 'Mateusz Fijał',
  'Mateusz Fijał / Fiał': 'Mateusz Fijał',
  'Sławek Grausam': 'Sławomir Grausam',
};

function splitName(rawName: string): { firstName: string; lastName: string } {
  const parts = rawName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: parts[0]! };
  }
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(' '),
  };
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

function canonicalName(rawName: string): string {
  return NAME_ALIASES[rawName.trim()] ?? rawName.trim();
}

async function resolvePilotSlug(firstName: string, lastName: string, slug: string): Promise<string> {
  const identity = { slug, nameRu: null, firstName, lastName, number: null };
  const external = await findMatchingPilot(prisma, identity, { excludeSlugPrefix: 'dm-' });
  if (external) return external.slug;

  const existing = await findMatchingPilot(prisma, identity);
  return existing?.slug ?? slug;
}

async function upsertEvent(seasonId: string, event: DmManualEvent) {
  return prisma.event.upsert({
    where: { seasonId_slug: { seasonId, slug: event.slug } },
    update: {
      roundNumber: event.roundNumber,
      nameEn: event.nameEn,
      nameRu: event.nameRu,
      trackEn: event.trackEn,
      trackRu: event.trackRu,
      startsAt: new Date(event.startsAt),
      status: 'FINISHED',
    },
    create: {
      seasonId,
      slug: event.slug,
      roundNumber: event.roundNumber,
      nameEn: event.nameEn,
      nameRu: event.nameRu,
      trackEn: event.trackEn,
      trackRu: event.trackRu,
      startsAt: new Date(event.startsAt),
      status: 'FINISHED',
    },
  });
}

async function upsertResult(
  eventId: string,
  row: DmManualRoundResult,
): Promise<{ merged: boolean }> {
  const name = canonicalName(row.name);
  const parsed = splitName(name);
  const english = canonicalEnglishNames({ ...parsed, nameRu: null });
  const slug = driverSlugFromName(name);
  const pilotSlug = await resolvePilotSlug(english.firstName, english.lastName, slug);

  const existing = await prisma.pilot.findUnique({ where: { slug: pilotSlug } });
  const shouldUpdateNames = !existing || existing.slug === slug;

  const pilotRecord = await prisma.pilot.upsert({
    where: { slug: pilotSlug },
    update: shouldUpdateNames
      ? { firstName: english.firstName, lastName: english.lastName }
      : {},
    create: {
      slug: pilotSlug,
      firstName: english.firstName,
      lastName: english.lastName,
    },
  });

  await prisma.eventResult.upsert({
    where: { eventId_pilotId: { eventId, pilotId: pilotRecord.id } },
    update: {
      qualPosition: row.qualPosition,
      qualPoints: row.qualPoints,
      qualScore100: row.qualScore100 ?? null,
      tandemPosition: row.tandemPosition,
      points: row.points,
      dataStatus: 'UNVERIFIED',
    },
    create: {
      eventId,
      pilotId: pilotRecord.id,
      qualPosition: row.qualPosition,
      qualPoints: row.qualPoints,
      qualScore100: row.qualScore100 ?? null,
      tandemPosition: row.tandemPosition,
      points: row.points,
      dataStatus: 'UNVERIFIED',
    },
  });

  return { merged: pilotSlug !== slug };
}

async function main() {
  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found — run db:seed first`);
  }

  const season = await prisma.season.upsert({
    where: { seriesId_year: { seriesId: series.id, year: YEAR } },
    update: {
      nameEn: `Drift Masters ${YEAR}`,
      nameRu: `Drift Masters ${YEAR}`,
      sourceLabelEn: 'Manual results — DMGP / DMEC 2014',
      sourceLabelRu: 'Ручной ввод — DMGP / DMEC 2014',
    },
    create: {
      seriesId: series.id,
      year: YEAR,
      nameEn: `Drift Masters ${YEAR}`,
      nameRu: `Drift Masters ${YEAR}`,
      sourceLabelEn: 'Manual results — DMGP / DMEC 2014',
      sourceLabelRu: 'Ручной ввод — DMGP / DMEC 2014',
    },
  });

  let resultCount = 0;
  let merged = 0;

  for (const round of DM_2014_ROUNDS) {
    const event = await upsertEvent(season.id, round.event);
    for (const row of round.results) {
      const outcome = await upsertResult(event.id, row);
      if (outcome.merged) merged++;
      resultCount++;
    }
  }

  const stageCount = await refreshStageCoefficientsForSeason(prisma, season.id);

  console.log(
    `Drift Masters 2014 imported: ${DM_2014_ROUNDS.length} rounds, ` +
      `${resultCount} results (${merged} pilots merged), ${stageCount} stage coefficients`,
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
