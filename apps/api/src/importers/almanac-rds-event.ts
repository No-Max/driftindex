import * as cheerio from 'cheerio';
import { canonicalSurnameToken, tokensSimilar } from '../lib/battleMatch.js';
import { buildNameKey, englishNamesFromNameRu, isLatinName, normalizeToken } from '../lib/transliterate.js';
import { listAlmanacRdsEvents } from './rds-almanac.js';
import { isPlausibleRdsQualRunScore, parseQualRunScore } from './rds-gp.js';

const BASE = 'https://driftalmanac.ru';

export interface AlmanacRdsQualRow {
  almanacPilotSlug: string;
  nameAlias: string;
  qualPosition: number;
  qualScore100: number | null;
}

export interface AlmanacRdsResultRow {
  almanacPilotSlug: string;
  nameAlias: string;
  tandemPosition: number;
  points: number;
}

export interface AlmanacRdsEventDetails {
  almanacEventId: string;
  qualification: AlmanacRdsQualRow[];
  results: AlmanacRdsResultRow[];
}

function pilotSlugFromHref(href: string | undefined): string | null {
  return href?.match(/\/pilot\/([^/?#]+)/)?.[1] ?? null;
}

function parseAlmanacRunCell(raw: string): number | null {
  const parsed = parseQualRunScore(raw);
  if (parsed == null || !isPlausibleRdsQualRunScore(parsed, raw)) return null;
  return parsed;
}

function qualRunColumns($: cheerio.CheerioAPI): { run1Index: number; run2Index: number | null } {
  const headers = $('table')
    .first()
    .find('th')
    .map((_, th) => $(th).text().trim().toUpperCase())
    .get();
  const run1Index = headers.findIndex((header) => header === 'RUN1' || header.startsWith('RUN 1'));
  const run2Index = headers.findIndex((header) => header === 'RUN2' || header.startsWith('RUN 2'));
  return {
    run1Index: run1Index >= 0 ? run1Index : 2,
    run2Index: run2Index >= 0 ? run2Index : null,
  };
}

function bestQualScore(run1: string, run2: string | null): number | null {
  const scores = [parseAlmanacRunCell(run1), run2 ? parseAlmanacRunCell(run2) : null].filter(
    (value): value is number => value != null,
  );
  if (scores.length === 0) return null;
  return Math.max(...scores);
}

/** Parse Drift Almanac /event/{id}/qualification table. */
export function parseAlmanacRdsQualificationHtml(html: string): AlmanacRdsQualRow[] {
  const $ = cheerio.load(html);
  const rows: AlmanacRdsQualRow[] = [];
  const { run1Index, run2Index } = qualRunColumns($);

  $('table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 4) return;

    const pilotLink = $(tr).find('a[href*="/pilot/"]').first();
    const almanacPilotSlug = pilotSlugFromHref(pilotLink.attr('href'));
    const nameAlias = pilotLink.text().trim();
    if (!almanacPilotSlug || !nameAlias) return;

    const qualPosition = Number.parseInt($(cells.eq(0)).text().trim(), 10);
    if (!Number.isFinite(qualPosition) || qualPosition <= 0) return;

    const run1 = $(cells.eq(run1Index)).text().trim();
    const run2 = run2Index != null ? $(cells.eq(run2Index)).text().trim() : null;

    rows.push({
      almanacPilotSlug,
      nameAlias,
      qualPosition,
      qualScore100: bestQualScore(run1, run2),
    });
  });

  return rows;
}

/** Parse Drift Almanac /event/{id}/results personal standings (first table). */
export function parseAlmanacRdsResultsHtml(html: string): AlmanacRdsResultRow[] {
  const $ = cheerio.load(html);
  const table = $('table').first();
  const rows: AlmanacRdsResultRow[] = [];

  table.find('tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 3) return;

    const pilotLink = $(tr).find('a[href*="/pilot/"]').first();
    const almanacPilotSlug = pilotSlugFromHref(pilotLink.attr('href'));
    const nameAlias = pilotLink.text().trim();
    if (!almanacPilotSlug || !nameAlias) return;

    const tandemPosition = Number.parseInt($(cells.eq(0)).text().trim(), 10);
    const points = Number.parseInt($(cells.eq(cells.length - 1)).text().trim(), 10);
    if (!Number.isFinite(tandemPosition) || tandemPosition <= 0) return;

    rows.push({
      almanacPilotSlug,
      nameAlias,
      tandemPosition,
      points: Number.isFinite(points) && points >= 0 ? points : 0,
    });
  });

  return rows;
}

async function fetchHtml(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) return null;
  return response.text();
}

export async function fetchAlmanacRdsEventDetails(
  almanacEventId: string,
): Promise<AlmanacRdsEventDetails | null> {
  const [qualHtml, resultsHtml] = await Promise.all([
    fetchHtml(`${BASE}/event/${almanacEventId}/qualification`),
    fetchHtml(`${BASE}/event/${almanacEventId}/results`),
  ]);

  if (!qualHtml && !resultsHtml) return null;

  return {
    almanacEventId,
    qualification: qualHtml ? parseAlmanacRdsQualificationHtml(qualHtml) : [],
    results: resultsHtml ? parseAlmanacRdsResultsHtml(resultsHtml) : [],
  };
}

export function almanacPilotDbSlug(almanacPilotSlug: string): string {
  return almanacPilotSlug;
}

export function almanacEventIdFromDbSlug(eventSlug: string): string | null {
  return eventSlug.match(/^da-e(\d+)$/)?.[1] ?? null;
}

export function pilotNamesFromAlmanacRow(nameAlias: string): {
  firstName: string;
  lastName: string;
  nameAlias: string;
} {
  const trimmed = nameAlias.trim();
  return { ...englishNamesFromNameRu(trimmed), nameAlias: trimmed };
}

function dbPilotNameKey(
  firstName: string,
  lastName: string,
  alias: string | null | undefined,
): string {
  if (alias && /[а-яё]/i.test(alias)) {
    const names = pilotNamesFromAlmanacRow(alias);
    return buildNameKey(names.firstName, names.lastName, names.nameAlias);
  }
  return buildNameKey(firstName, lastName, alias);
}

function almanacPilotNameKey(nameAlias: string): string {
  const trimmed = nameAlias.trim();
  const lettersOnly = trimmed.replace(/[^a-zA-Z\u00C0-\u024F\u0400-\u04FF]/g, '');
  if (lettersOnly && isLatinName(lettersOnly) && !/[а-яё]/i.test(trimmed)) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const firstName = parts[0]!;
      const lastName = parts.slice(1).join(' ');
      return buildNameKey(firstName, lastName, trimmed);
    }
  }
  const names = pilotNamesFromAlmanacRow(trimmed);
  return buildNameKey(names.firstName, names.lastName, names.nameAlias);
}

function nameKeysCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  const ta = a.split('|').filter(Boolean).map((token) => canonicalSurnameToken(normalizeToken(token)));
  const tb = b.split('|').filter(Boolean).map((token) => canonicalSurnameToken(normalizeToken(token)));
  let shared = 0;
  for (const xa of ta) {
    if (tb.some((xb) => tokensSimilar(xa, xb))) shared += 1;
  }
  return shared >= 2;
}

export type AlmanacDbEventMapping = Map<string, string>;

function overlapSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const keyA of a) {
    if ([...b].some((keyB) => nameKeysCompatible(keyA, keyB))) count += 1;
  }
  return count;
}

function winnerKeyFromResults(
  rows: Array<{ nameAlias: string; tandemPosition: number }>,
): string | null {
  const winner = rows.find((row) => row.tandemPosition === 1);
  if (!winner) return null;
  return almanacPilotNameKey(winner.nameAlias);
}

export function matchAlmanacEventsToDbEventsByOverlap(
  almanacEvents: Array<{ almanacEventId: string; nameKeys: Set<string>; winnerKey: string | null }>,
  dbEvents: Array<{ eventId: string; nameKeys: Set<string>; winnerKey: string | null }>,
  minOverlap = 6,
): AlmanacDbEventMapping {
  const mapping: AlmanacDbEventMapping = new Map();
  const usedAlmanac = new Set<string>();
  const usedDb = new Set<string>();

  const winnerPairs: Array<{ almanacEventId: string; eventId: string; score: number }> = [];
  for (const almanac of almanacEvents) {
    if (!almanac.winnerKey) continue;
    for (const db of dbEvents) {
      if (!db.winnerKey || !nameKeysCompatible(almanac.winnerKey, db.winnerKey)) continue;
      const score = overlapSize(almanac.nameKeys, db.nameKeys);
      winnerPairs.push({ almanacEventId: almanac.almanacEventId, eventId: db.eventId, score });
    }
  }
  winnerPairs.sort((a, b) => b.score - a.score);
  for (const { almanacEventId, eventId } of winnerPairs) {
    if (usedAlmanac.has(almanacEventId) || usedDb.has(eventId)) continue;
    mapping.set(almanacEventId, eventId);
    usedAlmanac.add(almanacEventId);
    usedDb.add(eventId);
  }

  const scores: Array<{ almanacEventId: string; eventId: string; score: number }> = [];
  for (const almanac of almanacEvents) {
    if (usedAlmanac.has(almanac.almanacEventId)) continue;
    for (const db of dbEvents) {
      if (usedDb.has(db.eventId)) continue;
      if (
        almanac.winnerKey &&
        db.winnerKey &&
        !nameKeysCompatible(almanac.winnerKey, db.winnerKey)
      ) {
        continue;
      }
      const score = overlapSize(almanac.nameKeys, db.nameKeys);
      if (score >= minOverlap) {
        scores.push({ almanacEventId: almanac.almanacEventId, eventId: db.eventId, score });
      }
    }
  }
  scores.sort((a, b) => b.score - a.score);

  for (const { almanacEventId, eventId } of scores) {
    if (mapping.has(almanacEventId) || usedDb.has(eventId)) continue;
    mapping.set(almanacEventId, eventId);
    usedDb.add(eventId);
  }

  return mapping;
}

export async function buildAlmanacToDbEventMapping(
  seasonYear: number,
  dbEvents: Array<{
    id: string;
    roundNumber: number;
    results: Array<{
      tandemPosition: number | null;
      pilot: { firstName: string; lastName: string; seriesAliases: Array<{ name: string }> };
    }>;
  }>,
): Promise<AlmanacDbEventMapping> {
  const almanacEvents = await listAlmanacRdsEvents(seasonYear);
  if (almanacEvents.length === 0) return new Map();

  const almanacPairs: Array<{
    almanacEventId: string;
    nameKeys: Set<string>;
    winnerKey: string | null;
  }> = [];
  for (const meta of almanacEvents) {
    const details = await fetchAlmanacRdsEventDetails(meta.almanacEventId);
    const nameKeys = new Set<string>();
    for (const row of details?.results ?? []) {
      nameKeys.add(almanacPilotNameKey(row.nameAlias));
    }
    for (const row of details?.qualification ?? []) {
      nameKeys.add(almanacPilotNameKey(row.nameAlias));
    }
    almanacPairs.push({
      almanacEventId: meta.almanacEventId,
      nameKeys,
      winnerKey: winnerKeyFromResults(details?.results ?? []),
    });
  }

  const dbPairs = dbEvents.map((event) => {
    const winnerResult = event.results.find((result) => result.tandemPosition === 1);
    const winnerAlias = winnerResult?.pilot.seriesAliases[0]?.name ?? null;
    const winnerKey = winnerResult
      ? dbPilotNameKey(winnerResult.pilot.firstName, winnerResult.pilot.lastName, winnerAlias)
      : null;

    return {
      eventId: event.id,
      nameKeys: new Set(
        event.results.map((result) => {
          const alias = result.pilot.seriesAliases[0]?.name ?? null;
          return dbPilotNameKey(result.pilot.firstName, result.pilot.lastName, alias);
        }),
      ),
      winnerKey,
    };
  });

  const mapping = matchAlmanacEventsToDbEventsByOverlap(almanacPairs, dbPairs);
  const usedDb = new Set(mapping.values());

  for (const meta of almanacEvents) {
    if (mapping.has(meta.almanacEventId)) continue;
    const dbEvent = dbEvents.find(
      (event) => event.roundNumber === meta.roundNumber && !usedDb.has(event.id),
    );
    if (!dbEvent) continue;
    mapping.set(meta.almanacEventId, dbEvent.id);
    usedDb.add(dbEvent.id);
  }

  return mapping;
}
