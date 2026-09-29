import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { syncTrackCoverPhoto } from '../src/lib/trackPhotos.js';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const tracks = await prisma.track.findMany({
    where: { photoUrl: { not: null } },
    include: { _count: { select: { photos: true } } },
  });

  let created = 0;
  for (const track of tracks) {
    if (track._count.photos > 0) continue;
    console.log(`${track.slug}: backfill ← ${track.photoUrl}`);
    if (DRY_RUN) continue;

    await prisma.trackPhoto.create({
      data: {
        trackId: track.id,
        photoUrl: track.photoUrl!,
        sourceUrl: track.sourceUrl,
        sortOrder: 0,
      },
    });
    await syncTrackCoverPhoto(prisma, track.id);
    created += 1;
  }

  console.log(DRY_RUN ? 'Dry run.' : `Created ${created} gallery row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
