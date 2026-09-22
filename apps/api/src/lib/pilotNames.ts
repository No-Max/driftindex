import type { Pilot, PrismaClient } from '@prisma/client';
import { PILOT_DISPLAY_NAME_OVERRIDES } from '../data/pilot-display-name-overrides.js';
import { PILOT_NAME_OVERRIDES } from '../data/pilot-name-overrides.js';
import { newestSeriesAliasNameByPilotIds } from './pilotSeriesAlias.js';
import { lookupByPilotSlug } from './pilotSlug.js';
import { buildNameKey, toEnglishPilotNames } from './transliterate.js';

export type PilotForDisplay = Pick<Pilot, 'id' | 'slug' | 'firstName' | 'lastName'>;

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
  options?: { nameAlias?: string | null },
): { firstName: string; lastName: string } {
  const override =
    lookupByPilotSlug(PILOT_DISPLAY_NAME_OVERRIDES, pilot.slug) ??
    lookupByPilotSlug(PILOT_NAME_OVERRIDES, pilot.slug);
  if (override) return override;

  const firstName = pilot.firstName.trim();
  const lastName = pilot.lastName.trim();
  if (firstName || lastName) {
    return { firstName: pilot.firstName, lastName: pilot.lastName };
  }

  if (options?.nameAlias?.trim()) {
    return toEnglishPilotNames({ firstName: '', lastName: '', nameAlias: options.nameAlias });
  }

  return { firstName: pilot.firstName, lastName: pilot.lastName };
}

/** Omit empty names on update so a bad parse does not wipe existing values. */
export function pilotNameFieldsForUpsert(names: { firstName: string; lastName: string }): {
  firstName?: string;
  lastName?: string;
} {
  const firstName = names.firstName.trim();
  const lastName = names.lastName.trim();
  if (!firstName && !lastName) return {};
  return { firstName: names.firstName, lastName: names.lastName };
}

export function pilotNeedsSeriesAliasFallback(pilot: Pick<Pilot, 'firstName' | 'lastName'>): boolean {
  return !pilot.firstName.trim() && !pilot.lastName.trim();
}

export async function seriesAliasMapForPilots(
  prisma: PrismaClient,
  pilots: PilotForDisplay[],
): Promise<Map<string, string>> {
  const ids = [...new Set(pilots.filter(pilotNeedsSeriesAliasFallback).map((p) => p.id))];
  return newestSeriesAliasNameByPilotIds(prisma, ids);
}

export function resolvePilotDisplayNamesWithAliasMap(
  pilot: PilotForDisplay,
  aliasByPilotId: ReadonlyMap<string, string>,
): { firstName: string; lastName: string } {
  const nameAlias = pilotNeedsSeriesAliasFallback(pilot) ? aliasByPilotId.get(pilot.id) : undefined;
  return resolvePilotDisplayNames(pilot, nameAlias != null ? { nameAlias } : undefined);
}

/** Names to persist on Pilot — includes series alias when slug overrides and Latin fields are empty. */
export async function canonicalStoredPilotNames(
  prisma: PrismaClient,
  pilot: Pilot,
): Promise<{ firstName: string; lastName: string }> {
  const english = canonicalEnglishNames(pilot);
  if (english.firstName.trim() || english.lastName.trim()) return english;

  const alias = await prisma.pilotSeriesAlias.findFirst({
    where: { pilotId: pilot.id },
    orderBy: { updatedAt: 'desc' },
    select: { name: true },
  });
  if (alias?.name.trim()) {
    return toEnglishPilotNames({ firstName: '', lastName: '', nameAlias: alias.name });
  }

  return english;
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
