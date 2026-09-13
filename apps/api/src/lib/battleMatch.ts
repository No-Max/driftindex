import type { Pilot } from '@prisma/client';
import { buildNameKey, containsCyrillic, normalizeToken, transliterate } from './transliterate.js';

export interface BattlePilotRef {
  number: number | null;
  name: string;
  isWinner: boolean;
}

export interface ParsedShortName {
  lastName: string;
  firstInitial: string | null;
}

export interface BattleMatchContext {
  qualPositionByPilotId?: Map<string, number | null>;
}

/** «Козлов А.» / «Kiely T.» → tokens for matching. */
export function parseShortPilotName(raw: string): ParsedShortName | null {
  const trimmed = raw.trim().replace(/\.$/, '');
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { lastName: parts[0]!, firstInitial: null };
  }

  const lastToken = parts[parts.length - 1]!;
  const firstInitial = lastToken.length <= 2 ? lastToken.charAt(0) : null;
  const lastName = firstInitial != null ? parts.slice(0, -1).join(' ') : trimmed;

  return {
    lastName,
    firstInitial: firstInitial?.toUpperCase() ?? null,
  };
}

/** Known surname spelling variants across sources (Almanac vs rdsgp). */
const SURNAME_ALIASES: string[][] = [
  ['kiely', 'kaili', 'kayli', 'kayly'],
  ['bluss', 'blushs', 'blus'],
  ['tuerck', 'turck', 'tuerick'],
  ['valdma', 'waldma'],
  ['deane', 'dean'],
  ['shanahan', 'shannahan'],
  ['kawabata', 'kawabata'],
  ['hibino', 'hibinu'],
  ['field', 'feild'],
  ['puchinin', 'puchinin', 'puchynin'],
  ['loginov', 'loghinov'],
  ['kondratev', 'kondratyev'],
  ['gorbatenko', 'gorbatenko'],
  ['chivchyan', 'chivchian', 'chivchan'],
  ['pustoshny', 'pustoshnyi', 'pustosnyi'],
  ['pesegov', 'pesehov'],
  ['stepanyan', 'stepanian'],
  ['bekerman', 'bekermann'],
  ['kharitonov', 'haritonov'],
  ['valis', 'valys'],
];

function surnameOnlyMatch(
  pilot: BattlePilotCandidate,
  short: ParsedShortName,
): boolean {
  return lastNameMatches(pilotNameTokens(pilot), short);
}

export function normalizeBattleName(raw: string): string {
  const short = parseShortPilotName(raw);
  return canonicalSurnameToken(normalizeToken(short?.lastName ?? raw));
}

export function canonicalSurnameToken(token: string): string {
  for (const group of SURNAME_ALIASES) {
    if (group.some((alias) => alias === token || tokensSimilar(alias, token))) {
      return group[0]!;
    }
  }
  return token;
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(matrix[j]! + 1, prev + 1, matrix[j - 1]! + cost);
      matrix[j - 1] = prev;
      prev = next;
    }
    matrix[b.length] = prev;
  }
  return matrix[b.length]!;
}

/** Fuzzy compare for transliterated surname tokens (Kiely/Kaili, Blušs/Blushs). */
export function tokensSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;

  const minLen = Math.min(a.length, b.length);
  if (minLen >= 4 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)))) {
    return true;
  }

  const maxLen = Math.max(a.length, b.length);
  const maxDistance = maxLen <= 4 ? 1 : 2;
  return levenshtein(a, b) <= maxDistance;
}

export type BattlePilotCandidate = Pick<Pilot, 'firstName' | 'lastName'> & {
  seriesAliases?: Array<{ name: string }>;
};

function pilotNameTokens(pilot: BattlePilotCandidate): string[] {
  return [
    ...buildNameKey(pilot.firstName, pilot.lastName, null).split('|'),
    ...(pilot.seriesAliases ?? []).flatMap((alias) => buildNameKey('', alias.name, alias.name).split('|')),
  ].filter(Boolean);
}

function lastNameMatches(tokens: string[], short: ParsedShortName): boolean {
  const lastNorm = canonicalSurnameToken(normalizeToken(short.lastName));
  return tokens.some((token) => {
    const canonical = canonicalSurnameToken(token);
    return canonical === lastNorm || tokensSimilar(canonical, lastNorm);
  });
}

function firstInitialMatches(
  pilot: BattlePilotCandidate,
  initial: string,
): boolean {
  const init = normalizeToken(initial);
  if (!init) return true;

  for (const alias of pilot.seriesAliases ?? []) {
    if (!containsCyrillic(alias.name)) continue;
    const parts = alias.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const firstNameRu = normalizeToken(parts.slice(1).join(''));
      if (firstNameRu.startsWith(init)) return true;
    }
  }

  const firstLatin = normalizeToken(pilot.firstName);
  if (firstLatin.startsWith(init)) return true;

  const transliteratedShort = normalizeToken(transliterate(initial));
  return transliteratedShort.length > 0 && firstLatin.startsWith(transliteratedShort);
}

function pilotMatchesShortName(
  pilot: BattlePilotCandidate,
  short: ParsedShortName,
): boolean {
  const tokens = pilotNameTokens(pilot);
  if (tokens.length < 2) return false;
  if (!lastNameMatches(tokens, short)) return false;
  if (!short.firstInitial) return true;
  return firstInitialMatches(pilot, short.firstInitial);
}

function pickBestMatch<T extends Pick<Pilot, 'id' | 'number' | 'firstName' | 'lastName'> & BattlePilotCandidate>(
  matches: T[],
): T | null {
  if (matches.length === 1) return matches[0]!;
  return null;
}

/** Fill missing car numbers only when a single number is known for that name on the event. */
export function enrichBattleNumbers(duels: Array<[BattlePilotRef, BattlePilotRef]>): Array<[BattlePilotRef, BattlePilotRef]> {
  const numbersByName = new Map<string, Set<number>>();

  for (const duel of duels) {
    for (const pilot of duel) {
      if (pilot.number == null) continue;
      const key = normalizeBattleName(pilot.name);
      const numbers = numbersByName.get(key) ?? new Set<number>();
      numbers.add(pilot.number);
      numbersByName.set(key, numbers);
    }
  }

  return duels.map(
    (duel) =>
      duel.map((pilot) => {
        if (pilot.number != null) return pilot;
        const numbers = numbersByName.get(normalizeBattleName(pilot.name));
        const inferred = numbers?.size === 1 ? [...numbers][0]! : null;
        return { ...pilot, number: inferred };
      }) as [BattlePilotRef, BattlePilotRef],
  );
}

/** Match a battle row to an event participant by car number and/or abbreviated name. */
export function matchBattlePilot<T extends Pick<Pilot, 'id' | 'number' | 'firstName' | 'lastName'> & BattlePilotCandidate>(
  ref: Pick<BattlePilotRef, 'number' | 'name'>,
  participants: T[],
  context?: BattleMatchContext,
): T | null {
  const short = parseShortPilotName(ref.name);

  if (ref.number != null) {
    const byNumber = participants.filter((pilot) => pilot.number === ref.number);
    if (byNumber.length === 1) return byNumber[0]!;
    if (byNumber.length > 1 && short) {
      const narrowed = byNumber.filter((pilot) => pilotMatchesShortName(pilot, short));
      const picked = pickBestMatch(narrowed);
      if (picked) return picked;
    }
    // Almanac car numbers can differ from rdsgp — fall through to name match.
  }

  if (!short) return null;

  const strictMatches = participants.filter((pilot) => pilotMatchesShortName(pilot, short));
  const strictPick = pickBestMatch(strictMatches);
  if (strictPick) return strictPick;

  const surnameMatches = participants.filter((pilot) => surnameOnlyMatch(pilot, short));
  if (surnameMatches.length === 1) return surnameMatches[0]!;

  // Never guess between same-surname pilots (e.g. Anton vs Aleksei Kozlov).
  return null;
}
