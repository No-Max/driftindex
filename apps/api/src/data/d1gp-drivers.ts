import { D1GP_DRIVER_BY_RANKING_NAME } from './d1gp-driver-overrides.js';
import { D1GP_2026_DRIVERS } from './d1gp-2026-drivers.js';

export type D1gpDriverInfo = {
  firstName: string;
  lastName: string;
  nameJa: string;
  country: string | null;
};

/** Car number → English name; stable across D1GP seasons. */
export const D1GP_KNOWN_DRIVERS: Record<number, D1gpDriverInfo> = { ...D1GP_2026_DRIVERS };

function normalizeJaName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function jaNamesMatch(a: string, b: string): boolean {
  return normalizeJaName(a).replace(/\s/g, '') === normalizeJaName(b).replace(/\s/g, '');
}

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
  const rankingJa = normalizeJaName(nameJa);
  const byRankingName = D1GP_DRIVER_BY_RANKING_NAME[rankingJa];
  if (byRankingName) {
    return { ...byRankingName, nameJa: rankingJa };
  }

  const known = D1GP_KNOWN_DRIVERS[number];
  if (known && (!known.nameJa || jaNamesMatch(known.nameJa, rankingJa))) {
    return { ...known, nameJa: rankingJa };
  }

  const latin = parseLatinDriverName(nameJa);
  if (latin) {
    D1GP_KNOWN_DRIVERS[number] = latin;
    return latin;
  }

  const parts = rankingJa.split(/\s+/);
  const lastName = parts[0] ?? rankingJa;
  const firstName = parts.slice(1).join(' ') || lastName;
  return {
    firstName,
    lastName,
    nameJa: rankingJa,
    country: 'JP',
  };
}
