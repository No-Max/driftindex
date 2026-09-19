import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { mergePilotInto } from '../src/lib/pilotMatch.js';
import { stripSeriesPilotSlugPrefix } from '../src/lib/pilotSlug.js';
import { getMediaRoot } from '../src/lib/media/config.js';
import { syncPilotPrimaryPhoto } from '../src/lib/media/pilotPhoto.js';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

const PREFIX_RANK: Record<string, number> = {
  'dm-': 50,
  'fd-': 40,
  'dk-': 30,
  'd1-': 20,
  'da-': 10,
};

function rewritePilotMediaPath(url: string | null | undefined, from: string, to: string): string | null {
  if (!url) return url ?? null;
  return url.split(`/media/pilots/${from}/`).join(`/media/pilots/${to}/`);
}

async function renameMediaDir(fromSlug: string, toSlug: string): Promise<void> {
  if (fromSlug === toSlug) return;
  const root = getMediaRoot();
  const fromDir = path.join(root, 'pilots', fromSlug);
  const toDir = path.join(root, 'pilots', toSlug);
  try {
    await fs.access(fromDir);
  } catch {
    return;
  }
  await fs.mkdir(path.dirname(toDir), { recursive: true });
  try {
    await fs.rename(fromDir, toDir);
  } catch {
    await fs.cp(fromDir, toDir, { recursive: true });
    await fs.rm(fromDir, { recursive: true, force: true });
  }
}

async function rewritePhotoUrls(pilotId: string, fromSlug: string, toSlug: string): Promise<void> {
  const pilot = await prisma.pilot.findUnique({
    where: { id: pilotId },
    include: { seriesPhotos: true },
  });
  if (!pilot) return;

  await prisma.pilot.update({
    where: { id: pilotId },
    data: { photoUrl: rewritePilotMediaPath(pilot.photoUrl, fromSlug, toSlug) },
  });

  for (const photo of pilot.seriesPhotos) {
    const next = rewritePilotMediaPath(photo.photoUrl, fromSlug, toSlug);
    if (next === photo.photoUrl) continue;
    await prisma.pilotSeriesPhoto.update({
      where: { id: photo.id },
      data: { photoUrl: next },
    });
  }
}

async function scorePilot(slug: string) {
  const pilot = await prisma.pilot.findUnique({
    where: { slug },
    include: { _count: { select: { results: true, seriesPhotos: true, seriesAliases: true } } },
  });
  if (!pilot) return null;
  const prefix = Object.keys(PREFIX_RANK).find((item) => slug.startsWith(item)) ?? '';
  return {
    pilot,
    score:
      pilot._count.results * 1000 +
      (pilot.photoUrl ? 100 : 0) +
      pilot._count.seriesPhotos * 10 +
      (PREFIX_RANK[prefix] ?? 0),
  };
}

async function main() {
  const pilots = await prisma.pilot.findMany({ select: { id: true, slug: true } });
  const groups = new Map<string, string[]>();

  for (const pilot of pilots) {
    const next = stripSeriesPilotSlugPrefix(pilot.slug);
    if (next === pilot.slug) continue;
    groups.set(next, [...(groups.get(next) ?? []), pilot.slug]);
  }

  let merged = 0;
  let renamed = 0;

  for (const [targetSlug, fromSlugs] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const scored = (await Promise.all(fromSlugs.map((slug) => scorePilot(slug)))).filter(
      (row): row is NonNullable<typeof row> => row != null,
    );
    if (scored.length === 0) continue;
    scored.sort((a, b) => b.score - a.score);
    const canonical = scored[0]!;
    for (const duplicate of scored.slice(1)) {
      console.log(`merge ${duplicate.pilot.slug} → ${canonical.pilot.slug}`);
      if (!dryRun) await mergePilotInto(prisma, duplicate.pilot.id, canonical.pilot.id);
      merged += 1;
    }

    const current = dryRun
      ? canonical.pilot
      : await prisma.pilot.findUnique({ where: { id: canonical.pilot.id } });
    if (!current) continue;
    if (current.slug === targetSlug) continue;

    const clash = await prisma.pilot.findUnique({ where: { slug: targetSlug } });
    if (clash && clash.id !== current.id) {
      console.log(`merge leftover ${current.slug} → ${clash.slug} (target taken)`);
      if (!dryRun) {
        await mergePilotInto(prisma, current.id, clash.id);
        await rewritePhotoUrls(clash.id, current.slug, clash.slug);
        await renameMediaDir(current.slug, clash.slug);
      }
      merged += 1;
      continue;
    }

    const fromSlug = current.slug;
    if (!dryRun) {
      await prisma.pilot.update({
        where: { id: current.id },
        data: { slug: targetSlug },
      });
      await rewritePhotoUrls(current.id, fromSlug, targetSlug);
      await renameMediaDir(fromSlug, targetSlug);
      await syncPilotPrimaryPhoto(prisma, current.id);
    }
    console.log(`rename ${fromSlug} → ${targetSlug}`);
    renamed += 1;
  }

  console.log(
    `${dryRun ? 'Dry run. ' : ''}Done. renamed=${renamed} merged=${merged} groups=${groups.size}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
