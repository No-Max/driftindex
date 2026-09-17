import * as cheerio from 'cheerio';
import { englishNamesFromNameRu, isLatinName } from '../lib/transliterate.js';

const BASE = 'https://rdsgp.com';

/**
 * RDS GP seasons with results on rdsgp.com.
 * 2010 pages exist but tables are empty; 2025 page has no rounds yet.
 */
export const RDS_GP_SEASONS_WITH_DATA = [
  2011, 2012, 2013, 2014, 2015, 2016, 2017,
  2018, 2019, 2020, 2021, 2022, 2023, 2024, 2026,
] as const;

export function rdsGpSeasonPath(seasonYear: number): string {
  if (seasonYear >= 2018) return `/results/rdsgp${seasonYear}`;
  if (seasonYear >= 2010 && seasonYear <= 2017) return `/results/${seasonYear}`;
  throw new Error(
    `Unsupported RDS GP season ${seasonYear}. Available: ${RDS_GP_SEASONS_WITH_DATA.join(', ')}`,
  );
}

export interface RdsGpStageResult {
  eventSlug: string;
  roundNumber: number;
  qualifyingPosition: number | null;
  qualifyingPoints: number | null;
  qualScore100: number | null;
  tandemPosition: number | null;
  points: number;
}

export interface RdsGpPilot {
  slug: string;
  firstName: string;
  lastName: string;
  nameAlias: string | null;
  country: string | null;
  number: number | null;
  photoSourceUrl: string | null;
  team: string | null;
  stages: RdsGpStageResult[];
}

export interface RdsGpEvent {
  slug: string;
  roundNumber: number;
  name: string;
  trackName: string;
  startsAt: string;
  status: 'FINISHED' | 'SCHEDULED' | 'CANCELLED';
}

export interface RdsGpSeasonData {
  sourceUrl: string;
  seasonYear: number;
  events: RdsGpEvent[];
  pilots: RdsGpPilot[];
}

interface ParsedEventMeta {
  id: string;
  roundNumber: number;
  nameRu: string;
  trackRu: string;
  href: string;
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function parseDecimal(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!normalized || normalized === '0.00' || normalized === '00.00') return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** RDS qualifying run score (0–100). Rejects horsepower, car names, and other non-score cells. */
export function parseQualRunScore(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || /[a-zA-Zа-яА-ЯёЁ]/.test(trimmed)) return null;

  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  // Reject mis-parsed horsepower / points; allow tiny judge overflow (e.g. 100.1 → 100).
  if (parsed > 101) return null;

  return Math.round(Math.min(100, parsed) * 10) / 10;
}

/** Reject legacy Almanac cells that store qual points (41, 40…) in RUN columns. */
export function isPlausibleRdsQualRunScore(parsed: number, raw: string): boolean {
  if (parsed > 101 || parsed <= 0) return false;
  if (parsed >= 70) return true;

  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
  // Qual points appear as 41 or 41.00; judge scores use non-zero fractional parts (e.g. 96.3).
  const rounded = Math.round(parsed * 100) / 100;
  if (Math.abs(parsed - rounded) < 0.001) return false;

  return /^\d+\.\d*[1-9]\d*$/.test(normalized);
}

function parseQualCell(text: string): { qualPoints: number | null; qualPosition: number | null } {
  const match = text.trim().match(/^(\d+)\s*\((\d+)\)$/);
  if (!match) return { qualPoints: null, qualPosition: null };
  return {
    qualPoints: Number.parseInt(match[1]!, 10),
    qualPosition: Number.parseInt(match[2]!, 10),
  };
}

function parsePilotCell(
  $: cheerio.CheerioAPI,
  cell: cheerio.Cheerio<any>,
): { slug: string; firstName: string; lastName: string; nameAlias: string | null } | null {
  const link = cell.find('a[href*="/pilots/"]').first();
  const href = link.attr('href') ?? '';
  const id = href.match(/\/pilots\/(\d+)/)?.[1];
  if (!id) return null;

  const raw = link.html()?.replace(/<br\s*\/?>/gi, '\n') ?? link.text();
  const lines = raw
    .split('\n')
    .map((line) => line.trim().replace(/^\/\s*/, ''))
    .filter(Boolean);

  // "Попов Илья / Popov Ilya" may appear on one line or split across lines
  const combined = lines.join(' ').trim();
  const slashSplit = combined.match(/^(.+?)\s*\/\s*(.+)$/);
  const ruLine = slashSplit?.[1]?.trim() ?? lines[0] ?? link.text().trim();
  const enLine = slashSplit?.[2]?.trim() ?? (lines.length > 1 ? lines.slice(1).join(' ') : null);

  const nameAlias = ruLine || null;
  let firstName = ruLine;
  let lastName = ruLine;

  if (enLine && isLatinName(enLine.replace(/\s+/g, ''))) {
    const parts = enLine.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      lastName = parts[0]!;
      firstName = parts.slice(1).join(' ');
    } else if (parts.length === 1) {
      firstName = parts[0]!;
      lastName = parts[0]!;
    }
  } else if (nameAlias) {
    const english = englishNamesFromNameRu(nameAlias);
    firstName = english.firstName;
    lastName = english.lastName;
  }

  return { slug: `rds-${id}`, firstName, lastName, nameAlias };
}

function parseEventDate(text: string): string {
  const match = text.match(/(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return new Date().toISOString();
  const [, startDay, startMonth, , , year] = match;
  return new Date(`${year}-${startMonth}-${startDay}T12:00:00Z`).toISOString();
}

function parseSeasonEvents(html: string, seasonPath: string): ParsedEventMeta[] {
  const $ = cheerio.load(html);
  const events: ParsedEventMeta[] = [];
  const seenIds = new Set<string>();
  let round = 0;
  const seasonYear = Number.parseInt(seasonPath.match(/(\d{4})$/)?.[1] ?? '', 10);

  $(`a[href^="${seasonPath}/"]`).each((_, element) => {
    const href = $(element).attr('href') ?? '';
    const id = href.match(/\/(\d+)\/?$/)?.[1];
    if (!id) return;

    const eventId = Number.parseInt(id, 10);
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    if (Number.isFinite(seasonYear) && eventId === seasonYear) return;
    if (seenIds.has(id)) return;
    seenIds.add(id);

    round += 1;
    const label = $(element)
      .html()
      ?.replace(/<br\s*\/?>/gi, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const stageLine = label?.[0] ?? `Stage ${round}`;
    const trackLine = label?.[1] ?? stageLine;

    events.push({
      id,
      roundNumber: round,
      nameRu: stageLine,
      trackRu: trackLine,
      href: `${BASE}${href}`,
    });
  });

  return events;
}

interface ParsedEventRow {
  slug: string;
  firstName: string;
  lastName: string;
  nameAlias: string | null;
  country: string | null;
  number: number | null;
  photoSourceUrl: string | null;
  team: string | null;
  qualifyingPosition: number | null;
  qualifyingPoints: number | null;
  qualScore100: number | null;
  tandemPosition: number | null;
  points: number;
}

function parseEventRow(
  $: cheerio.CheerioAPI,
  cells: cheerio.Cheerio<any>,
): ParsedEventRow | null {
  if (cells.length < 9) return null;

  const texts: string[] = [];
  cells.each((_, cell) => {
    texts.push($(cell).text().trim());
  });

  let pilotCellIndex = -1;
  cells.each((index, cell) => {
    if (pilotCellIndex >= 0) return;
    if ($(cell).find('a[href*="/pilots/"]').length > 0) pilotCellIndex = index;
  });
  if (pilotCellIndex < 0) return null;

  const pilot = parsePilotCell($, cells.eq(pilotCellIndex));
  if (!pilot) return null;

  const qualCellIndex = texts.findIndex((text) => /^\d+\s*\(\d+\)$/.test(text));
  if (qualCellIndex < 0) return null;

  const qual = parseQualCell(texts[qualCellIndex]!);
  const runScores = texts
    .slice(pilotCellIndex + 1, qualCellIndex)
    .map((raw) => {
      const parsed = parseQualRunScore(raw);
      if (parsed == null || !isPlausibleRdsQualRunScore(parsed, raw)) return null;
      return parsed;
    })
    .filter((value): value is number => value != null);

  let totalPoints = 0;
  for (let index = texts.length - 1; index > qualCellIndex; index -= 1) {
    const value = Number.parseInt(texts[index]!, 10);
    if (Number.isFinite(value) && value > 0) {
      totalPoints = value;
      break;
    }
  }
  if (totalPoints <= 0) return null;

  const qualScore100 =
    runScores.length > 0 ? Math.round(Math.max(...runScores) * 10) / 10 : null;
  const tandemPosition = Number.parseInt(texts[0]!, 10) || null;
  const number = Number.parseInt(texts[1]!, 10) || null;

  return {
    ...pilot,
    number,
    country: null,
    photoSourceUrl: null,
    team: null,
    qualifyingPosition: qual.qualPosition,
    qualifyingPoints: qual.qualPoints,
    qualScore100,
    tandemPosition,
    points: totalPoints,
  };
}

function parseEventResults(
  html: string,
  meta: ParsedEventMeta,
): { event: RdsGpEvent; rows: ParsedEventRow[] } {
  const $ = cheerio.load(html);
  const trackRu = $('h1').last().text().trim() || meta.trackRu;
  const dateText = $('h1').last().next('p').text().trim();
  const startsAt = parseEventDate(dateText);

  const rows: ParsedEventRow[] = [];
  const table = $('table.rating').first();

  table.find('tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    const parsed = parseEventRow($, cells);
    if (parsed) rows.push(parsed);
  });

  const event: RdsGpEvent = {
    slug: `rds-${meta.id}`,
    roundNumber: meta.roundNumber,
    name: meta.nameRu,
    trackName: trackRu,
    startsAt,
    status: rows.length > 0 ? 'FINISHED' : 'SCHEDULED',
  };

  return { event, rows };
}

export async function fetchRdsGpSeason(seasonYear: number): Promise<RdsGpSeasonData> {
  const seasonPath = rdsGpSeasonPath(seasonYear);
  const sourceUrl = `${BASE}${seasonPath}/`;
  const seasonHtml = await fetchHtml(sourceUrl);
  const eventMetas = parseSeasonEvents(seasonHtml, seasonPath);

  const events: RdsGpEvent[] = [];
  const pilotMap = new Map<string, RdsGpPilot>();

  for (const meta of eventMetas) {
    const html = await fetchHtml(meta.href);
    const { event, rows } = parseEventResults(html, meta);
    events.push(event);

    for (const row of rows) {
      const stage: RdsGpStageResult = {
        eventSlug: event.slug,
        roundNumber: event.roundNumber,
        qualifyingPosition: row.qualifyingPosition,
        qualifyingPoints: row.qualifyingPoints,
        qualScore100: row.qualScore100,
        tandemPosition: row.tandemPosition,
        points: row.points,
      };

      const existing = pilotMap.get(row.slug);
      if (existing) {
        existing.stages.push(stage);
        if (row.number != null) existing.number = row.number;
      } else {
        pilotMap.set(row.slug, {
          slug: row.slug,
          firstName: row.firstName,
          lastName: row.lastName,
          nameAlias: row.nameAlias,
          country: row.country,
          number: row.number,
          photoSourceUrl: row.photoSourceUrl,
          team: row.team,
          stages: [stage],
        });
      }
    }
  }

  return {
    sourceUrl,
    seasonYear,
    events,
    pilots: [...pilotMap.values()],
  };
}

function toAbsoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  return `${BASE}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

function extractRdsPagePhotoUrl(html: string): string | null {
  const $ = cheerio.load(html);

  const gallerySrc = $('img[src*="/images/gallery/"]').first().attr('src');
  if (gallerySrc) return toAbsoluteUrl(gallerySrc);

  const newsSrc = $('img[src*="/images/w"]').first().attr('src');
  if (newsSrc) return toAbsoluteUrl(newsSrc);

  return null;
}

export function rdsGpEventPageUrl(seasonYear: number, eventSlug: string): string | null {
  const id = eventSlug.match(/^rds-(\d+)$/)?.[1];
  if (!id) return null;
  try {
    return `${BASE}${rdsGpSeasonPath(seasonYear)}/${id}/`;
  } catch {
    return null;
  }
}

export async function fetchRdsPagePhotoSourceUrl(pageUrl: string): Promise<string | null> {
  const html = await fetchHtml(pageUrl);
  if (pageUrl.includes('driftalmanac.ru')) {
    const $ = cheerio.load(html);
    const ogCandidates: string[] = [];
    $('meta[property="og:image"]').each((_, element) => {
      const content = $(element).attr('content')?.trim();
      if (content) ogCandidates.push(content);
    });
    const og =
      [...ogCandidates].reverse().find((value) => !/og-default/i.test(value)) ??
      ogCandidates.at(-1);
    if (og && !/og-default/i.test(og)) {
      if (og.startsWith('http://') || og.startsWith('https://')) return og;
      return `https://driftalmanac.ru${og.startsWith('/') ? '' : '/'}${og}`;
    }
  }
  return extractRdsPagePhotoUrl(html);
}

export async function fetchRdsPilotPhotoSourceUrl(pilotId: string): Promise<string | null> {
  const html = await fetchHtml(`${BASE}/pilots/${pilotId}/`);
  const $ = cheerio.load(html);

  const profileSrc = $('.pilot-profile__img img').first().attr('src');
  if (profileSrc) return toAbsoluteUrl(profileSrc);

  return extractRdsPagePhotoUrl(html);
}

export function rdsPilotIdFromSlug(slug: string): string | null {
  return slug.match(/^rds-(\d+)$/)?.[1] ?? null;
}
