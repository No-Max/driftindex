import type { Pilot } from '@prisma/client';

export function toPilotCard(pilot: Pilot) {
  return {
    slug: pilot.slug,
    firstName: pilot.firstName,
    lastName: pilot.lastName,
    country: pilot.country,
    number: pilot.number,
    photoUrl: pilot.photoUrl,
  };
}

export function pilotInitials(pilot: Pick<Pilot, 'firstName' | 'lastName'>) {
  return `${pilot.firstName[0] ?? ''}${pilot.lastName[0] ?? ''}`.toUpperCase();
}
