import * as cheerio from 'cheerio';
import { buildNameKey, englishNamesFromNameRu } from '../lib/transliterate.js';
import { listAlmanacRdsEvents } from './rds-almanac.js';
import { parseQualRunScore } from './rds-gp.js';

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

function bestQualScore(run1: string, run2: string): number | null {
  const scores = [parseQualRunScore(run1), parseQualRunScore(run2)].filter(
    (value): value is number => value != null,
  );
  if (scores.length === 0) return null;
  return Math.max(...scores);
}

/** Parse Drift Almanac /event/{id}/qualification table. */
export function parseAlmanacRdsQualificationHtml(html: string): AlmanacRdsQualRow[] {
  const $ = cheerio.load(html);
  const rows: AlmanacRdsQualRow[] = [];

  $('table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 4) return;

    const pilotLink = $(tr).find('a[href*="/pilot/"]').first();
    const almanacPilotSlug = pilotSlugFromHref(pilotLink.attr('href'));
    const nameAlias = pilotLink.text().trim();
    if (!almanacPilotSlug || !nameAlias) return;

    const qualPosition = Number.parseInt($(cells.eq(0)).text().trim(), 10);
    if (!Number.isFinite(qualPosition) || qualPosition <= 0) return;

    const run1 = $(cells.eq(2)).text().trim();
    const run2 = $(cells.eq(3)).text().trim();

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
  return `da-${almanacPilotSlug}`;
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

export type AlmanacDbEventMapping = Map<string, string>;

function overlapSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const key of a) {
    if (b.has(key)) count += 1;
  }
  return count;
}

function winnerKeyFromResults(
  rows: Array<{ nameAlias: string; tandemPosition: number }>,
): string | null {
  const winner = rows.find((row) => row.tandemPosition === 1);
  if (!winner) return null;
  const names = pilotNamesFromAlmanacRow(winner.nameAlias);
  return buildNameKey(names.firstName, names.lastName, names.nameAlias);
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
      if (db.winnerKey !== almanac.winnerKey) continue;
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
        almanac.winnerKey !== db.winnerKey
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
      const names = pilotNamesFromAlmanacRow(row.nameAlias);
      nameKeys.add(buildNameKey(names.firstName, names.lastName, names.nameAlias));
    }
    for (const row of details?.qualification ?? []) {
      const names = pilotNamesFromAlmanacRow(row.nameAlias);
      nameKeys.add(buildNameKey(names.firstName, names.lastName, names.nameAlias));
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
      ? buildNameKey(winnerResult.pilot.firstName, winnerResult.pilot.lastName, winnerAlias)
      : null;

    return {
      eventId: event.id,
      nameKeys: new Set(
        event.results.map((result) => {
          const alias = result.pilot.seriesAliases[0]?.name ?? null;
          return buildNameKey(result.pilot.firstName, result.pilot.lastName, alias);
        }),
      ),
      winnerKey,
    };
  });

  return matchAlmanacEventsToDbEventsByOverlap(almanacPairs, dbPairs);
}
