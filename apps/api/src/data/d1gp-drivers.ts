import { D1GP_2026_DRIVERS } from './d1gp-2026-drivers.js';

export type D1gpDriverInfo = {
  firstName: string;
  lastName: string;
  nameJa: string;
  country: string | null;
};

/** Car number → English name; stable across D1GP seasons. */
export const D1GP_KNOWN_DRIVERS: Record<number, D1gpDriverInfo> = { ...D1GP_2026_DRIVERS };

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/([\s-'])/)
    .map((part) => (/^[a-z]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('');
}

function parseLatinDriverName(nameJa: string): D1gpDriverInfo | null {
  const trimmed = nameJa.trim();
  if (!/^[A-Za-z]/.test(trimmed)) return null;

  const parts = trimmed.split(/\s+/);
  const firstName = titleCase(parts[0] ?? trimmed);
  const lastName = titleCase(parts.slice(1).join(' ') || firstName);
  return { firstName, lastName, nameJa: trimmed, country: null };
}

/** Learn Latin driver names from ranking tables (e.g. Lattapon Keawchin). */
export function registerLatinDriverFromRanking(number: number, nameJa: string): void {
  if (D1GP_KNOWN_DRIVERS[number]) return;
  const parsed = parseLatinDriverName(nameJa);
  if (parsed) D1GP_KNOWN_DRIVERS[number] = parsed;
}

export function resolveD1Driver(number: number, nameJa: string): D1gpDriverInfo {
  const known = D1GP_KNOWN_DRIVERS[number];
  if (known) {
    return { ...known, nameJa: known.nameJa || nameJa };
  }

  const latin = parseLatinDriverName(nameJa);
  if (latin) {
    D1GP_KNOWN_DRIVERS[number] = latin;
    return latin;
  }

  const parts = nameJa.trim().split(/\s+/);
  const lastName = parts[0] ?? nameJa;
  const firstName = parts.slice(1).join(' ') || lastName;
  return {
    firstName,
    lastName,
    nameJa,
    country: 'JP',
  };
}
