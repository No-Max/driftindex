import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  getMediaRoot,
  pilotPortraitRelativePath,
  toPublicMediaPath,
} from './config.js';

export interface MirroredPhoto {
  photoUrl: string | null;
  photoSourceUrl: string | null;
  photoUpdatedAt: Date | null;
}

export async function mirrorPilotPortrait(
  slug: string,
  sourceUrl: string | null,
): Promise<MirroredPhoto> {
  if (!sourceUrl) {
    return { photoUrl: null, photoSourceUrl: null, photoUpdatedAt: null };
  }

  const relativePath = pilotPortraitRelativePath(slug);
  const destPath = path.join(getMediaRoot(), relativePath);
  await fs.mkdir(path.dirname(destPath), { recursive: true });

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await sharp(buffer)
      .rotate()
      .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(destPath);

    return {
      photoUrl: toPublicMediaPath(relativePath),
      photoSourceUrl: sourceUrl,
      photoUpdatedAt: new Date(),
    };
  } catch (error) {
    console.warn(`Failed to mirror pilot photo ${slug}:`, error);
    return { photoUrl: null, photoSourceUrl: sourceUrl, photoUpdatedAt: null };
  }
}
