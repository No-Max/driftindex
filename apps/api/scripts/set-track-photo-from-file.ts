import 'dotenv/config';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import {
  appendTrackPhotoFromLocalFile,
  clearTrackGallery,
} from '../src/lib/trackPhotos.js';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const append = args.includes('--append');
  const paths = args.filter((arg) => arg !== '--append');
  const slug = paths[0];
  const filePaths = paths.slice(1);

  if (!slug || filePaths.length === 0) {
    console.error(
      'Usage: set-track-photo-from-file.ts <track-slug> [--append] <image-path> [image-path...]',
    );
    process.exit(1);
  }

  for (const filePath of filePaths) {
    await fs.access(filePath);
  }

  const track = await prisma.track.findUnique({ where: { slug } });
  if (!track) {
    console.error(`Track not found: ${slug}`);
    process.exit(1);
  }

  if (!append) {
    await clearTrackGallery(prisma, track.id, slug);
  }

  const added: string[] = [];
  for (const filePath of filePaths) {
    const photo = await appendTrackPhotoFromLocalFile(prisma, slug, filePath);
    if (!photo?.photoUrl) {
      console.error(`Failed to process image: ${filePath}`);
      process.exit(1);
    }
    added.push(photo.photoUrl);
  }

  const total = await prisma.trackPhoto.count({ where: { trackId: track.id } });
  console.log(
    `${track.name} (${slug}): ${added.length} photo(s), ${total} total` +
      (append ? ' (appended)' : ' (replaced)'),
  );
  for (const url of added) console.log(`  → ${url}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
