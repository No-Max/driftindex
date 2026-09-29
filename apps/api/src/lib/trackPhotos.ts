import fs from 'node:fs/promises';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import type { TrackPhoto as TrackPhotoDto } from '@drift-index/shared';
import { getMediaRoot } from './media/config.js';
import type { MirroredPhoto } from './media/mirror.js';
import { mirrorTrackPhotoFromLocal } from './media/mirror.js';

export type TrackPhotoRow = Pick<TrackPhotoDto, 'photoUrl' | 'sourceUrl'>;

export function toTrackPhotoDto(row: { photoUrl: string; sourceUrl: string | null }): TrackPhotoDto {
  return {
    photoUrl: row.photoUrl,
    sourceUrl: row.sourceUrl,
  };
}

export async function nextTrackGalleryIndex(prisma: PrismaClient, trackId: string): Promise<number> {
  const count = await prisma.trackPhoto.count({ where: { trackId } });
  return count + 1;
}

/** Remove gallery rows and mirrored files for a track (legacy + tracks/{slug}/*). */
export async function clearTrackGallery(
  prisma: PrismaClient,
  trackId: string,
  trackSlug: string,
): Promise<void> {
  await prisma.trackPhoto.deleteMany({ where: { trackId } });

  const root = getMediaRoot();
  const legacy = path.join(root, 'tracks', `${trackSlug}.webp`);
  await fs.unlink(legacy).catch(() => undefined);

  const galleryDir = path.join(root, 'tracks', trackSlug);
  try {
    const entries = await fs.readdir(galleryDir);
    await Promise.all(
      entries.map((name) => fs.unlink(path.join(galleryDir, name)).catch(() => undefined)),
    );
    await fs.rmdir(galleryDir).catch(() => undefined);
  } catch {
    // no gallery dir
  }

  await prisma.track.update({
    where: { id: trackId },
    data: { photoUrl: null },
  });
}

export async function syncTrackCoverPhoto(prisma: PrismaClient, trackId: string): Promise<void> {
  const first = await prisma.trackPhoto.findFirst({
    where: { trackId },
    orderBy: { sortOrder: 'asc' },
  });
  await prisma.track.update({
    where: { id: trackId },
    data: { photoUrl: first?.photoUrl ?? null },
  });
}

export async function appendTrackPhotoFromMirror(
  prisma: PrismaClient,
  trackId: string,
  mirrored: MirroredPhoto,
): Promise<TrackPhotoRow | null> {
  if (!mirrored.photoUrl) return null;

  const sortOrder = await prisma.trackPhoto.count({ where: { trackId } });
  await prisma.trackPhoto.create({
    data: {
      trackId,
      photoUrl: mirrored.photoUrl,
      sourceUrl: mirrored.photoSourceUrl,
      sortOrder,
    },
  });
  await syncTrackCoverPhoto(prisma, trackId);
  return { photoUrl: mirrored.photoUrl, sourceUrl: mirrored.photoSourceUrl };
}

export async function appendTrackPhotoFromLocalFile(
  prisma: PrismaClient,
  trackSlug: string,
  localPath: string,
  photoSourceUrl?: string,
): Promise<TrackPhotoRow | null> {
  const track = await prisma.track.findUnique({ where: { slug: trackSlug } });
  if (!track) return null;

  const galleryIndex = await nextTrackGalleryIndex(prisma, track.id);
  const mirrored = await mirrorTrackPhotoFromLocal(
    trackSlug,
    localPath,
    photoSourceUrl,
    galleryIndex,
  );
  return appendTrackPhotoFromMirror(prisma, track.id, mirrored);
}

export async function loadTrackPhotosForProfile(
  prisma: PrismaClient,
  trackId: string,
  fallbackPhotoUrl: string | null,
): Promise<TrackPhotoDto[]> {
  const rows = await prisma.trackPhoto.findMany({
    where: { trackId },
    orderBy: { sortOrder: 'asc' },
    select: { photoUrl: true, sourceUrl: true },
  });
  if (rows.length > 0) {
    return rows.map(toTrackPhotoDto);
  }
  if (fallbackPhotoUrl) {
    return [{ photoUrl: fallbackPhotoUrl, sourceUrl: null }];
  }
  return [];
}
