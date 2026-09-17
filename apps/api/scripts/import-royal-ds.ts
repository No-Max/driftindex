import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchRoyalDsEventDetails, fetchRoyalDsSeason } from '../src/importers/royal-ds.js';
import { PILOT_NAME_OVERRIDES } from '../src/data/pilot-name-overrides.js';
import { upsertPilotSeriesPhoto } from '../src/lib/media/pilotPhoto.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { findMatchingPilot, mergePilotInto, namesMatch } from '../src/lib/pilotMatch.js';
import { upsertPilotSeriesAlias } from '../src/lib/pilotSeriesAlias.js';
import { toQualScore100 } from '../src/lib/qualScore.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';
import { findOrCreateTrack } from '../src/lib/track.js';
import { normalizeToken } from '../src/lib/transliterate.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'royal-ds';

async function main() {
  console.log('Fetching Royal Drift Series data from royalds.cn…');
  const data = await fetchRoyalDsSeason();

  console.log(
    `Loaded ${data.pilots.length} pilots, ${data.events.length} events, ${data.teams.length} teams`,
  );

  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) {
    throw new Error(`Series ${SERIES_SLUG} not found — run db:seed first`);
  }

  let season = await prisma.season.findUnique({
    where: { seriesId_year: { seriesId: series.id, year: data.seasonYear } },
  });

  if (season) {
    await prisma.event.deleteMany({ where: { seasonId: season.id } });
    console.log('Cleared previous Royal DS season events');
  }

  season = await prisma.season.upsert({
    where: { seriesId_year: { seriesId: series.id, year: data.seasonYear } },
    update: {
      nameEn: `Royal Drift Series ${data.seasonYear}`,
      nameRu: `Royal Drift Series ${data.seasonYear}`,
      sourceLabelEn: 'Royal Drift Series — official results',
      sourceLabelRu: 'Royal Drift Series — официальные результаты',
      sourceUrl: data.sourceUrl,
    },
    create: {
      seriesId: series.id,
      year: data.seasonYear,
      nameEn: `Royal Drift Series ${data.seasonYear}`,
      nameRu: `Royal Drift Series ${data.seasonYear}`,
      sourceLabelEn: 'Royal Drift Series — official results',
      sourceLabelRu: 'Royal Drift Series — официальные результаты',
      sourceUrl: data.sourceUrl,
    },
  });

  const eventDetails = new Map<string, Awaited<ReturnType<typeof fetchRoyalDsEventDetails>>>();
  for (const event of data.events) {
    const details = await fetchRoyalDsEventDetails(event.slug);
    eventDetails.set(event.slug, details);
    if (details.trackName) {
      event.trackName = details.trackName;
    }
    if (details.cityEn) {
      event.cityEn = details.cityEn;
    }
    console.log(
      `Loaded event page ${event.slug}` +
        (details.trackName ? ` (${details.trackName})` : '') +
        `, ${details.qualScores.size} qual scores, ${details.tandemRecords.size} tandem records`,
    );
  }

  const eventRecords = new Map<string, { id: string }>();
  for (const event of data.events) {
    const track = await findOrCreateTrack(prisma, {
      name: event.trackName,
      city: event.cityEn,
      country: event.country,
      sourceUrl: data.sourceUrl,
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
  let photosMirrored = 0;
  let photosFailed = 0;

  for (const pilot of data.pilots) {
    const existing = await findMatchingPilot(
      prisma,
      {
        slug: pilot.slug,
        nameAlias: pilot.nameAlias,
        aliases: [pilot.nickname, `${pilot.firstName} ${pilot.lastName}`],
        firstName: pilot.firstName,
        lastName: pilot.lastName,
        number: pilot.number,
      },
      { seriesId: series.id },
    );
    if (existing && existing.slug !== pilot.slug) {
      const stub = await prisma.pilot.findUnique({ where: { slug: pilot.slug } });
      if (stub && stub.id !== existing.id) {
        await mergePilotInto(prisma, stub.id, existing.id);
      }
    }
    const pilotSlug = existing?.slug ?? pilot.slug;
    const parsedNames = canonicalEnglishNames({
      firstName: pilot.firstName,
      lastName: pilot.lastName,
      nameAlias: pilot.nameAlias,
      slug: pilotSlug,
    });
    const english =
      PILOT_NAME_OVERRIDES[pilotSlug] ??
      (existing && !namesAreSwapped(existing, parsedNames) && namesMatch(existing, parsedNames)
        ? { firstName: existing.firstName, lastName: existing.lastName }
        : parsedNames);

    const pilotRecord = await prisma.pilot.upsert({
      where: { slug: pilotSlug },
      update: {
        firstName: english.firstName,
        lastName: english.lastName,
        country: pilot.country ?? existing?.country ?? undefined,
      },
      create: {
        slug: pilotSlug,
        firstName: english.firstName,
        lastName: english.lastName,
        country: pilot.country,
      },
    });

    for (const alias of [pilot.nameAlias, titleCaseNickname(pilot.nickname)]) {
      await upsertPilotSeriesAlias(prisma, { pilotId: pilotRecord.id, seriesId: series.id, name: alias });
    }

    if (pilot.photoSourceUrl) {
      const { mirrored } = await upsertPilotSeriesPhoto(prisma, {
        pilotId: pilotRecord.id,
        seriesId: series.id,
        pilotSlug: pilot.slug,
        seriesSlug: SERIES_SLUG,
        photoSourceUrl: pilot.photoSourceUrl,
      });
      if (mirrored) photosMirrored++;
      else photosFailed++;
    }

    for (const stage of pilot.stages) {
      const event = eventRecords.get(stage.eventSlug);
      if (!event) continue;

      const details = eventDetails.get(stage.eventSlug);
      const rawQualScore = details?.qualScores.get(pilot.slug) ?? null;
      const qualScore100 = toQualScore100(rawQualScore, SERIES_SLUG);
      const tandem = details?.tandemRecords.get(pilot.slug) ?? null;

      await prisma.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        update: {
          number: pilot.number,
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
          qualScore100,
          tandemPosition: stage.tandemPosition,
          tandemBattles: tandem?.battles ?? null,
          tandemWins: tandem?.wins ?? null,
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
          tandemBattles: tandem?.battles ?? null,
          tandemWins: tandem?.wins ?? null,
          points: stage.points,
          teamId: await teamId(pilot.team),
          dataStatus: 'VERIFIED',
        },
      });
      resultCount++;
    }
  }

  let teamResultCount = 0;
  for (const team of data.teams) {
    const id = await teamId(team.name);
    if (!id) continue;
    for (const stage of team.stages) {
      const event = eventRecords.get(stage.eventSlug);
      if (!event) continue;
      const eventTeam = eventDetails
        .get(stage.eventSlug)
        ?.teams.find((row) => row.name === team.name);
      await prisma.eventTeamResult.upsert({
        where: { eventId_teamId: { eventId: event.id, teamId: id } },
        update: {
          points: eventTeam?.points ?? stage.points,
          position: eventTeam?.position ?? null,
        },
        create: {
          eventId: event.id,
          teamId: id,
          points: eventTeam?.points ?? stage.points,
          position: eventTeam?.position ?? null,
        },
      });
      teamResultCount++;
    }
  }

  const stageCount = await refreshStageCoefficientsForSeason(prisma, season.id);
  const removedTracks = await deleteOrphanRoundTitleTracks();

  console.log(
    `Import complete: ${data.pilots.length} pilots, ${resultCount} event results, ` +
      `${teamResultCount} team results, ` +
      `${photosMirrored} photos mirrored${photosFailed ? `, ${photosFailed} failed` : ''}, ` +
      `${stageCount} stage coefficients` +
      (removedTracks ? `, removed ${removedTracks} leftover round-title tracks` : ''),
  );
}

function titleCaseNickname(nickname: string | null | undefined): string | null {
  if (!nickname?.trim()) return null;
  return nickname
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function namesAreSwapped(
  existing: { firstName: string; lastName: string },
  parsed: { firstName: string; lastName: string },
): boolean {
  return (
    normalizeToken(existing.firstName) === normalizeToken(parsed.lastName) &&
    normalizeToken(existing.lastName) === normalizeToken(parsed.firstName) &&
    normalizeToken(existing.firstName) !== normalizeToken(existing.lastName)
  );
}

/** Previous imports stored Russian round titles («Этап 1 - Шанхай») as track names. */
async function deleteOrphanRoundTitleTracks(): Promise<number> {
  const leftover = await prisma.track.findMany({
    where: {
      OR: [{ name: { startsWith: 'Этап ' } }, { name: { startsWith: 'Round ' } }],
      events: { none: {} },
    },
    select: { id: true },
  });
  if (leftover.length === 0) return 0;
  const deleted = await prisma.track.deleteMany({
    where: { id: { in: leftover.map((track) => track.id) } },
  });
  return deleted.count;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
