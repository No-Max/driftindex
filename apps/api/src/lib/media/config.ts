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

export function pilotPortraitRelativePath(slug: string): string {
  return `pilots/${slug}.webp`;
}
