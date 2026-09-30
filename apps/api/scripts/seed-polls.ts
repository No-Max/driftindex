/**
 * Upsert hardcoded (snapshot) polls for /votes.
 * Usage: npx tsx scripts/seed-polls.ts [year]
 */
import 'dotenv/config';
import { PollStatus, PollType, PrismaClient } from '@prisma/client';
import { listBestPilotSnapshotCandidates } from '../src/lib/fanVoteBestPilot.js';
import {
  listDriftIndexDuelSnapshot,
  listSeriesLeaderDuelSnapshots,
  type DuelSnapshotPair,
} from '../src/lib/fanVoteDuels.js';

const prisma = new PrismaClient();
const year = Number(process.argv[2]) || 2026;

async function upsertPoll(input: {
  slug: string;
  name: string;
  description: string;
  type: PollType;
  sortOrder: number;
  options: Array<{
    label: string;
    sortOrder: number;
    pilotId: string | null;
    photoUrl: string | null;
    metaJson: Record<string, unknown>;
  }>;
}) {
  const existing = await prisma.poll.findUnique({
    where: { slug: input.slug },
    include: { votes: true },
  });

  if (existing && existing.votes.length > 0) {
    console.log(`Skip ${input.slug}: already has ${existing.votes.length} vote(s)`);
    return;
  }

  if (existing) {
    await prisma.pollOption.deleteMany({ where: { pollId: existing.id } });
    await prisma.poll.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description,
        status: PollStatus.ACTIVE,
        type: input.type,
        year,
        sortOrder: input.sortOrder,
        options: {
          create: input.options.map((option) => ({
            label: option.label,
            sortOrder: option.sortOrder,
            pilotId: option.pilotId,
            photoUrl: option.photoUrl,
            metaJson: option.metaJson,
          })),
        },
      },
    });
    console.log(`Updated ${input.slug} (${input.options.length} options)`);
    return;
  }

  await prisma.poll.create({
    data: {
      slug: input.slug,
      name: input.name,
      description: input.description,
      status: PollStatus.ACTIVE,
      type: input.type,
      year,
      sortOrder: input.sortOrder,
      options: {
        create: input.options.map((option) => ({
          label: option.label,
          sortOrder: option.sortOrder,
          pilotId: option.pilotId,
          photoUrl: option.photoUrl,
          metaJson: option.metaJson,
        })),
      },
    },
  });
  console.log(`Created ${input.slug} (${input.options.length} options)`);
}

async function main() {
  const candidates = await listBestPilotSnapshotCandidates(prisma, year);
  const pilots = await prisma.pilot.findMany({
    where: { slug: { in: candidates.map((c) => c.pilot.slug) } },
    select: { id: true, slug: true },
  });
  const pilotIdBySlug = new Map(pilots.map((p) => [p.slug, p.id]));

  await upsertPoll({
    slug: `best-pilot-${year}`,
    name: `World best pilot · ${year}`,
    description: 'Select your favourite and press “VOTE”',
    type: PollType.PILOTS,
    sortOrder: 10,
    options: candidates.map((candidate, index) => ({
      label: `${candidate.pilot.firstName} ${candidate.pilot.lastName}`.trim(),
      sortOrder: index,
      pilotId: pilotIdBySlug.get(candidate.pilot.slug) ?? null,
      photoUrl: candidate.pilot.photoUrl ?? null,
      metaJson: {
        pilotSlug: candidate.pilot.slug,
        firstName: candidate.pilot.firstName,
        lastName: candidate.pilot.lastName,
        country: candidate.pilot.country,
        number: candidate.pilot.number,
        series: candidate.series,
      },
    })),
  });

  const featuredSeries = await prisma.series.findMany({
    where: { featuredOrder: { not: null } },
    orderBy: { featuredOrder: 'asc' },
    select: {
      slug: true,
      name: true,
      shortName: true,
      logoUrl: true,
      country: true,
      seasons: {
        select: {
          events: {
            select: { trackId: true },
          },
        },
      },
    },
  });

  if (featuredSeries.length === 0) {
    console.warn('No featured series — skip best-series poll');
  } else {
    await upsertPoll({
      slug: `best-series-${year}`,
      name: `Best series · ${year}`,
      description: 'Pick your favourite championship',
      type: PollType.SERIES,
      sortOrder: 15,
      options: featuredSeries.map((series, index) => {
        const events = series.seasons.flatMap((season) => season.events);
        const trackIds = new Set(
          events.map((event) => event.trackId).filter((id): id is string => Boolean(id)),
        );
        return {
          label: series.name,
          sortOrder: index,
          pilotId: null,
          photoUrl: series.logoUrl,
          metaJson: {
            seriesSlug: series.slug,
            name: series.name,
            shortName: series.shortName,
            country: series.country,
            eventsCount: events.length,
            tracksCount: trackIds.size,
          },
        };
      }),
    });
  }

  /** Fan favourite chassis shortlist. */
  const driftPlatforms = [
    {
      slug: 'bmw-e92',
      label: 'BMW E92',
      code: 'E92',
      models: '3 Series Coupe · 2006–2013',
      why: 'Balanced RWD chassis with huge aftermarket — a staple in Europe and RDS',
    },
    {
      slug: 'nissan-s15',
      label: 'Nissan S15',
      code: 'S15',
      models: 'Silvia Spec-R · 1999–2002',
      why: 'Classic S-chassis — still a core pro and street-drift platform worldwide',
    },
    {
      slug: 'supra-a80',
      label: 'Supra A80',
      code: 'A80',
      models: 'Toyota Supra MK4 · 1993–2002',
      why: 'Legendary 2JZ platform — the icon of big-power drift builds',
    },
  ] as const;

  await upsertPoll({
    slug: `best-platform-${year}`,
    name: `Best drift platform · ${year}`,
    description: 'Pick your favourite drift chassis',
    type: PollType.CARS,
    sortOrder: 16,
    options: driftPlatforms.map((platform, index) => ({
      label: platform.label,
      sortOrder: index,
      pilotId: null,
      photoUrl: null,
      metaJson: {
        platformSlug: platform.slug,
        code: platform.code,
        models: platform.models,
        why: platform.why,
      },
    })),
  });

  const duel = await listDriftIndexDuelSnapshot(prisma, year);
  if (!duel) {
    console.warn('No Drift Index duel pair available — skip duel poll');
  } else {
    await seedDuelPoll({
      slug: `drift-index-duel-${year}`,
      name: `Who wins the duel · ${year}`,
      description: 'Drift Index #1 vs #2 — pick the winner',
      sortOrder: 20,
      duel,
    });
  }

  const seriesDuels = await listSeriesLeaderDuelSnapshots(prisma, year);
  if (seriesDuels.length === 0) {
    console.warn('No series-leader duel pairs available — skip');
  }
  for (const [index, seriesDuel] of seriesDuels.entries()) {
    const labelA =
      seriesDuel.seriesA?.shortName || seriesDuel.seriesA?.name || 'Series A';
    const labelB =
      seriesDuel.seriesB?.shortName || seriesDuel.seriesB?.name || 'Series B';
    await seedDuelPoll({
      slug: `series-duel-${seriesDuel.pairId}-${year}`,
      name: `${labelA} vs ${labelB}`,
      description: 'Series leaders — pick the winner',
      sortOrder: 30 + index,
      duel: seriesDuel,
    });
  }
}

async function seedDuelPoll(input: {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  duel: DuelSnapshotPair;
}) {
  const duelPilots = await prisma.pilot.findMany({
    where: { slug: { in: input.duel.candidates.map((c) => c.pilot.slug) } },
    select: { id: true, slug: true },
  });
  const duelIdBySlug = new Map(duelPilots.map((p) => [p.slug, p.id]));

  await upsertPoll({
    slug: input.slug,
    name: input.name,
    description: input.description,
    type: PollType.DUEL,
    sortOrder: input.sortOrder,
    options: input.duel.candidates.map((candidate, index) => ({
      label: `${candidate.pilot.firstName} ${candidate.pilot.lastName}`.trim(),
      sortOrder: index,
      pilotId: duelIdBySlug.get(candidate.pilot.slug) ?? null,
      photoUrl: candidate.pilot.photoUrl ?? null,
      metaJson: {
        pilotSlug: candidate.pilot.slug,
        firstName: candidate.pilot.firstName,
        lastName: candidate.pilot.lastName,
        country: candidate.pilot.country,
        number: candidate.pilot.number,
        rank: candidate.rank,
        score: candidate.points,
        ...(candidate.series ? { series: candidate.series } : {}),
        ...(candidate.trophies ? { trophies: candidate.trophies } : {}),
        ...(candidate.stats ? { stats: candidate.stats } : {}),
      },
    })),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
