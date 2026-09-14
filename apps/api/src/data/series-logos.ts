import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = path.dirname(fileURLToPath(import.meta.url));

export interface SeriesLogoSource {
  sourceUrl: string;
  /** Read logo from repo instead of fetching sourceUrl. */
  localPath?: string;
  /** Optional crop before resize (wide banners). */
  crop?: { left: number; top: number; width: number; height: number };
  /** Trim empty borders before resize; off for full-width header art. */
  trim?: boolean;
}

/** Official or site-hosted logo sources for featured series. */
export const SERIES_LOGO_SOURCES: Record<string, SeriesLogoSource> = {
  'formula-drift-pro': {
    sourceUrl: 'https://www.formulad.com/fd-emblem.svg',
  },
  'drift-masters': {
    sourceUrl: 'https://dm.gp/media/aumngazr/logo-1.svg',
  },
  d1gp: {
    sourceUrl: 'https://d1gp.co.jp/wp-content/uploads/2021/02/cropped-d1gp_logo_512_512-192x192.png',
  },
  'rds-gp': {
    sourceUrl: 'https://rdsgp.com/themes/vdrifte2/images/header2026.png',
    trim: false,
  },
  'royal-ds': {
    sourceUrl: 'https://royalds.cn/en',
    localPath: path.join(dataDir, 'royal-ds-crown.svg'),
  },
  'drift-kings': {
    sourceUrl: 'https://driftkings.com/wp-content/uploads/2024/03/weblogo.webp',
  },
};
