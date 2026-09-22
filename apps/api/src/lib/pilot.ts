import type { Pilot } from '@prisma/client';
import { preferredSeriesPhotoUrl } from './media/pilotPhoto.js';
import { resolvePilotDisplayNames } from './pilotNames.js';

export function toPilotCard(
  pilot: Pilot,
  number?: number | null,
  seriesPhotos?: Array<{ seriesSlug: string; photoUrl: string | null }>,
  display?: { nameAlias?: string | null },
) {
  const { firstName, lastName } = resolvePilotDisplayNames(pilot, display);
  const preferUrl = preferredSeriesPhotoUrl(pilot.slug, seriesPhotos ?? []);

  return {
    slug: pilot.slug,
    firstName,
    lastName,
    country: pilot.country,
    number: number ?? pilot.number,
    photoUrl: preferUrl ?? pilot.photoUrl,
  };
}

export function pilotInitials(pilot: Pick<Pilot, 'firstName' | 'lastName'>) {
  return `${pilot.firstName[0] ?? ''}${pilot.lastName[0] ?? ''}`.toUpperCase();
}
