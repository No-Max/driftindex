/**
 * Prefer a specific series portrait as the pilot's primary avatar and as a stand-in
 * when another series mirror is missing (e.g. Drift Masters placeholder).
 */
export const PILOT_PHOTO_SERIES_PREFER: Record<string, string> = {
  'dm-tomas-kiely': 'rds-gp',
};

/** Series slugs whose stored portrait should display the preferred series photo instead. */
export const PILOT_PHOTO_SERIES_ALIAS: Record<string, string[]> = {
  'dm-tomas-kiely': ['drift-masters'],
};

/** Mirrored prefer-series portrait when primary is stale or missing on disk. */
export const PILOT_PHOTO_PREFER_URL: Partial<Record<string, string>> = {
  'dm-tomas-kiely': '/media/pilots/rds-37718/rds-gp.webp',
};
