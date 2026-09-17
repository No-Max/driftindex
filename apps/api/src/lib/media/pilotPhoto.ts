import type { PrismaClient } from '@prisma/client';
import {
  PILOT_PHOTO_PREFER_URL,
  PILOT_PHOTO_SERIES_ALIAS,
  PILOT_PHOTO_SERIES_PREFER,
} from '../../data/pilot-photo-overrides.js';
import { mirrorPilotSeriesPortrait } from './mirror.js';

export function preferredSeriesPhotoUrl(
  pilotSlug: string,
  seriesPhotos: Array<{ seriesSlug: string; photoUrl: string | null }>,
): string | null {
  const preferSlug = PILOT_PHOTO_SERIES_PREFER[pilotSlug];
  if (!preferSlug) return null;
  return (
    seriesPhotos.find((photo) => photo.seriesSlug === preferSlug)?.photoUrl
    ?? PILOT_PHOTO_PREFER_URL[pilotSlug]
    ?? null
  );
}

export function resolveSeriesPhotoUrl(
  pilotSlug: string,
  seriesSlug: string,
  photoUrl: string | null,
  preferUrl: string | null,
): string | null {
  if (!preferUrl) return photoUrl;
  const aliasSeries = PILOT_PHOTO_SERIES_ALIAS[pilotSlug];
  if (aliasSeries?.includes(seriesSlug)) return preferUrl;
  return photoUrl;
}

export async function upsertPilotSeriesPhoto(
  prisma: PrismaClient,
  params: {
    pilotId: string;
    seriesId: string;
    pilotSlug: string;
    seriesSlug: string;
    photoSourceUrl: string | null;
  },
): Promise<{ mirrored: boolean }> {
  const photo = await mirrorPilotSeriesPortrait(
    params.pilotSlug,
    params.seriesSlug,
    params.photoSourceUrl,
  );

  await prisma.pilotSeriesPhoto.upsert({
    where: {
      pilotId_seriesId: { pilotId: params.pilotId, seriesId: params.seriesId },
    },
    update: {
      photoUrl: photo.photoUrl,
      photoSourceUrl: photo.photoSourceUrl,
      photoUpdatedAt: photo.photoUpdatedAt,
    },
    create: {
      pilotId: params.pilotId,
      seriesId: params.seriesId,
      photoUrl: photo.photoUrl,
      photoSourceUrl: photo.photoSourceUrl,
      photoUpdatedAt: photo.photoUpdatedAt,
    },
  });

  await syncPilotPrimaryPhoto(prisma, params.pilotId);

  return { mirrored: Boolean(photo.photoUrl) };
}

/** Pick the highest-prestige series photo as the pilot's card avatar. */
export async function syncPilotPrimaryPhoto(prisma: PrismaClient, pilotId: string): Promise<void> {
  const pilot = await prisma.pilot.findUnique({
    where: { id: pilotId },
    select: { slug: true },
  });

  const photos = await prisma.pilotSeriesPhoto.findMany({
    where: { pilotId, photoUrl: { not: null } },
    include: { series: { select: { slug: true, featuredOrder: true } } },
  });

  const preferSeriesSlug = pilot ? PILOT_PHOTO_SERIES_PREFER[pilot.slug] : undefined;
  const preferred = preferSeriesSlug
    ? photos.find((photo) => photo.series.slug === preferSeriesSlug)
    : undefined;

  if (preferred?.photoUrl) {
    await prisma.pilot.update({
      where: { id: pilotId },
      data: {
        photoUrl: preferred.photoUrl,
        photoSourceUrl: preferred.photoSourceUrl,
        photoUpdatedAt: preferred.photoUpdatedAt,
      },
    });
    return;
  }

  photos.sort((a, b) => {
    const orderA = a.series.featuredOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.series.featuredOrder ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

  const primary = photos[0];
  await prisma.pilot.update({
    where: { id: pilotId },
    data: {
      photoUrl: primary?.photoUrl ?? null,
      photoSourceUrl: primary?.photoSourceUrl ?? null,
      photoUpdatedAt: primary?.photoUpdatedAt ?? null,
    },
  });
}
