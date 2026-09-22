import * as cheerio from 'cheerio';
import {
  registerLatinDriverFromRanking,
  resolveD1Driver,
} from '../data/d1gp-drivers.js';
import { getD1gpSeasonConfig, D1GP_SUPPORTED_SEASONS } from '../data/d1gp-seasons.js';

const SITE = 'https://d1gp.co.jp';

export interface D1StageResult {
  eventSlug: string;
  roundNumber: number;
  qualifyingPosition: number | null;
  qualifyingPoints: number | null;
  qualScore100: number | null;
  tandemPosition: number | null;
  points: number;
}

export interface D1Pilot {
  slug: string;
  firstName: string;
  lastName: string;
  nameAlias: string;
  country: string | null;
  number: number;
  team: string | null;
  totalPoints: number;
  photoSourceUrl: string | null;
  stages: D1StageResult[];
}

export interface D1Event {
  slug: string;
  roundNumber: number;
  name: string;
  trackName: string;
  startsAt: string;
  status: 'FINISHED' | 'SCHEDULED' | 'CANCELLED';
}

export interface D1SeasonData {
  sourceUrl: string;
  seasonYear: number;
  events: D1Event[];
  pilots: D1Pilot[];
}

interface RoundReportData {
  qualByNumber: Map<number, { position: number; bestScore: number }>;
  tandemByNumber: Map<number, { position: number }>;
}

interface RankingRow {
  number: number;
  nameJa: string;
  team: string;
  roundPoints: Map<number, number>;
  totalPoints: number;
}

const TRACK_LABELS: Record<string, string> = {
  OKUIBUKI: 'Okui',
  TSUKUBA: 'Tsukuba Circuit',
  EBISU: 'Ebisu Circuit',
  AUTOPOLIS: 'Autopolis',
  AP: 'Autopolis',
  FUJI: 'Fuji Speedway',
  ODAIBA: 'Odaiba, Tokyo Bay',
  AICHI: 'Aichi Sky Expo',
  TBN: 'Odaiba, Tokyo Bay',
  TBA: 'Odaiba, Tokyo Bay',
};

export function listD1gpSeasons(): number[] {
  return [...D1GP_SUPPORTED_SEASONS];
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

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseInteger(value: string): number | null {
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFloatScore(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function pilotSlug(number: number, firstName: string, lastName: string): string {
  const base = `${lastName}-${firstName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || String(number);
}

function eventSlug(roundNumber: number): string {
  return `d1-r${roundNumber}`;
}

function normalizeTrackLabel(raw: string): string {
  const key = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  return TRACK_LABELS[key] ?? titleCaseTrack(raw.trim());
}

function titleCaseTrack(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#0?38;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function applyRoundVenueRange(
  schedule: Map<number, string>,
  start: number,
  end: number,
  rawVenue: string,
): void {
  const track = normalizeTrackLabel(rawVenue.trim());
  for (let round = start; round <= end; round += 1) {
    schedule.set(round, track);
  }
}

function parseVenueSchedule(html: string): Map<number, string> {
  const decoded = decodeHtmlEntities(html);
  const schedule = new Map<number, string>();

  const venueChain = decoded.match(
    /RD\.\d+(?:&\d+)?\s+[A-Z][A-Z\s]{0,20}(?:\s*\/\s*RD\.\d+(?:&\d+)?\s+[A-Z][A-Z\s]{0,20})+/,
  );
  if (venueChain) {
    for (const match of venueChain[0].matchAll(/RD\.(\d+)(?:&(\d+))?\s+([A-Z][A-Z\s]{0,20}?)(?=\s*\/|$)/g)) {
      applyRoundVenueRange(
        schedule,
        Number.parseInt(match[1]!, 10),
        match[2] ? Number.parseInt(match[2], 10) : Number.parseInt(match[1]!, 10),
        match[3]!,
      );
    }
  }

  const text = cheerio.load(html).root().text().replace(/\s+/g, ' ');
  for (const match of text.matchAll(/RD\.(\d+)(?:&(\d+))?\s+([A-Z][A-Z\s]{1,20}?)(?:\s*\/|\s+ドライバ|\s+単走|$)/g)) {
    applyRoundVenueRange(
      schedule,
      Number.parseInt(match[1]!, 10),
      match[2] ? Number.parseInt(match[2], 10) : Number.parseInt(match[1]!, 10),
      match[3]!,
    );
  }

  return schedule;
}

/** Calendar dates from GP category nav links (avoids D1 Lights dates on the same page). */
function parseRoundEventDates(html: string, seasonYear: number, gpCategoryPath: string): Map<number, string> {
  const decoded = decodeHtmlEntities(html);
  const dates = new Map<number, string>();
  const gpNeedle = gpCategoryPath.replace(/\/$/, '');

  const toIso = (month: number, day: number) =>
    new Date(Date.UTC(seasonYear, month - 1, day, 9)).toISOString();

  const linkRe = new RegExp(
    `<a[^>]+href="[^"]*${gpNeedle.replace(/\//g, '\\/')}[^"]*"[^>]*>([^<]*)</a>`,
    'gi',
  );

  for (const match of decoded.matchAll(linkRe)) {
    const label = match[1]!;
    const dateMatch = label.match(
      /RD\.(\d+)(?:&(\d+))?\s+[^/]*\/\s*(\d+)月(\d+)日(?:-(\d+)日)?/,
    );
    if (!dateMatch) continue;

    const start = Number.parseInt(dateMatch[1]!, 10);
    const end = dateMatch[2] ? Number.parseInt(dateMatch[2], 10) : start;
    const month = Number.parseInt(dateMatch[3]!, 10);
    const dayStart = Number.parseInt(dateMatch[4]!, 10);
    const dayEnd = dateMatch[5] ? Number.parseInt(dateMatch[5], 10) : dayStart;
    for (let round = start; round <= end; round += 1) {
      const day = round === start ? dayStart : dayEnd;
      dates.set(round, toIso(month, day));
    }
  }

  return dates;
}

function approximateEventDate(year: number, roundNumber: number): string {
  const month = Math.min(11, 3 + roundNumber);
  const day = roundNumber % 2 === 0 ? 10 : 9;
  return new Date(Date.UTC(year, month - 1, day, 9)).toISOString();
}

function findTable(
  $: cheerio.CheerioAPI,
  headerNeedles: string[],
  options?: { exclude?: string[] },
): cheerio.Cheerio<any> | null {
  for (const table of $('table').toArray()) {
    const headers = tableHeaders($, $(table));
    if (options?.exclude?.some((needle) => headers.some((header) => header.includes(needle)))) {
      continue;
    }
    if (headerNeedles.every((needle) => headers.some((header) => header.includes(needle)))) {
      return $(table);
    }
  }
  return null;
}

function tableHeaders($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): string[] {
  return table
    .find('tr')
    .first()
    .find('th,td')
    .toArray()
    .map((cell) => normalizeHeader($(cell).text()));
}

function headerIndex(headers: string[], needles: string[]): number {
  return headers.findIndex((header) => needles.some((needle) => header.includes(needle)));
}

function parseRoundReport(html: string): RoundReportData {
  const $ = cheerio.load(html);
  const qualByNumber = new Map<number, { position: number; bestScore: number }>();
  const tandemByNumber = new Map<number, { position: number }>();

  const qualTable =
    findTable($, ['group', 'best']) ??
    findTable($, ['name', 'best']) ??
    findTable($, ['driver', 'best']);
  if (qualTable) {
    const headers = tableHeaders($, qualTable);
    const positionIndex = headerIndex(headers, ['順位', 'rank', 'pos']);
    const numberIndex = headerIndex(headers, ['no']);
    const bestIndex = headerIndex(headers, ['best']);
    qualTable.find('tr').slice(1).each((_, row) => {
      const cells = $(row)
        .find('td')
        .toArray()
        .map((cell) => $(cell).text().trim());
      if (positionIndex < 0 || numberIndex < 0 || bestIndex < 0) return;
      if (cells.length <= Math.max(positionIndex, numberIndex, bestIndex)) return;
      const position = parseInteger(cells[positionIndex] ?? '');
      const number = parseInteger(cells[numberIndex] ?? '');
      const bestScore = parseFloatScore(cells[bestIndex] ?? '');
      if (position == null || number == null || bestScore == null) return;
      qualByNumber.set(number, { position, bestScore });
    });
  }

  const tandemTable =
    findTable($, ['driver', 'model', 'points'], {
      exclude: ['best', 'group', 'tsuiso', 'tanso', 'tuiso'],
    }) ??
    findTable($, ['driver', 'tuiso']) ??
    findTable($, ['driver', 'tsuiso']) ??
    findTable($, ['driver', 'model'], { exclude: ['best', 'group'] });
  if (tandemTable) {
    const headers = tableHeaders($, tandemTable);
    const positionIndex = headerIndex(headers, ['rank', 'pos', '順位']);
    const numberIndex = headerIndex(headers, ['no']);
    tandemTable.find('tr').slice(1).each((_, row) => {
      const cells = $(row)
        .find('td')
        .toArray()
        .map((cell) => $(cell).text().trim());
      if (positionIndex < 0 || numberIndex < 0) return;
      if (cells.length <= Math.max(positionIndex, numberIndex)) return;
      const position = parseInteger(cells[positionIndex] ?? '');
      const number = parseInteger(cells[numberIndex] ?? '');
      if (position == null || number == null) return;
      tandemByNumber.set(number, { position });
    });
  }

  return { qualByNumber, tandemByNumber };
}

function parseTsuisoRanking(html: string): { rows: RankingRow[]; roundNumbers: number[] } {
  const $ = cheerio.load(html);
  const table = findTable($, ['driver', 'rd.1']);
  if (!table) {
    throw new Error('D1GP tsuiso ranking table not found');
  }

  const headers = table
    .find('tr')
    .first()
    .find('th,td')
    .toArray()
    .map((cell) => normalizeHeader($(cell).text()));

  const roundColumns = new Map<number, number>();
  for (const [index, header] of headers.entries()) {
    const match = header.match(/^rd\.(\d+)$/);
    if (match) roundColumns.set(Number(match[1]), index);
  }

  const roundNumbers = [...roundColumns.keys()].sort((a, b) => a - b);
  const rows: RankingRow[] = [];
  table.find('tr').slice(1).each((_, row) => {
    const cells = $(row)
      .find('td')
      .toArray()
      .map((cell) => $(cell).text().trim());
    if (cells.length < 6) return;

    const number = parseInteger(cells[1]!);
    if (number == null) return;

    const roundPoints = new Map<number, number>();
    for (const [roundNumber, columnIndex] of roundColumns) {
      const raw = cells[columnIndex]?.trim() ?? '';
      if (!raw) continue;
      const points = parseInteger(raw);
      if (points != null) roundPoints.set(roundNumber, points);
    }

    const totalRaw = cells[cells.length - 1] ?? '';
    const totalPoints = parseInteger(totalRaw) ?? 0;

    const nameJa = cells[2]!;
    registerLatinDriverFromRanking(number, nameJa);

    rows.push({
      number,
      nameJa,
      team: cells[3]!,
      roundPoints,
      totalPoints,
    });
  });

  return { rows, roundNumbers };
}

function parseDriverPhotos(html: string, seasonYear: number): Map<number, string> {
  const byNumber = new Map<number, string>();
  const photoRe = new RegExp(
    `DM${seasonYear}_(\\d+)-([A-Za-z]+(?:-[A-Za-z]+)?)-D(?:-683x1024)?\\.jpg`,
    'gi',
  );

  for (const match of html.matchAll(photoRe)) {
    const number = Number.parseInt(match[1]!, 10);
    const nameSlug = match[2]!;
    const padded = match[1]!.padStart(3, '0');
    const uploadYear = seasonYear >= 2026 ? '2026' : String(seasonYear);
    const url = `${SITE}/wp-content/uploads/${uploadYear}/05/DM${seasonYear}_${padded}-${nameSlug}-D.jpg`;
    byNumber.set(number, url);
  }

  return byNumber;
}

async function discoverRoundReports(categoryUrls: string[]): Promise<Map<number, string>> {
  const byRound = new Map<number, string>();

  for (const categoryUrl of categoryUrls) {
    const feedUrl = categoryUrl.endsWith('/') ? `${categoryUrl}feed/` : `${categoryUrl}/feed/`;
    const xml = await fetchHtml(feedUrl);

    for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = item[1]!;
      const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
      if (!titleMatch || !linkMatch) continue;

      const title = titleMatch[1]!
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
      const link = linkMatch[1]!.trim();

      if (title.includes('エントリー')) continue;
      if (!/(詳細レポート|大会結果|結果発表|レポート)/.test(title)) continue;

      const roundMatch = title.match(/RD\.?\s*(\d+)/i);
      if (!roundMatch) continue;

      const roundNumber = Number.parseInt(roundMatch[1]!, 10);
      if (!byRound.has(roundNumber)) {
        byRound.set(roundNumber, link);
      }
    }
  }

  return byRound;
}

function buildEvents(
  seasonYear: number,
  roundNumbers: number[],
  venueSchedule: Map<number, string>,
  roundDates: Map<number, string>,
  reportRounds: Set<number>,
  rankingRows: RankingRow[],
): D1Event[] {
  return roundNumbers.map((roundNumber) => {
    const trackName = venueSchedule.get(roundNumber) ?? `Round ${roundNumber}`;
    const hasPoints = rankingRows.some((row) => row.roundPoints.has(roundNumber));
    const status: D1Event['status'] =
      reportRounds.has(roundNumber) || hasPoints ? 'FINISHED' : 'SCHEDULED';

    return {
      slug: eventSlug(roundNumber),
      roundNumber,
      name: `Round ${roundNumber} — ${trackName}`,
      trackName,
      startsAt: roundDates.get(roundNumber) ?? approximateEventDate(seasonYear, roundNumber),
      status,
    };
  });
}

function resolveDriver(_seasonYear: number, number: number, nameJa: string) {
  return resolveD1Driver(number, nameJa);
}

export async function fetchD1gpSeason(seasonYear: number): Promise<D1SeasonData> {
  const config = getD1gpSeasonConfig(seasonYear);
  const categoryUrls = config.categorySlugs.map((slug) => `${config.categoryBase}${slug}/`);

  const rankingHtml = await fetchHtml(config.rankingUrl);
  const { rows: rankingRows, roundNumbers } = parseTsuisoRanking(rankingHtml);
  const venueSchedule = parseVenueSchedule(rankingHtml);
  if (config.roundTrackNames) {
    for (const [round, trackName] of Object.entries(config.roundTrackNames)) {
      venueSchedule.set(Number(round), trackName);
    }
  }
  const roundDates = parseRoundEventDates(rankingHtml, seasonYear, config.categoryBase);
  if (config.roundStartsAt) {
    for (const [round, iso] of Object.entries(config.roundStartsAt)) {
      roundDates.set(Number(round), iso);
    }
  }

  const reportUrlsByRound = await discoverRoundReports(categoryUrls);
  const reportRounds = new Set(reportUrlsByRound.keys());

  const reportEntries = [...reportUrlsByRound.entries()].sort(([a], [b]) => a - b);
  const reportHtmls = await Promise.all(reportEntries.map(([, url]) => fetchHtml(url)));
  const reportsByRound = new Map<number, RoundReportData>();
  for (const [index, [roundNumber]] of reportEntries.entries()) {
    reportsByRound.set(roundNumber, parseRoundReport(reportHtmls[index]!));
  }

  let photosByNumber = new Map<number, string>();
  if (config.driversIntroUrl) {
    const driversIntroHtml = await fetchHtml(config.driversIntroUrl);
    photosByNumber = parseDriverPhotos(driversIntroHtml, seasonYear);
  }

  const events = buildEvents(
    seasonYear,
    roundNumbers,
    venueSchedule,
    roundDates,
    reportRounds,
    rankingRows,
  );
  const finishedRounds = events.filter((event) => event.status === 'FINISHED').map((event) => event.roundNumber);

  const pilots: D1Pilot[] = rankingRows
    .filter((row) => row.totalPoints > 0 || [...row.roundPoints.values()].some((points) => points > 0))
    .map((row) => {
      const driver = resolveDriver(seasonYear, row.number, row.nameJa);
      const stages: D1StageResult[] = [];

      for (const roundNumber of finishedRounds) {
        const points = row.roundPoints.get(roundNumber) ?? 0;
        const report = reportsByRound.get(roundNumber);
        const qual = report?.qualByNumber.get(row.number);
        const tandem = report?.tandemByNumber.get(row.number);
        if (points <= 0 && !qual && !tandem) continue;

        stages.push({
          eventSlug: eventSlug(roundNumber),
          roundNumber,
          qualifyingPosition: qual?.position ?? null,
          qualifyingPoints: null,
          qualScore100: qual?.bestScore ?? null,
          tandemPosition: tandem?.position ?? null,
          points,
        });
      }

      return {
        slug: pilotSlug(row.number, driver.firstName, driver.lastName),
        firstName: driver.firstName,
        lastName: driver.lastName,
        nameAlias: driver.nameJa,
        country: driver.country,
        number: row.number,
        team: row.team,
        totalPoints: row.totalPoints,
        photoSourceUrl: photosByNumber.get(row.number) ?? null,
        stages,
      };
    })
    .filter((pilot) => pilot.stages.length > 0);

  return {
    sourceUrl: config.rankingUrl,
    seasonYear,
    events,
    pilots,
  };
}
