import type { PrismaClient, Track } from '@prisma/client';
import { transliterate } from './transliterate.js';

export function normalizeTrackName(name: string | null | undefined): string | null {
  const normalized = name?.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

export function trackSlug(name: string): string {
  const base = transliterate(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `track-${hashString(name).slice(0, 8)}`;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

async function uniqueTrackSlug(prisma: PrismaClient, name: string): Promise<string> {
  const base = trackSlug(name);
  let slug = base;
  let suffix = 2;

  while (await prisma.track.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function findOrCreateTrack(
  prisma: PrismaClient,
  input: {
    name: string | null | undefined;
    country?: string | null;
    city?: string | null;
    sourceUrl?: string | null;
  },
): Promise<Track | null> {
  const name = normalizeTrackName(input.name);
  if (!name) return null;

  const existing = await prisma.track.findFirst({ where: { name } });
  if (existing) {
    return prisma.track.update({
      where: { id: existing.id },
      data: {
        country: existing.country ?? input.country ?? undefined,
        city: existing.city ?? input.city ?? undefined,
        sourceUrl: existing.sourceUrl ?? input.sourceUrl ?? undefined,
      },
    });
  }

  return prisma.track.create({
    data: {
      slug: await uniqueTrackSlug(prisma, name),
      name,
      country: input.country ?? undefined,
      city: input.city ?? undefined,
      sourceUrl: input.sourceUrl ?? undefined,
    },
  });
}
