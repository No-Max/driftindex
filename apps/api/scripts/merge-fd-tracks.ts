import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { resolveTrackFields } from '../src/lib/trackCanonical.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'formula-drift-pro';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) throw new Error(`Series ${SERIES_SLUG} not found`);

  const events = await prisma.event.findMany({
    where: { season: { seriesId: series.id }, trackId: { not: null } },
    include: { track: true },
  });

  const trackIds = [...new Set(events.map((event) => event.trackId!).filter(Boolean))];
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
    include: { _count: { select: { events: true } } },
  });

  const canonicalBySlug = new Map<
    string,
    { fields: ReturnType<typeof resolveTrackFields>; sourceTrackIds: string[]; names: string[] }
  >();

  for (const track of tracks) {
    const fields = resolveTrackFields(track.name);
    if (!fields.preferredSlug) continue;

    const bucket = canonicalBySlug.get(fields.preferredSlug) ?? {
      fields,
      sourceTrackIds: [],
      names: [],
    };
    bucket.sourceTrackIds.push(track.id);
    bucket.names.push(`${track.name} [${track.slug}] (fd+total ${track._count.events})`);
    canonicalBySlug.set(fields.preferredSlug, bucket);
  }

  console.log(
    `Formula Drift PRO: ${events.length} events, ${tracks.length} distinct tracks, ${canonicalBySlug.size} canonical bucket(s)`,
  );
  if (DRY_RUN) console.log('(dry run — no writes)\n');

  let eventsRetargeted = 0;
  let tracksRemoved = 0;

  for (const [slug, { fields, sourceTrackIds, names }] of [...canonicalBySlug.entries()].sort()) {
    const uniqueNames = [...new Set(names)];
    if (sourceTrackIds.length < 2 && uniqueNames.length < 2) {
      const only = tracks.find((track) => track.id === sourceTrackIds[0]);
      if (only?.slug === slug && only.name === fields.name) continue;
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
        city: fields.city ?? undefined,
        country: fields.country ?? undefined,
      },
    });

    const update = await prisma.event.updateMany({
      where: {
        trackId: { in: sourceTrackIds },
        season: { seriesId: series.id },
      },
      data: { trackId: canonical.id },
    });
    eventsRetargeted += update.count;

    const removed = await prisma.track.deleteMany({
      where: {
        id: { in: sourceTrackIds.filter((id) => id !== canonical.id) },
        events: { none: {} },
      },
    });
    tracksRemoved += removed.count;
  }

  const unmapped = tracks.filter((t) => !resolveTrackFields(t.name).preferredSlug);
  if (unmapped.length) {
    console.log(`\n--- Unmapped FD tracks (${unmapped.length}) ---`);
    for (const t of unmapped.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  ${t.name} [${t.slug}]`);
    }
  }

  console.log(
    DRY_RUN
      ? '\nDry run only.'
      : `\nDone: retargeted ${eventsRetargeted} FD event(s), removed ${tracksRemoved} duplicate track row(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
