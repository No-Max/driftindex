import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { getMediaRoot } from '../src/lib/media/config.js';
import { syncPilotPrimaryPhoto } from '../src/lib/media/pilotPhoto.js';
import { mergePilotInto } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { computeP4P } from '../src/lib/p4p.js';
import { loadP4PInputs } from '../src/lib/p4pData.js';
import { computePrestigeRanking } from '../src/lib/seriesOverlap.js';
import { transliterate } from '../src/lib/transliterate.js';

const prisma = new PrismaClient();
const year = 2026;
const mergeOnly = process.argv.includes('--merge-swaps');
const exportOnly = process.argv.includes('--export');

function nameSlug(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) =>
      transliterate(part)
        .toLowerCase()
        .replace(/['ʼ`´]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
    .join('-');
}

function rewrite(url: string | null | undefined, from: string, to: string): string | null {
  if (!url) return url ?? null;
  return url.split(`/media/pilots/${from}/`).join(`/media/pilots/${to}/`);
}

async function renameMedia(from: string, to: string): Promise<void> {
  if (from === to) return;
  const root = getMediaRoot();
  const fromDir = path.join(root, 'pilots', from);
  const toDir = path.join(root, 'pilots', to);
  try {
    await fs.promises.access(fromDir);
  } catch {
    return;
  }
  await fs.promises.mkdir(path.dirname(toDir), { recursive: true });
  try {
    await fs.promises.access(toDir);
    await fs.promises.cp(fromDir, toDir, { recursive: true });
    await fs.promises.rm(fromDir, { recursive: true, force: true });
  } catch {
    try {
      await fs.promises.rename(fromDir, toDir);
    } catch {
      await fs.promises.cp(fromDir, toDir, { recursive: true });
      await fs.promises.rm(fromDir, { recursive: true, force: true });
    }
  }
}

async function mergeSlugSwaps(): Promise<number> {
  const all = await prisma.pilot.findMany({
    include: {
      seriesAliases: true,
      seriesPhotos: true,
      _count: { select: { results: true, seriesPhotos: true } },
    },
  });
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  const pairs: Array<[typeof all[number], typeof all[number]]> = [];

  for (const pilot of all) {
    const parts = pilot.slug.split('-');
    if (parts.length !== 2) continue;
    const rev = `${parts[1]}-${parts[0]}`;
    const other = bySlug.get(rev);
    if (!other) continue;
    if (pilot.slug >= rev) continue;
    pairs.push([pilot, other]);
  }

  console.log(`SWAP_PAIRS ${pairs.length}`);
  let merged = 0;

  for (const [a, b] of pairs) {
    const en = canonicalEnglishNames(a);
    const prefer = nameSlug(en.firstName, en.lastName);
    const score = (p: typeof a) => p._count.results * 1000 + p._count.seriesPhotos * 10;

    let keep = a;
    let drop = b;
    if (b.slug === prefer) {
      keep = b;
      drop = a;
    } else if (a.slug === prefer) {
      keep = a;
      drop = b;
    } else if (score(b) > score(a)) {
      keep = b;
      drop = a;
    }

    console.log(
      `MERGE ${drop.slug}(n=${drop._count.results}) -> ${keep.slug}(n=${keep._count.results}) prefer=${prefer}`,
    );
    await mergePilotInto(prisma, drop.id, keep.id);
    bySlug.delete(drop.slug);
    merged += 1;

    let finalSlug = keep.slug;
    if (prefer && prefer !== keep.slug) {
      const clash = await prisma.pilot.findUnique({ where: { slug: prefer } });
      if (!clash || clash.id === keep.id) {
        const pilot = await prisma.pilot.findUnique({
          where: { id: keep.id },
          include: { seriesPhotos: true },
        });
        if (pilot) {
          await prisma.pilot.update({
            where: { id: keep.id },
            data: {
              slug: prefer,
              firstName: en.firstName,
              lastName: en.lastName,
              photoUrl: rewrite(pilot.photoUrl, keep.slug, prefer),
            },
          });
          for (const photo of pilot.seriesPhotos) {
            const next = rewrite(photo.photoUrl, keep.slug, prefer);
            if (next !== photo.photoUrl) {
              await prisma.pilotSeriesPhoto.update({
                where: { id: photo.id },
                data: { photoUrl: next },
              });
            }
          }
          await renameMedia(keep.slug, prefer);
          finalSlug = prefer;
          bySlug.delete(keep.slug);
        }
      }
    } else {
      await prisma.pilot.update({
        where: { id: keep.id },
        data: { firstName: en.firstName, lastName: en.lastName },
      });
    }
    await syncPilotPrimaryPhoto(prisma, keep.id);
    const refreshed = await prisma.pilot.findUnique({
      where: { id: keep.id },
      include: {
        seriesAliases: true,
        seriesPhotos: true,
        _count: { select: { results: true, seriesPhotos: true } },
      },
    });
    if (refreshed) bySlug.set(finalSlug, refreshed);
    console.log(`  DONE ${finalSlug}`);
  }

  return merged;
}

async function exportOutside(): Promise<number> {
  const prestige = await computePrestigeRanking(prisma, year);
  const { inputs } = await loadP4PInputs(prisma, year, prestige.hardnessBySlug);
  const p4pRows = computeP4P(inputs);
  const rankedSlugs = new Set(p4pRows.map((row) => row.pilot.slug));

  const unranked = await prisma.pilot.findMany({
    where: { slug: { notIn: [...rankedSlugs] } },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    include: {
      results: {
        select: {
          event: {
            select: {
              season: {
                select: {
                  year: true,
                  series: { select: { shortName: true, slug: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const lines = ['slug\tname\tcountry\tevents\tseries'];
  for (const pilot of unranked) {
    const en = canonicalEnglishNames(pilot);
    const name = `${en.firstName} ${en.lastName}`.trim();
    const bySeries = new Map<string, Set<number>>();
    for (const result of pilot.results) {
      const series =
        result.event.season.series.shortName ||
        result.event.season.series.slug ||
        result.event.season.series.name;
      const y = result.event.season.year;
      if (!bySeries.has(series)) bySeries.set(series, new Set());
      bySeries.get(series)!.add(y);
    }
    const seriesStr =
      [...bySeries.entries()]
        .map(([s, years]) => `${s}(${[...years].sort((a, b) => a - b).join(',')})`)
        .join('; ') || '—';
    lines.push(
      [pilot.slug, name, pilot.country ?? '', String(pilot.results.length), seriesStr].join('\t'),
    );
  }

  const outPath = '/tmp/outside-series-pilots-2026.tsv';
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
  console.log(`OUTSIDE ${unranked.length} RANKED ${rankedSlugs.size} -> ${outPath}`);
  return unranked.length;
}

async function main() {
  if (!exportOnly) {
    const merged = await mergeSlugSwaps();
    console.log(`Merged ${merged} slug-swap pair(s)`);
  }
  if (!mergeOnly) {
    await exportOutside();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
