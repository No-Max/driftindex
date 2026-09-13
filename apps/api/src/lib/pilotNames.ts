import type { Pilot } from '@prisma/client';
import { buildNameKey, toEnglishPilotNames } from './transliterate.js';

export interface PilotNameFields {
  firstName: string;
  lastName: string;
  nameAlias?: string | null;
}

export function canonicalEnglishNames(pilot: PilotNameFields): { firstName: string; lastName: string } {
  return toEnglishPilotNames(pilot);
}

export function pilotNameKey(pilot: PilotNameFields): string {
  return buildNameKey(pilot.firstName, pilot.lastName, pilot.nameAlias);
}

/** Prefer rdsgp numeric slug, then royal-ds style, then almanac. */
export function canonicalPilotSlugPriority(slug: string): number {
  if (/^rds-\d+$/.test(slug)) return 100;
  if (/^[a-z]+-[a-z-]+-\d+$/i.test(slug)) return 80;
  if (slug.startsWith('da-')) return 40;
  return 60;
}

export function pickCanonicalPilot<T extends Pilot>(pilots: T[]): T {
  return [...pilots].sort((a, b) => {
    const slugDiff = canonicalPilotSlugPriority(b.slug) - canonicalPilotSlugPriority(a.slug);
    if (slugDiff !== 0) return slugDiff;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0]!;
}
