import type { DmPilot } from '../importers/drift-masters.js';
import { fetchDriftMastersArchiveDriverNumbers } from '../importers/drift-masters-archive.js';
import { buildNameKey, normalizeToken } from '../lib/transliterate.js';

/** Start numbers missing from archived standings (guests, wildcards). Keyed by pilot slug. */
export const DM_ARCHIVE_PILOT_NUMBERS: Record<number, Record<string, number>> = {
  2019: {
    /** Riga wildcard bib (not on season drivers page). */
    'dm-georgy-chivchyan': 31,
    /** Not listed on archived /drivers (same bibs as DMEC 2020 where applicable). */
    'dm-piotr-wiecek': 215,
    'dm-kristaps-bluss': 80,
    'dm-aurimas-vaskelis': 650,
    'dm-ivo-cirulis': 620,
    'dm-janis-jurka': 604,
  },
};

function parseDriverPageName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = fullName
    .replace(/[“”"«»][^"”]*[“”"«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const only = parts[0]!;
    return { firstName: only, lastName: only };
  }
  const lastName = parts[parts.length - 1]!;
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, lastName };
}

function lastNamesMatch(left: string, right: string): boolean {
  const a = normalizeToken(left);
  const b = normalizeToken(right);
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function firstNamesMatch(left: string, right: string): boolean {
  const a = normalizeToken(left);
  const b = normalizeToken(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const prefixLength = Math.min(3, a.length, b.length);
  return a.slice(0, prefixLength) === b.slice(0, prefixLength);
}

function pilotMatchesArchiveDriver(pilot: DmPilot, driverName: string): boolean {
  const { firstName, lastName } = parseDriverPageName(driverName);
  const driverKey = buildNameKey(firstName, lastName, driverName);
  const pilotKey = buildNameKey(pilot.firstName, pilot.lastName, pilot.nameAlias);
  if (driverKey === pilotKey) return true;
  return lastNamesMatch(pilot.lastName, lastName) && firstNamesMatch(pilot.firstName, firstName);
}

/** Match archived /drivers page bibs to season pilots (RawMotion qual is keyed by bib). */
export async function applyArchiveDriverNumbersFromWayback(
  seasonYear: number,
  pilots: DmPilot[],
): Promise<number> {
  const drivers = await fetchDriftMastersArchiveDriverNumbers(seasonYear);
  if (!drivers.length) return 0;

  let applied = 0;
  for (const driver of drivers) {
    const matches = pilots.filter(
      (entry) => entry.number == null && pilotMatchesArchiveDriver(entry, driver.name),
    );
    if (matches.length !== 1) continue;
    matches[0]!.number = driver.number;
    applied++;
  }
  return applied;
}

export function applyArchivePilotNumbers(seasonYear: number, pilots: DmPilot[]): void {
  const overrides = DM_ARCHIVE_PILOT_NUMBERS[seasonYear];
  if (!overrides) return;

  for (const pilot of pilots) {
    const number = overrides[pilot.slug];
    if (number != null && pilot.number == null) {
      pilot.number = number;
    }
  }
}
