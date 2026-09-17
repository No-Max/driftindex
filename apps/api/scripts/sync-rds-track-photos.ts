import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { almanacEventIdFromDbSlug } from '../src/importers/almanac-rds-event.js';
import { RDS_GP_TRACK_PHOTO_SOURCES } from '../src/data/rds-gp-track-photos.js';
import { fetchRdsPagePhotoSourceUrl, rdsGpEventPageUrl } from '../src/importers/rds-gp.js';
import { mirrorTrackPhoto } from '../src/lib/media/mirror.js';

const prisma = new PrismaClient();

function eventPageUrl(seasonYear: number, eventSlug: string): string | null {
  const rdsgp = rdsGpEventPageUrl(seasonYear, eventSlug);
  if (rdsgp) return rdsgp;
  const almanacId = almanacEventIdFromDbSlug(eventSlug);
  if (almanacId) return `https://driftalmanac.ru/event/${almanacId}`;
  return null;
}

async function scrapePhotoForTrack(trackId: string, seriesId: string) {
  const events = await prisma.event.findMany({
    where: { trackId, season: { seriesId } },
    orderBy: [{ startsAt: 'desc' }, { roundNumber: 'desc' }],
    take: 12,
    include: { season: true },
  });

  for (const event of events) {
    const pageUrl = eventPageUrl(event.season.year, event.slug);
    if (!pageUrl) continue;
    const sourceUrl = await fetchRdsPagePhotoSourceUrl(pageUrl);
    if (sourceUrl) return { sourceUrl, pageUrl };
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const series = await prisma.series.findUnique({ where: { slug: 'rds-gp' } });
  if (!series) {
    throw new Error('Series rds-gp not found');
  }

  const trackIds = await prisma.event.findMany({
    where: { season: { seriesId: series.id }, trackId: { not: null } },
    distinct: ['trackId'],
    select: { trackId: true },
  });

  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds.map((row) => row.trackId!).filter(Boolean) } },
    orderBy: { name: 'asc' },
  });

  let mirrored = 0;
  let skipped = 0;

  for (const track of tracks) {
    let sourceUrl = RDS_GP_TRACK_PHOTO_SOURCES[track.slug] ?? null;
    let photo = sourceUrl ? await mirrorTrackPhoto(track.slug, sourceUrl) : null;

    if (!photo?.photoUrl) {
      const scraped = await scrapePhotoForTrack(track.id, series.id);
      if (scraped) {
        sourceUrl = scraped.sourceUrl;
        console.log(`  ${track.slug}: scraped ← ${scraped.pageUrl}`);
        photo = await mirrorTrackPhoto(track.slug, sourceUrl);
      }
    }

    if (!photo?.photoUrl || !sourceUrl) {
      console.warn(`  ${track.slug}: no photo source`);
      skipped += 1;
      await sleep(1500);
      continue;
    }

    await prisma.track.update({
      where: { id: track.id },
      data: { photoUrl: photo.photoUrl, sourceUrl },
    });

    mirrored += 1;
    console.log(`  ${track.slug} → ${photo.photoUrl}`);
    await sleep(1500);
  }

  console.log(`\nRDS GP track photos: ${mirrored}/${tracks.length} mirrored, ${skipped} skipped`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
