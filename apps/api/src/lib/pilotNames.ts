import type { Pilot } from '@prisma/client';
import { PILOT_DISPLAY_NAME_OVERRIDES } from '../data/pilot-display-name-overrides.js';
import { PILOT_NAME_OVERRIDES } from '../data/pilot-name-overrides.js';
import { lookupByPilotSlug } from './pilotSlug.js';
import { buildNameKey, toEnglishPilotNames } from './transliterate.js';

export interface PilotNameFields {
  firstName: string;
  lastName: string;
  nameAlias?: string | null;
}

export function canonicalEnglishNames(
  pilot: PilotNameFields & { slug?: string },
): { firstName: string; lastName: string } {
  if (pilot.slug) {
    const override =
      lookupByPilotSlug(PILOT_DISPLAY_NAME_OVERRIDES, pilot.slug) ??
      lookupByPilotSlug(PILOT_NAME_OVERRIDES, pilot.slug);
    if (override) return override;
  }
  return toEnglishPilotNames(pilot);
}

export function resolvePilotDisplayNames(
  pilot: Pick<Pilot, 'slug' | 'firstName' | 'lastName'>,
): { firstName: string; lastName: string } {
  const override =
    lookupByPilotSlug(PILOT_DISPLAY_NAME_OVERRIDES, pilot.slug) ??
    lookupByPilotSlug(PILOT_NAME_OVERRIDES, pilot.slug);
  if (override) return override;
  return { firstName: pilot.firstName, lastName: pilot.lastName };
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
