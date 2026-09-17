import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchRdsAlmanacSeason } from '../src/importers/rds-almanac.js';
import { findOrCreateTrack } from '../src/lib/track.js';
import { resolveTrackFields } from '../src/lib/trackCanonical.js';

const prisma = new PrismaClient();
const SERIES_SLUG = 'rds-gp';
const DRY_RUN = process.argv.includes('--dry-run');

async function mergeCanonicalTracks(seriesId: string, tracks: Array<{ id: string; name: string }>) {
  const canonicalBySlug = new Map<
    string,
    { fields: ReturnType<typeof resolveTrackFields>; sourceTrackIds: string[] }
  >();

  for (const track of tracks) {
    const fields = resolveTrackFields(track.name);
    if (!fields.preferredSlug) continue;

    const bucket = canonicalBySlug.get(fields.preferredSlug) ?? {
      fields,
      sourceTrackIds: [],
    };
    bucket.sourceTrackIds.push(track.id);
    canonicalBySlug.set(fields.preferredSlug, bucket);
  }

  let eventsRetargeted = 0;
  let tracksRemoved = 0;

  for (const [slug, { fields, sourceTrackIds }] of canonicalBySlug) {
    if (sourceTrackIds.length === 0) continue;

    const names = tracks
      .filter((track) => sourceTrackIds.includes(track.id))
      .map((track) => track.name);
    console.log(`\n→ ${fields.name} (${slug})`);
    console.log(`  merge ${sourceTrackIds.length} row(s): ${names.join(' | ')}`);

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
      where: { trackId: { in: sourceTrackIds } },
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

  return { eventsRetargeted, tracksRemoved };
}

/** Re-link event → track from Drift Almanac season pages (fixes Igora vs generic SPb, etc.). */
async function realignEventTracksFromAlmanac(seriesId: string) {
  const seasons = await prisma.season.findMany({
    where: { seriesId },
    include: { events: { orderBy: { roundNumber: 'asc' } } },
    orderBy: { year: 'asc' },
  });

  let updated = 0;
  for (const season of seasons) {
    let data;
    try {
      data = await fetchRdsAlmanacSeason(season.year);
    } catch {
      continue;
    }
    if (data.events.length === 0) continue;

    for (const meta of data.events) {
      const event = season.events.find((row) => row.roundNumber === meta.roundNumber);
      if (!event) continue;

      if (DRY_RUN) {
        const fields = resolveTrackFields(meta.trackName);
        console.log(
          `  Almanac ${season.year} R${meta.roundNumber}: «${meta.trackName}» → ${fields.name} (${fields.preferredSlug ?? '—'})`,
        );
        continue;
      }

      const track = await findOrCreateTrack(prisma, {
        name: meta.trackName,
        sourceUrl: data.sourceUrl,
      });
      if (!track || track.id === event.trackId) continue;

      await prisma.event.update({
        where: { id: event.id },
        data: { trackId: track.id },
      });
      updated += 1;
      console.log(
        `  ${season.year} R${meta.roundNumber}: track → ${track.name} (${track.slug})`,
      );
    }
  }

  return updated;
}

async function main() {
  const series = await prisma.series.findUnique({ where: { slug: SERIES_SLUG } });
  if (!series) throw new Error(`Series ${SERIES_SLUG} not found`);

  const events = await prisma.event.findMany({
    where: { season: { seriesId: series.id }, trackId: { not: null } },
    include: { track: true },
  });

  const trackIds = [...new Set(events.map((event) => event.trackId!).filter(Boolean))];
  const tracks = await prisma.track.findMany({ where: { id: { in: trackIds } } });

  console.log(`RDS GP events with track: ${events.length}, distinct tracks: ${tracks.length}`);
  if (DRY_RUN) console.log('(dry run — no writes)\n');

  const { eventsRetargeted, tracksRemoved } = await mergeCanonicalTracks(series.id, tracks);

  console.log('\n--- Almanac track realignment ---');
  const almanacUpdates = await realignEventTracksFromAlmanac(series.id);

  if (!DRY_RUN) {
    console.log(
      `\nDone: merge retargeted ${eventsRetargeted} event(s), removed ${tracksRemoved} duplicate track row(s), almanac realigned ${almanacUpdates} event(s).`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
