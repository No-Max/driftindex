import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { resolveTrackFields } from '../src/lib/trackCanonical.js';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const tracks = await prisma.track.findMany({
    include: { _count: { select: { events: true } } },
    orderBy: { name: 'asc' },
  });

  const buckets = new Map<
    string,
    { fields: ReturnType<typeof resolveTrackFields>; sourceIds: string[]; names: string[] }
  >();

  for (const track of tracks) {
    const fields = resolveTrackFields(track.name);
    if (!fields.preferredSlug) continue;
    const bucket = buckets.get(fields.preferredSlug) ?? {
      fields,
      sourceIds: [],
      names: [],
    };
    bucket.sourceIds.push(track.id);
    bucket.names.push(`${track.name} [${track.slug}] (${track._count.events})`);
    buckets.set(fields.preferredSlug, bucket);
  }

  let eventsRetargeted = 0;
  let tracksRemoved = 0;

  for (const [slug, { fields, sourceIds, names }] of [...buckets.entries()].sort()) {
    const uniqueNames = [...new Set(names)];
    if (uniqueNames.length < 2 && sourceIds.length < 2) {
      const only = tracks.find((track) => track.id === sourceIds[0]);
      if (only && only.slug === slug && only.name === fields.name && only.country === fields.country) {
        continue;
      }
    }

    console.log(`\n→ ${fields.name} (${slug})`);
    console.log(`  ${uniqueNames.join(' | ')}`);

    if (DRY_RUN) continue;

    const canonical = await prisma.track.upsert({
      where: { slug },
      create: {
        slug,
        name: fields.name,
        city: fields.city,
        country: fields.country,
      },
      update: {
        name: fields.name,
        city: fields.city,
        country: fields.country,
      },
    });

    const update = await prisma.event.updateMany({
      where: { trackId: { in: sourceIds } },
      data: { trackId: canonical.id },
    });
    eventsRetargeted += update.count;

    const removed = await prisma.track.deleteMany({
      where: {
        id: { in: sourceIds.filter((id) => id !== canonical.id) },
        events: { none: {} },
      },
    });
    tracksRemoved += removed.count;
  }

  console.log(
    DRY_RUN
      ? '\nDry run only.'
      : `\nDone: retargeted ${eventsRetargeted} event(s), removed ${tracksRemoved} duplicate track row(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
