import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchRoyalDsEventQualScores, fetchRoyalDsSeason } from '../src/importers/royal-ds.js';
import { upsertPilotSeriesPhoto } from '../src/lib/media/pilotPhoto.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { upsertPilotSeriesAlias } from '../src/lib/pilotSeriesAlias.js';
import { toQualScore100 } from '../src/lib/qualScore.js';
import { refreshStageCoefficientsForSeason } from '../src/lib/stageCoefficient.js';
import { findOrCreateTrack } from '../src/lib/track.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'royal-ds';

async function main() {
  console.log('Fetching Royal Drift Series data from royalds.cn…');
  const data = await fetchRoyalDsSeason();

  console.log(
    `Loaded ${data.pilots.length} pilots (zero-point entries excluded), ${data.events.length} events`,
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

  const qualScoresByEvent = new Map<string, Map<string, number>>();
  for (const event of data.events.filter((item) => item.status === 'FINISHED')) {
    qualScoresByEvent.set(event.slug, await fetchRoyalDsEventQualScores(event.slug));
    console.log(`Loaded qual scores for ${event.slug}`);
  }

  const eventRecords = new Map<string, { id: string }>();
  for (const event of data.events) {
    const track = await findOrCreateTrack(prisma, {
      name: event.trackName,
      city: event.cityEn,
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
    const english = canonicalEnglishNames({ ...pilot, slug: pilot.slug });
    const existing = await findMatchingPilot(
      prisma,
      {
        slug: pilot.slug,
        nameAlias: pilot.nameAlias,
        firstName: english.firstName,
        lastName: english.lastName,
        number: pilot.number,
      },
      { seriesId: series.id },
    );
    const pilotSlug = existing?.slug ?? pilot.slug;

    const pilotRecord = await prisma.pilot.upsert({
      where: { slug: pilotSlug },
      update: {
        firstName: english.firstName,
        lastName: english.lastName,
        country: pilot.country,
        number: pilot.number,
      },
      create: {
        slug: pilotSlug,
        firstName: english.firstName,
        lastName: english.lastName,
        country: pilot.country,
        number: pilot.number,
      },
    });
    await upsertPilotSeriesAlias(prisma, { pilotId: pilotRecord.id, seriesId: series.id, name: pilot.nameAlias });

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

      const rawQualScore = qualScoresByEvent.get(stage.eventSlug)?.get(pilot.slug) ?? null;
      const qualScore100 = toQualScore100(rawQualScore, SERIES_SLUG);

      await prisma.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        update: {
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

  console.log(
    `Import complete: ${data.pilots.length} pilots, ${resultCount} event results, ` +
      `${photosMirrored} photos mirrored${photosFailed ? `, ${photosFailed} failed` : ''}, ` +
      `${stageCount} stage coefficients`,
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
