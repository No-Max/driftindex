import 'dotenv/config';
import { upsertPilotSeriesPhoto } from '../src/lib/media/pilotPhoto.js';
import { prisma } from '../src/lib/prisma.js';

const pilotSlug = process.argv[2];
const seriesSlug = process.argv[3];
const source = process.argv[4];

if (!pilotSlug || !seriesSlug || !source) {
  console.error(
    'Usage: tsx scripts/mirror-pilot-photo.ts <pilotSlug> <seriesSlug> <url-or-local-path>',
  );
  process.exit(1);
}

const isLocal = source.startsWith('/') && !source.startsWith('//');
const photoSourceUrl = isLocal ? null : source;
const localPhotoPath = isLocal ? source : null;

const pilot = await prisma.pilot.findUnique({ where: { slug: pilotSlug } });
const series = await prisma.series.findUnique({ where: { slug: seriesSlug } });
if (!pilot || !series) {
  console.error('Pilot or series not found');
  process.exit(1);
}

const { mirrored } = await upsertPilotSeriesPhoto(prisma, {
  pilotId: pilot.id,
  seriesId: series.id,
  pilotSlug,
  seriesSlug,
  photoSourceUrl,
  localPhotoPath,
});

const updated = await prisma.pilot.findUnique({ where: { id: pilot.id } });
console.log(mirrored ? 'Mirrored OK' : 'Mirror failed', updated?.photoUrl ?? '');

await prisma.$disconnect();
