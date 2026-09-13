import type { TrackSummary } from '@drift-index/shared';

export function toTrackSummary(
  track: {
    slug: string;
    name: string;
    country: string | null;
    city: string | null;
    description: string | null;
    photoUrl: string | null;
  } | null,
): TrackSummary | null {
  if (!track) return null;
  return {
    slug: track.slug,
    name: track.name,
    country: track.country,
    city: track.city,
    description: track.description,
    photoUrl: track.photoUrl,
  };
}
