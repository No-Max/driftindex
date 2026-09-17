import path from 'node:path';
import { fileURLToPath } from 'node:url';

const libDir = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to media storage root (repo: storage/media). */
export function getMediaRoot(): string {
  if (process.env.MEDIA_ROOT) {
    return path.resolve(process.env.MEDIA_ROOT);
  }
  return path.resolve(libDir, '../../../../storage/media');
}

/** URL prefix served to clients, e.g. /media */
export function getMediaPublicBase(): string {
  return (process.env.MEDIA_PUBLIC_BASE ?? '/media').replace(/\/$/, '');
}

export function toPublicMediaPath(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, '');
  return `${getMediaPublicBase()}/${normalized}`;
}

/** One portrait per pilot per series: pilots/{pilotSlug}/{seriesSlug}.webp */
export function pilotSeriesPortraitRelativePath(pilotSlug: string, seriesSlug: string): string {
  return `pilots/${pilotSlug}/${seriesSlug}.webp`;
}

/** One logo per series: series/{seriesSlug}.webp */
export function seriesLogoRelativePath(seriesSlug: string): string {
  return `series/${seriesSlug}.webp`;
}

/** One cover photo per track: tracks/{trackSlug}.webp */
export function trackPhotoRelativePath(trackSlug: string): string {
  return `tracks/${trackSlug}.webp`;
}
