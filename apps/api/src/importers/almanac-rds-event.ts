import * as cheerio from 'cheerio';
import { englishNamesFromNameRu } from '../lib/transliterate.js';
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
