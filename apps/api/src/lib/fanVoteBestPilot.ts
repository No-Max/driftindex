import type { PrismaClient } from '@prisma/client';
import { toPilotCard } from './pilot.js';
import { seriesAliasMapForPilots } from './pilotNames.js';
import { loadSeriesLogoMap, seriesLogoFromMap } from './seriesLogos.js';
import { computeStandings } from './standings.js';

export type BestPilotSnapshotSeries = {
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  rank: number;
  points: number;
};

export type BestPilotSnapshotCandidate = {
  pilot: ReturnType<typeof toPilotCard>;
  series: BestPilotSnapshotSeries[];
};

type StandingEntry = {
  pilotId: string;
  pilot: Parameters<typeof toPilotCard>[0];
  number: number | null;
  rank: number;
  points: number;
  series: {
    id: string;
    slug: string;
    name: string;
    shortName: string | null;
  };
};

/**
 * Top 3 of each featured series for `year`, deduped by pilot.
 * Snapshot source for seeding Poll options (not live).
 */
export async function listBestPilotSnapshotCandidates(
  prisma: PrismaClient,
  year: number,
): Promise<BestPilotSnapshotCandidate[]> {
  const logoBySlug = await loadSeriesLogoMap(prisma);

  const featuredSeries = await prisma.series.findMany({
    where: { featuredOrder: { not: null } },
    orderBy: { featuredOrder: 'asc' },
    include: {
      seasons: {
        where: { year },
        include: {
          events: {
            orderBy: { roundNumber: 'asc' },
            include: {
              results: { include: { pilot: true } },
            },
          },
        },
      },
    },
  });

  const standingByPilotId = new Map<string, StandingEntry[]>();

  for (const series of featuredSeries) {
    const season = series.seasons[0];
    if (!season) continue;
    const topThree = computeStandings(season.events).slice(0, 3);
    for (const row of topThree) {
      const entry: StandingEntry = {
        pilotId: row.pilot.id,
        pilot: row.pilot,
        number: row.number,
        rank: row.rank,
        points: row.totalPoints,
        series: {
          id: series.id,
          slug: series.slug,
          name: series.name,
          shortName: series.shortName,
        },
      };
      const list = standingByPilotId.get(row.pilot.id) ?? [];
      list.push(entry);
      standingByPilotId.set(row.pilot.id, list);
    }
  }

  const pilots = [...standingByPilotId.values()].map((entries) => entries[0]!.pilot);
  const aliasMap = await seriesAliasMapForPilots(prisma, pilots);

  const allPilotIds = [...standingByPilotId.keys()];
  const seriesPhotoRows = await prisma.pilotSeriesPhoto.findMany({
    where: { pilotId: { in: allPilotIds } },
    include: { series: { select: { slug: true } } },
  });
  const photosByPilotId = new Map<
    string,
    Array<{ seriesSlug: string; photoUrl: string | null }>
  >();
  for (const row of seriesPhotoRows) {
    const list = photosByPilotId.get(row.pilotId) ?? [];
    list.push({ seriesSlug: row.series.slug, photoUrl: row.photoUrl });
    photosByPilotId.set(row.pilotId, list);
  }

  const candidates: BestPilotSnapshotCandidate[] = [];

  for (const [pilotId, entries] of standingByPilotId) {
    const primary = entries[0]!;
    const series = entries
      .map((entry) => ({
        slug: entry.series.slug,
        name: entry.series.name,
        shortName: entry.series.shortName,
        logoUrl: seriesLogoFromMap(logoBySlug, entry.series.slug),
        rank: entry.rank,
        points: entry.points,
      }))
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

    candidates.push({
      pilot: toPilotCard(
        primary.pilot,
        primary.number,
        photosByPilotId.get(pilotId),
        { nameAlias: aliasMap.get(pilotId) },
      ),
      series,
    });
  }

  candidates.sort(
    (a, b) =>
      (a.series[0]?.rank ?? 99) - (b.series[0]?.rank ?? 99) ||
      a.pilot.lastName.localeCompare(b.pilot.lastName) ||
      a.pilot.firstName.localeCompare(b.pilot.firstName),
  );

  return candidates;
}
