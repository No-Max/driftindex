import type { PrismaClient } from '@prisma/client';
import { mirrorPilotSeriesPortrait } from './mirror.js';

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
  const photos = await prisma.pilotSeriesPhoto.findMany({
    where: { pilotId, photoUrl: { not: null } },
    include: { series: { select: { featuredOrder: true } } },
  });

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
