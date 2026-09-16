import type { DmPilot } from '../importers/drift-masters.js';
import { fetchDriftMastersArchiveDriverNumbers } from '../importers/drift-masters-archive.js';
import { DM_2020_BIB_BY_NAME } from './drift-masters-2020.js';
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
  2021: {
    'dm-mikolaj-zakrzewski': 888,
    'dm-tor-arne-kvia': 498,
    'dm-felix-lindvall': 36,
    'dm-christopher-bohm': 43,
    'dm-clemens-kauderer': 71,
    'dm-kevin-piskolty': 105,
    'dm-gregor-kavalir': 62,
    'dm-max-cotton': 78,
    'dm-lauri-heinonen': 203,
    'dm-pawel-grosz': 201,
    'dm-nodo-kodua': 113,
    'dm-stavros-grillis': 901,
    'dm-mihkel-norman-tults': 904,
    'dm-rostyslav-rarahovskyi': 976,
    'dm-alexandre-strano': 6,
    'dm-daniel-brandner': 797,
    'dm-edmunds-berzins': 903,
    'dm-kristians-burkovs': 905,
    'dm-clint-van-oort': 599,
    'dm-raivis-alksars': 906,
    'dm-ao-vaida': 907,
    'dm-edgars-krogeris': 908,
    'dm-milos-djordjevic': 209,
    'dm-pawel-korpulinski': 74,
    'dm-juha-poytalaakso': 212,
    'dm-sebastian-fontijn': 85,
    'dm-juha-rintanen': 202,
    'dm-krzysztof-romanowski': 22,
    'dm-norbert-zamecz': 99,
    'dm-calin-ciortan': 14,
    'dm-dmitriy-illyuk': 200,
    'dm-stephen-biagioni': 13,
    'dm-max-miller': 210,
    'dm-niko-maattala': 88,
    'dm-mevlud-meladze': 113,
    'dm-andrius-vasiliauskas': 999,
    'dm-pawel-borkowski': 214,
    'dm-piotr-kozlowski': 1,
    'dm-sebastian-szymanski': 208,
    'dm-adam-nagy': 288,
    'dm-maciej-jarkiewicz': 204,
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

/** Reuse stable DMEC bibs from the 2020 entry list when Wayback /drivers is unavailable. */
export function applyCrossSeasonBibCatalog(pilots: DmPilot[]): number {
  let applied = 0;
  for (const pilot of pilots) {
    if (pilot.number != null) continue;
    const hits = Object.entries(DM_2020_BIB_BY_NAME).filter(([name]) =>
      pilotMatchesArchiveDriver(pilot, name),
    );
    if (hits.length !== 1) continue;
    pilot.number = hits[0]![1];
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
