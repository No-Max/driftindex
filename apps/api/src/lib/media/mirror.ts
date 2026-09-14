import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { SeriesLogoSource } from '../../data/series-logos.js';
import {
  getMediaRoot,
  pilotSeriesPortraitRelativePath,
  seriesLogoRelativePath,
  toPublicMediaPath,
} from './config.js';

export interface MirroredPhoto {
  photoUrl: string | null;
  photoSourceUrl: string | null;
  photoUpdatedAt: Date | null;
}

export async function mirrorPilotSeriesPortrait(
  pilotSlug: string,
  seriesSlug: string,
  sourceUrl: string | null,
): Promise<MirroredPhoto> {
  if (!sourceUrl) {
    return { photoUrl: null, photoSourceUrl: null, photoUpdatedAt: null };
  }

  const relativePath = pilotSeriesPortraitRelativePath(pilotSlug, seriesSlug);
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
    console.warn(`Failed to mirror pilot photo ${pilotSlug}/${seriesSlug}:`, error);
    return { photoUrl: null, photoSourceUrl: sourceUrl, photoUpdatedAt: null };
  }
}

export interface MirroredSeriesLogo {
  logoUrl: string | null;
  logoSourceUrl: string | null;
}

export async function mirrorSeriesLogo(
  seriesSlug: string,
  source: SeriesLogoSource,
): Promise<MirroredSeriesLogo> {
  const relativePath = seriesLogoRelativePath(seriesSlug);
  const destPath = path.join(getMediaRoot(), relativePath);
  await fs.mkdir(path.dirname(destPath), { recursive: true });

  try {
    const buffer = source.localPath
      ? await fs.readFile(source.localPath)
      : Buffer.from(await (async () => {
          const response = await fetch(source.sourceUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.arrayBuffer();
        })());
    let pipeline = sharp(buffer, { density: 300 });
    if (source.crop) {
      pipeline = pipeline.extract(source.crop);
    }

    if (source.trim !== false) {
      pipeline = pipeline.trim({ threshold: 10 });
    }

    await pipeline
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 90 })
      .toFile(destPath);

    return {
      logoUrl: toPublicMediaPath(relativePath),
      logoSourceUrl: source.sourceUrl,
    };
  } catch (error) {
    console.warn(`Failed to mirror series logo ${seriesSlug}:`, error);
    return { logoUrl: null, logoSourceUrl: source.sourceUrl };
  }
}
