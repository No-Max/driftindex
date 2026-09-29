import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { getMediaRoot } from '../src/lib/media/config.js';
import { syncPilotPrimaryPhoto } from '../src/lib/media/pilotPhoto.js';
import { mergePilotInto } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { transliterate } from '../src/lib/transliterate.js';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

function nameSlug(firstName: string, lastName: string): string {
  const parts = [firstName, lastName]
    .map((part) =>
      transliterate(part)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean);
  return parts.join('-') || 'pilot';
}

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
    await fs.access(toDir);
    // Target exists — copy files then remove source.
    await fs.cp(fromDir, toDir, { recursive: true });
    await fs.rm(fromDir, { recursive: true, force: true });
  } catch {
    try {
      await fs.rename(fromDir, toDir);
    } catch {
      await fs.cp(fromDir, toDir, { recursive: true });
      await fs.rm(fromDir, { recursive: true, force: true });
    }
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

async function uniqueNameSlug(base: string, excludePilotId?: string): Promise<string> {
  let slug = base;
  let suffix = 2;
  for (;;) {
    const clash = await prisma.pilot.findUnique({ where: { slug } });
    if (!clash || clash.id === excludePilotId) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function main() {
  const pilots = await prisma.pilot.findMany({
    where: { slug: { startsWith: 'rds-' } },
    include: { _count: { select: { results: true, seriesPhotos: true } } },
    orderBy: { slug: 'asc' },
  });

  const rdsNumeric = pilots.filter((pilot) => /^rds-\d+$/.test(pilot.slug));
  console.log(`Found ${rdsNumeric.length} rds-<id> pilot(s)${dryRun ? ' (dry run)' : ''}`);

  /** targetSlug → candidates sorted by score desc */
  const groups = new Map<
    string,
    Array<{
      id: string;
      slug: string;
      firstName: string;
      lastName: string;
      score: number;
    }>
  >();

  for (const pilot of rdsNumeric) {
    const english = canonicalEnglishNames(pilot);
    const base = nameSlug(english.firstName, english.lastName);
    if (!base || base === 'pilot') {
      console.log(`skip ${pilot.slug}: cannot derive name slug from "${pilot.firstName} ${pilot.lastName}"`);
      continue;
    }
    const score =
      pilot._count.results * 1000 + (pilot.photoUrl ? 100 : 0) + pilot._count.seriesPhotos * 10;
    const list = groups.get(base) ?? [];
    list.push({
      id: pilot.id,
      slug: pilot.slug,
      firstName: english.firstName,
      lastName: english.lastName,
      score,
    });
    groups.set(base, list);
  }

  let renamed = 0;
  let merged = 0;
  const mapping: Array<{ from: string; to: string }> = [];

  for (const [base, candidates] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    candidates.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
    const primary = candidates[0]!;

    for (const duplicate of candidates.slice(1)) {
      console.log(`merge ${duplicate.slug} → ${primary.slug} (same name ${base})`);
      if (!dryRun) await mergePilotInto(prisma, duplicate.id, primary.id);
      merged += 1;
    }

    const current = dryRun
      ? primary
      : await prisma.pilot.findUnique({ where: { id: primary.id } });
    if (!current) continue;

    const existingNamed = await prisma.pilot.findUnique({ where: { slug: base } });
    if (existingNamed && existingNamed.id !== current.id) {
      console.log(`merge ${current.slug} → ${existingNamed.slug} (name slug taken)`);
      if (!dryRun) {
        await mergePilotInto(prisma, current.id, existingNamed.id);
        await rewritePhotoUrls(existingNamed.id, current.slug, existingNamed.slug);
        await renameMediaDir(current.slug, existingNamed.slug);
        await syncPilotPrimaryPhoto(prisma, existingNamed.id);
      }
      mapping.push({ from: current.slug, to: existingNamed.slug });
      merged += 1;
      continue;
    }

    const targetSlug = dryRun ? base : await uniqueNameSlug(base, current.id);
    if (current.slug === targetSlug) continue;

    console.log(`rename ${current.slug} → ${targetSlug} (${primary.firstName} ${primary.lastName})`);
    mapping.push({ from: current.slug, to: targetSlug });

    if (!dryRun) {
      await prisma.pilot.update({
        where: { id: current.id },
        data: {
          slug: targetSlug,
          firstName: primary.firstName,
          lastName: primary.lastName,
        },
      });
      await rewritePhotoUrls(current.id, current.slug, targetSlug);
      await renameMediaDir(current.slug, targetSlug);
      await syncPilotPrimaryPhoto(prisma, current.id);
    }
    renamed += 1;
  }

  console.log(`\n${dryRun ? 'Dry run. ' : ''}Done. renamed=${renamed} merged=${merged}`);
  if (mapping.length) {
    console.log('\n--- mapping (rds → name) ---');
    for (const row of mapping) console.log(`${row.from}\t${row.to}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
