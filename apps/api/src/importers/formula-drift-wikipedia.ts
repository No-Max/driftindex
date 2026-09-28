import * as cheerio from 'cheerio';
import { transliterate } from '../lib/transliterate.js';
import type { FdEvent, FdPilot, FdSeasonData, FdStageResult } from './formula-drift.js';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_UA = 'DriftIndexBot/1.0 (https://driftindex.pro; Formula Drift archive import)';

export const WIKIPEDIA_FD_SEASON_YEARS = [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017] as const;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const STANDINGS_META = new Set(['pos', 'position', 'driver', 'points', 'pts', 'total', 'car', 'no', 'no.', 'team']);

export interface EventCodeDefault {
  name: string;
  trackName: string;
  country: string;
}

export const EVENT_CODE_DEFAULTS: Record<string, EventCodeDefault> = {
  LBH: { name: 'Streets of Long Beach', trackName: 'Streets of Long Beach', country: 'United States' },
  ATL: { name: 'Road Atlanta', trackName: 'Road Atlanta', country: 'United States' },
  ENG: { name: 'The Gauntlet', trackName: 'Englishtown Raceway Park', country: 'United States' },
  LVS: { name: 'Las Vegas Motor Speedway', trackName: 'Las Vegas Motor Speedway', country: 'United States' },
  EVS: { name: 'Throwdown', trackName: 'Evergreen Speedway', country: 'United States' },
  SON: { name: 'Infineon Raceway', trackName: 'Infineon Raceway', country: 'United States' },
  IRW: { name: 'Title Fight', trackName: 'Irwindale Speedway', country: 'United States' },
  WTS: { name: 'The Gauntlet', trackName: 'Wall Township Speedway', country: 'United States' },
  PBR: { name: 'Palm Beach International Raceway', trackName: 'Palm Beach International Raceway', country: 'United States' },
  TEX: { name: 'Showdown', trackName: 'Texas Motor Speedway', country: 'United States' },
  HMS: { name: 'Miami Heat', trackName: 'Homestead-Miami Speedway', country: 'United States' },
  ORL: { name: 'Uncharted Territory', trackName: 'Orlando Speed World', country: 'United States' },
  ASE: { name: 'True North', trackName: 'Autodrome Saint-Eustache', country: 'Canada' },
  NJ: { name: 'The Gauntlet', trackName: 'Wall Stadium', country: 'United States' },
  CAN: { name: 'True North', trackName: 'Autodrome Saint-Eustache', country: 'Canada' },
  SEA: { name: 'Throwdown', trackName: 'Evergreen Speedway', country: 'United States' },
};

interface WikiScheduleRound {
  roundNumber: number;
  title: string | null;
  venue: string | null;
  location: string | null;
  date: string | null;
  winner: string | null;
}

interface YearCalendarRound {
  name: string;
  trackName: string;
  location?: string;
  date: string;
  winner: string;
  country?: string;
}

/** 2015–2017 Wikipedia schedules interleave PRO / Pro2 / World via colspans. */
const YEAR_PRO_CALENDARS: Record<number, YearCalendarRound[]> = {
  2015: [
    { name: 'Streets of Long Beach', trackName: 'Streets of Long Beach', location: 'Long Beach, CA', date: 'April 10 – 11', winner: 'Fredric Aasbø' },
    { name: 'Road to the Championship', trackName: 'Road Atlanta', location: 'Braselton, GA', date: 'May 8 – 9', winner: 'Aurimas Bakchis' },
    { name: 'Uncharted Territory', trackName: 'Orlando Speed World', location: 'Orlando, FL', date: 'June 5 – 6', winner: 'Ryan Tuerck' },
    { name: 'The Gauntlet', trackName: 'Wall Township Speedway', location: 'Wall Township, NJ', date: 'June 26 – 27', winner: 'Fredric Aasbø' },
    { name: 'Throwdown', trackName: 'Evergreen Speedway', location: 'Monroe, WA', date: 'July 24 – 25', winner: 'Fredric Aasbø' },
    { name: 'Showdown', trackName: 'Texas Motor Speedway', location: 'Fort Worth, TX', date: 'August 21 – 22', winner: 'Masashi Yokoi' },
    { name: 'Title Fight', trackName: 'Irwindale Speedway', location: 'Irwindale, CA', date: 'October 9 – 10', winner: 'Fredric Aasbø' },
  ],
  2016: [
    { name: 'Streets of Long Beach', trackName: 'Streets of Long Beach', location: 'Long Beach, CA', date: 'April 8 – 9', winner: 'Chelsea DeNofa' },
    { name: 'Road to the Championship', trackName: 'Road Atlanta', location: 'Braselton, GA', date: 'May 6 – 7', winner: 'Vaughn Gittin Jr.' },
    { name: 'Uncharted Territory', trackName: 'Orlando Speed World', location: 'Orlando, FL', date: 'June 3 – 4', winner: 'Fredric Aasbø' },
    { name: 'The Gauntlet', trackName: 'Wall Township Speedway', location: 'Wall Township, NJ', date: 'June 17 – 18', winner: 'Vaughn Gittin Jr.' },
    { name: 'True North', trackName: 'Autodrome Saint-Eustache', location: 'Saint-Eustache, QC, Canada', date: 'July 15 – 16', winner: 'Fredric Aasbø', country: 'Canada' },
    { name: 'Throwdown', trackName: 'Evergreen Speedway', location: 'Monroe, WA', date: 'August 5 – 6', winner: 'Aurimas Bakchis' },
    { name: 'Showdown', trackName: 'Texas Motor Speedway', location: 'Fort Worth, TX', date: 'September 9 – 10', winner: 'Matt Field' },
    { name: 'Title Fight', trackName: 'Irwindale Speedway', location: 'Irwindale, CA', date: 'October 7 – 8', winner: 'Matt Field' },
  ],
  2017: [
    { name: 'Streets of Long Beach', trackName: 'Streets of Long Beach', location: 'Long Beach, CA', date: 'March 31 – April 1', winner: 'James Deane' },
    { name: 'Uncharted Territory', trackName: 'Orlando Speed World', location: 'Orlando, FL', date: 'April 28 – 29', winner: 'Fredric Aasbø' },
    { name: 'Road to the Championship', trackName: 'Road Atlanta', location: 'Braselton, GA', date: 'May 12 – 13', winner: 'James Deane' },
    { name: 'The Gauntlet', trackName: 'Wall Stadium', location: 'Wall Township, NJ', date: 'June 2 – 3', winner: 'Aurimas Bakchis' },
    { name: 'True North', trackName: 'Autodrome Saint-Eustache', location: 'Saint-Eustache, QC, Canada', date: 'July 14 – 15', winner: 'Fredric Aasbø', country: 'Canada' },
    { name: 'Throwdown', trackName: 'Evergreen Speedway', location: 'Monroe, WA', date: 'August 4 – 5', winner: 'James Deane' },
    { name: 'Showdown', trackName: 'Texas Motor Speedway', location: 'Fort Worth, TX', date: 'September 8 – 9', winner: 'James Deane' },
    { name: 'Title Fight', trackName: 'Irwindale Speedway', location: 'Irwindale, CA', date: 'October 13 – 14', winner: 'Piotr Więcek' },
  ],
};

interface WikiStandingsEvent {
  code: string;
  roundNumber: number;
}

interface WikiDriverRow {
  name: string;
  scores: Array<number | null>;
}

function cleanCell(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function stripWikiCitations(value: string): string {
  return cleanCell(value.replace(/\[(?:\d+|edit|citation needed)\]/gi, ''));
}

export function cleanWikiHeader(value: string): string {
  return stripWikiCitations(value.replace(/\.mw-parser-output[\s\S]*?\{[^}]*\}/g, ''));
}

export function slugifyPilotName(name: string): string {
  return transliterate(stripWikiCitations(name))
    .toLowerCase()
    .replace(/[`'’.,]/g, '')
    .replace(/\b(jr|sr|ii|iii)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function wikiNameKey(value: string): string {
  return slugifyPilotName(value).replace(/-/g, '');
}

function titleCase(value: string): string {
  return value
    .split(/([\s-'])/)
    .map((part) => {
      if (/^[A-Z]{2,3}$/.test(part)) return part;
      const lower = part.toLowerCase();
      return /^[a-z]/i.test(part) ? lower.charAt(0).toUpperCase() + lower.slice(1) : part;
    })
    .join('');
}

export function parseWikiDriverName(rawName: string): { firstName: string; lastName: string } {
  const parts = stripWikiCitations(rawName)
    .replace(/,/g, ' ')
    .replace(/\b(Jr|Sr)\./gi, '$1')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 1) {
    const only = titleCase(parts[0]!);
    return { firstName: only, lastName: only };
  }
  return {
    firstName: titleCase(parts[0]!),
    lastName: titleCase(parts.slice(1).join(' ')),
  };
}

function fdDriverIdFromSlug(driverSlug: string): number {
  let hash = 0;
  for (const char of driverSlug) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) || 1;
}

function slugifyEventName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function uniqueEventSlug(name: string, usedSlugs: Set<string>): string {
  const base = slugifyEventName(name) || 'event';
  let slug = base;
  let suffix = 2;
  while (usedSlugs.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  usedSlugs.add(slug);
  return slug;
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

export function parseWikiDate(raw: string, year: number): string | null {
  const cleaned = stripWikiCitations(raw)
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;

  const sameMonth = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*-\s*\d{1,2})?$/);
  if (sameMonth) {
    const month = MONTHS[sameMonth[1]!.toLowerCase()];
    const day = Number.parseInt(sameMonth[2]!, 10);
    if (month && day >= 1 && day <= 31) return isoDate(year, month, day);
  }

  const crossMonth = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s*-\s*([A-Za-z]+)\s+(\d{1,2})$/);
  if (crossMonth) {
    const month = MONTHS[crossMonth[1]!.toLowerCase()];
    const day = Number.parseInt(crossMonth[2]!, 10);
    if (month && day >= 1 && day <= 31) return isoDate(year, month, day);
  }

  return null;
}

export function inferEventCountry(...parts: Array<string | null | undefined>): string {
  const blob = parts.filter(Boolean).join(' ').toLowerCase();
  if (/canada|quebec|\bqc\b|saint-eustache|st\.?\s*eustache/.test(blob)) return 'Canada';
  return 'United States';
}

export function parseWikiPointsCell(raw: string): number | null {
  const trimmed = stripWikiCitations(raw);
  if (!trimmed || trimmed === '—' || trimmed === '–' || trimmed === '-' || trimmed === '*') {
    return null;
  }
  const parsed = Number.parseFloat(trimmed.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function isEventCode(header: string): boolean {
  const normalized = cleanWikiHeader(header);
  if (STANDINGS_META.has(normalized.toLowerCase())) return false;
  return /^[A-Z]{2,4}$/.test(normalized);
}

function tableMatrix($: cheerio.CheerioAPI, table: cheerio.Element): string[][] {
  const rows: string[][] = [];
  $(table)
    .find('tr')
    .each((_, row) => {
      const cells = $(row)
        .find('th,td')
        .toArray()
        .map((cell) => cleanCell($(cell).text()));
      if (cells.length > 0) rows.push(cells);
    });
  return rows;
}

function headerIndex(headers: string[], pattern: RegExp): number {
  return headers.findIndex((header) => pattern.test(cleanWikiHeader(header)));
}

function isScheduleTable(headers: string[]): boolean {
  const hasRound = headers.some((header) => /^(round|rnd)$/i.test(cleanWikiHeader(header)));
  const hasWinner = headers.some((header) => /^winner$/i.test(cleanWikiHeader(header)));
  return hasRound && hasWinner;
}

function isDriverStandingsTable(headers: string[]): boolean {
  const hasPos = headers.some((header) => /^(pos|position)$/i.test(cleanWikiHeader(header)));
  const hasDriver = headers.some((header) => /^driver$/i.test(cleanWikiHeader(header)));
  const hasPoints = headers.some((header) => /^(points|pts|total)$/i.test(cleanWikiHeader(header)));
  const eventCodes = headers.filter((header) => isEventCode(header));
  return hasPos && hasDriver && hasPoints && eventCodes.length >= 4;
}

export function parseScheduleRounds(rows: string[][]): WikiScheduleRound[] {
  if (rows.length < 2) return [];
  const headers = rows[0]!;
  if (!isScheduleTable(headers)) return [];

  const roundIdx = headerIndex(headers, /^(round|rnd)$/i);
  const titleIdx = headerIndex(headers, /^(title|event)$/i);
  const venueIdx = headerIndex(headers, /^(circuit|venue)$/i);
  const locationIdx = headerIndex(headers, /^location$/i);
  const dateIdx = headerIndex(headers, /^date$/i);
  const winnerIdx = headerIndex(headers, /^winner$/i);

  const rounds: WikiScheduleRound[] = [];
  for (const row of rows.slice(1)) {
    const roundRaw = stripWikiCitations(row[roundIdx] ?? '');
    if (!/^\d{1,2}$/.test(roundRaw)) continue;
    const roundNumber = Number.parseInt(roundRaw, 10);
    if (roundNumber < 1 || roundNumber > 12) continue;

    const title = titleIdx >= 0 ? stripWikiCitations(row[titleIdx] ?? '') || null : null;
    const venue = venueIdx >= 0 ? stripWikiCitations(row[venueIdx] ?? '') || null : null;
    const location = locationIdx >= 0 ? stripWikiCitations(row[locationIdx] ?? '') || null : null;
    const date = dateIdx >= 0 ? stripWikiCitations(row[dateIdx] ?? '') || null : null;
    const winner = winnerIdx >= 0 ? stripWikiCitations(row[winnerIdx] ?? '') || null : null;

    rounds.push({ roundNumber, title, venue, location, date, winner });
  }

  return rounds.sort((a, b) => a.roundNumber - b.roundNumber);
}

export function parseStandingsMatrix(rows: string[][]): { events: WikiStandingsEvent[]; drivers: WikiDriverRow[] } | null {
  if (rows.length < 2) return null;
  const headers = rows[0]!;
  if (!isDriverStandingsTable(headers)) return null;

  const events: WikiStandingsEvent[] = [];
  for (const header of headers) {
    if (!isEventCode(header)) continue;
    events.push({ code: cleanWikiHeader(header), roundNumber: events.length + 1 });
  }
  if (events.length < 4) return null;

  const codeIndexes = headers
    .map((header, index) => (isEventCode(header) ? index : -1))
    .filter((index) => index >= 0);

  const drivers: WikiDriverRow[] = [];
  for (const row of rows.slice(1)) {
    const parsed = parseStandingsDriverRow(row, events.length, codeIndexes);
    if (parsed) drivers.push(parsed);
  }

  return drivers.length > 0 ? { events, drivers } : null;
}

function parseStandingsDriverRow(
  cells: string[],
  eventCount: number,
  codeIndexes: number[],
): WikiDriverRow | null {
  if (cells.length < eventCount + 1) return null;

  const first = stripWikiCitations(cells[0] ?? '');
  const second = stripWikiCitations(cells[1] ?? '');
  let name: string;
  let scores: Array<number | null>;

  if (/^\d{1,2}=?$/.test(first) && /[A-Za-z]/.test(second)) {
    name = second;
    if (codeIndexes.length === eventCount && codeIndexes[0]! >= 2) {
      scores = codeIndexes.map((index) => parseWikiPointsCell(cells[index] ?? ''));
    } else {
      scores = cells.slice(2, 2 + eventCount).map((cell) => parseWikiPointsCell(cell));
    }
  } else if (/[A-Za-z]/.test(first) && !/^(source|notes?)$/i.test(first)) {
    name = first;
    scores = cells.slice(1, 1 + eventCount).map((cell) => parseWikiPointsCell(cell));
  } else {
    return null;
  }

  if (!name || /^source/i.test(name)) return null;
  if (scores.length < eventCount) return null;
  if (scores.every((score) => score == null)) return null;
  return { name, scores: scores.slice(0, eventCount) };
}

function pickStandingsTable(tables: string[][][]): { events: WikiStandingsEvent[]; drivers: WikiDriverRow[] } {
  const parsed = tables
    .map((rows) => parseStandingsMatrix(rows))
    .filter((item): item is NonNullable<typeof item> => item != null)
    .sort((a, b) => b.events.length - a.events.length || b.drivers.length - a.drivers.length);

  const best = parsed[0];
  if (!best) {
    throw new Error('Wikipedia Formula D standings table not found');
  }
  return best;
}

function pickScheduleRounds(tables: string[][][]): WikiScheduleRound[] {
  for (const rows of tables) {
    const rounds = parseScheduleRounds(rows);
    if (rounds.length > 0) return rounds;
  }
  return [];
}

function looksLikeVenue(value: string | null | undefined): boolean {
  if (!value) return false;
  if (/^\d+$/.test(value)) return false;
  if (/^(pro|pro\s*2|pro2|world)$/i.test(value)) return false;
  return true;
}

function buildEvents(
  year: number,
  standingsEvents: WikiStandingsEvent[],
  schedule: WikiScheduleRound[],
): { events: FdEvent[]; winners: Array<string | null> } {
  const usedSlugs = new Set<string>();
  const yearCalendar = YEAR_PRO_CALENDARS[year];
  const useYearCalendar = yearCalendar != null && yearCalendar.length === standingsEvents.length;
  const zip = !useYearCalendar && schedule.length === standingsEvents.length;
  const events: FdEvent[] = [];
  const winners: Array<string | null> = [];

  for (const standing of standingsEvents) {
    const defaults = EVENT_CODE_DEFAULTS[standing.code];
    const known = useYearCalendar ? yearCalendar[standing.roundNumber - 1] : undefined;
    const sched = zip ? schedule[standing.roundNumber - 1] : undefined;
    const title = known?.name || sched?.title || defaults?.name || standing.code;
    const venue =
      known?.trackName ||
      (looksLikeVenue(sched?.venue) ? sched!.venue : null) ||
      defaults?.trackName ||
      title;
    const location = known?.location ?? sched?.location ?? null;
    const startsAt =
      (known?.date ? parseWikiDate(known.date, year) : null) ??
      (sched?.date ? parseWikiDate(sched.date, year) : null) ??
      isoDate(year, Math.min(standing.roundNumber, 12), 1);
    const slug = uniqueEventSlug(title === standing.code ? venue : title, usedSlugs);

    events.push({
      fdEventId: standing.roundNumber,
      slug: `fd-${slug}`,
      roundNumber: standing.roundNumber,
      name: title,
      trackName: venue,
      startsAt,
      status: 'FINISHED',
      country: known?.country ?? inferEventCountry(location, venue),
    });
    winners.push(known?.winner ?? sched?.winner ?? null);
  }

  return { events, winners };
}

function buildPilots(
  drivers: WikiDriverRow[],
  events: FdEvent[],
  winners: Array<string | null>,
): FdPilot[] {
  const pilots: FdPilot[] = [];

  for (const driver of drivers) {
    const slug = slugifyPilotName(driver.name);
    if (!slug) continue;
    const { firstName, lastName } = parseWikiDriverName(driver.name);
    const stages: FdStageResult[] = [];

    driver.scores.forEach((score, index) => {
      if (score == null) return;
      const event = events[index];
      if (!event) return;
      const winner = winners[index];
      stages.push({
        eventSlug: event.slug,
        roundNumber: event.roundNumber,
        qualifyingPosition: null,
        qualifyingPoints: null,
        qualScore100: null,
        tandemPosition: winner && wikiNameKey(winner) === wikiNameKey(driver.name) ? 1 : null,
        points: Math.round(score),
      });
    });

    if (stages.length === 0) continue;
    pilots.push({
      slug,
      fdDriverId: fdDriverIdFromSlug(slug),
      firstName,
      lastName,
      nameAlias: stripWikiCitations(driver.name),
      country: null,
      number: null,
      photoSourceUrl: null,
      team: null,
      stages,
    });
  }

  return pilots;
}

export function parseWikipediaSeasonHtml(html: string, seasonYear: number): FdSeasonData {
  const $ = cheerio.load(html);
  const tables = $('table')
    .toArray()
    .map((table) => tableMatrix($, table))
    .filter((rows) => rows.length > 0);

  const standings = pickStandingsTable(tables);
  const schedule = pickScheduleRounds(tables);
  const { events, winners } = buildEvents(seasonYear, standings.events, schedule);
  const pilots = buildPilots(standings.drivers, events, winners);

  if (events.length === 0 || pilots.length === 0) {
    throw new Error(`Wikipedia Formula D ${seasonYear} parsed empty (events=${events.length}, pilots=${pilots.length})`);
  }

  return {
    sourceUrl: `https://en.wikipedia.org/wiki/${seasonYear}_Formula_D_season`,
    seasonYear,
    events,
    pilots,
  };
}

export function isWikipediaFormulaDriftYear(year: number): boolean {
  return (WIKIPEDIA_FD_SEASON_YEARS as readonly number[]).includes(year);
}

export async function fetchWikipediaSeasonHtml(year: number): Promise<{ html: string; title: string }> {
  const titles = [`${year} Formula D season`, `${year} Formula Drift season`];
  let lastError: Error | null = null;

  for (const title of titles) {
    const url = `${WIKI_API}?${new URLSearchParams({
      action: 'parse',
      page: title,
      prop: 'text',
      format: 'json',
      formatversion: '2',
    }).toString()}`;

    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': WIKI_UA },
    });
    if (!response.ok) {
      lastError = new Error(`Wikipedia parse ${title} failed: ${response.status}`);
      continue;
    }

    const payload = (await response.json()) as {
      parse?: { title?: string; text?: string };
      error?: { code?: string; info?: string };
    };
    if (payload.parse?.text) {
      return { html: payload.parse.text, title: payload.parse.title ?? title };
    }
    lastError = new Error(payload.error?.info ?? `Wikipedia page missing: ${title}`);
  }

  throw lastError ?? new Error(`Wikipedia Formula D season page not found for ${year}`);
}

export async function fetchFormulaDriftSeasonFromWikipedia(seasonYear: number): Promise<FdSeasonData> {
  const { html, title } = await fetchWikipediaSeasonHtml(seasonYear);
  const season = parseWikipediaSeasonHtml(html, seasonYear);
  return {
    ...season,
    sourceUrl: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}`,
  };
}
