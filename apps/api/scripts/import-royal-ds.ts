import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchRoyalDsSeason } from '../src/importers/royal-ds.js';
import { mirrorPilotPortrait } from '../src/lib/media/mirror.js';

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

  const eventRecords = new Map<string, { id: string }>();
  for (const event of data.events) {
    const record = await prisma.event.upsert({
      where: { seasonId_slug: { seasonId: season.id, slug: event.slug } },
      update: {
        roundNumber: event.roundNumber,
        nameEn: event.nameEn,
        nameRu: event.nameRu,
        trackEn: event.trackEn,
        trackRu: event.nameRu,
        startsAt: new Date(event.startsAt),
        status: event.status,
      },
      create: {
        seasonId: season.id,
        slug: event.slug,
        roundNumber: event.roundNumber,
        nameEn: event.nameEn,
        nameRu: event.nameRu,
        trackEn: event.trackEn,
        trackRu: event.nameRu,
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
    const photo = await mirrorPilotPortrait(pilot.slug, pilot.photoSourceUrl);
    if (pilot.photoSourceUrl) {
      if (photo.photoUrl) photosMirrored++;
      else photosFailed++;
    }

    const pilotRecord = await prisma.pilot.upsert({
      where: { slug: pilot.slug },
      update: {
        firstName: pilot.firstName,
        lastName: pilot.lastName,
        nameRu: pilot.nameRu,
        country: pilot.country,
        number: pilot.number,
        photoUrl: photo.photoUrl,
        photoSourceUrl: photo.photoSourceUrl,
        photoUpdatedAt: photo.photoUpdatedAt,
      },
      create: {
        slug: pilot.slug,
        firstName: pilot.firstName,
        lastName: pilot.lastName,
        nameRu: pilot.nameRu,
        country: pilot.country,
        number: pilot.number,
        photoUrl: photo.photoUrl,
        photoSourceUrl: photo.photoSourceUrl,
        photoUpdatedAt: photo.photoUpdatedAt,
      },
    });

    for (const stage of pilot.stages) {
      const event = eventRecords.get(stage.eventSlug);
      if (!event) continue;

      await prisma.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
        update: {
          qualPosition: stage.qualifyingPosition,
          qualPoints: stage.qualifyingPoints,
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
          tandemPosition: stage.tandemPosition,
          points: stage.points,
          teamId: await teamId(pilot.team),
          dataStatus: 'VERIFIED',
        },
      });
      resultCount++;
    }
  }

  console.log(
    `Import complete: ${data.pilots.length} pilots, ${resultCount} event results, ` +
      `${photosMirrored} photos mirrored${photosFailed ? `, ${photosFailed} failed` : ''}`,
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
