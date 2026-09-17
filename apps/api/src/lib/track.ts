import type { PrismaClient, Track } from '@prisma/client';
import { resolveTrackFields } from './trackCanonical.js';
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
  const raw = normalizeTrackName(input.name);
  if (!raw) return null;

  const resolved = resolveTrackFields(raw, {
    city: input.city,
    country: input.country,
  });

  if (resolved.preferredSlug) {
    const bySlug = await prisma.track.findUnique({ where: { slug: resolved.preferredSlug } });
    if (bySlug) {
      return prisma.track.update({
        where: { id: bySlug.id },
        data: {
          name: resolved.name,
          city: bySlug.city ?? resolved.city ?? undefined,
          country: bySlug.country ?? resolved.country ?? undefined,
          sourceUrl: bySlug.sourceUrl ?? input.sourceUrl ?? undefined,
        },
      });
    }
  }

  const existing = await prisma.track.findFirst({
    where: {
      name: resolved.name,
      city: resolved.city ?? null,
    },
  });
  if (existing) {
    return prisma.track.update({
      where: { id: existing.id },
      data: {
        country: existing.country ?? resolved.country ?? undefined,
        city: existing.city ?? resolved.city ?? undefined,
        sourceUrl: existing.sourceUrl ?? input.sourceUrl ?? undefined,
      },
    });
  }

  const slug = resolved.preferredSlug ?? (await uniqueTrackSlug(prisma, resolved.name));

  return prisma.track.create({
    data: {
      slug,
      name: resolved.name,
      country: resolved.country ?? undefined,
      city: resolved.city ?? undefined,
      sourceUrl: input.sourceUrl ?? undefined,
    },
  });
}
