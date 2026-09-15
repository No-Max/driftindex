import type { Pilot } from '@prisma/client';
import { resolvePilotDisplayNames } from './pilotNames.js';

export function toPilotCard(pilot: Pilot, number?: number | null) {
  const { firstName, lastName } = resolvePilotDisplayNames(pilot);
  return {
    slug: pilot.slug,
    firstName,
    lastName,
    country: pilot.country,
    number: number ?? pilot.number,
    photoUrl: pilot.photoUrl,
  };
}

export function pilotInitials(pilot: Pick<Pilot, 'firstName' | 'lastName'>) {
  return `${pilot.firstName[0] ?? ''}${pilot.lastName[0] ?? ''}`.toUpperCase();
}
