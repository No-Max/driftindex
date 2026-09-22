import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import {
  registerLatinDriverFromRanking,
  d1PilotSlugForDriver,
  lookupD1CarNumberByNameJa,
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
  number: number | null;
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
  qualByNameJa: Map<string, { position: number; bestScore: number }>;
  tandemByNumber: Map<number, { position: number }>;
  tandemByNameJa: Map<string, { position: number }>;
}

function normalizeReportDriverName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function emptyRoundReport(): RoundReportData {
  return {
    qualByNumber: new Map(),
    qualByNameJa: new Map(),
    tandemByNumber: new Map(),
    tandemByNameJa: new Map(),
  };
}

interface RankingRow {
  number: number | null;
  nameJa: string;
  team: string;
  roundPoints: Map<number, number>;
  /** Round finish order from legacy ranking cells, e.g. rk2017 「（1）」. */
  roundRanks: Map<number, number>;
  totalPoints: number;
}

const TRACK_LABELS: Record<string, string> = {
  OKUIBUKI: 'Okuibuki Circuit',
  OKUI: 'Okuibuki Circuit',
  TSUKUBA: 'Tsukuba Circuit',
  TOKACHI: 'Tokachi International Speedway',
  MAISHIMA: 'Maishima Sports Island',
  EBISU: 'Ebisu Circuit',
  AUTOPOLIS: 'Autopolis',
  AP: 'Autopolis',
  FUJI: 'Fuji Speedway',
  ODAIBA: 'Odaiba, Tokyo Bay',
  SUZUKA: 'Suzuka Circuit',
  OKAYAMA: 'Okayama International Circuit',
  SUGO: 'Sports Land SUGO',
  NIKKO: 'Nikko Circuit',
  BIHOKU: 'Bihoku Highland Circuit',
  SEKIA: 'Sekia Hills',
  IRWINDALE: 'Irwindale Speedway',
  'TOKYO DRIFT': 'Odaiba, Tokyo Bay',
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

  for (const match of text.matchAll(
    /Rd\.(\d+)(?:&(\d+))?[：:]\s*([A-Za-z][A-Za-z\s]{1,24}?)(?=\s*\/|\s+D1|\s+2019|\s*$)/g,
  )) {
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

  return {
    ...emptyRoundReport(),
    qualByNumber,
    tandemByNumber,
  };
}

function legacyQualRowsFromTable(
  $: cheerio.CheerioAPI,
  table: Element,
  qualByNumber: Map<number, { position: number; bestScore: number }>,
  qualByNameJa: Map<string, { position: number; bestScore: number }>,
): void {
  $(table)
    .find('tbody tr')
    .each((_, row) => {
      const $row = $(row);
      if ($row.find('td[colspan]').length > 0) return;

      const position = parseInteger($row.find('.result-td-pos').first().text());
      const numberCells = $row.find('.result-td-no');
      const numberText =
        numberCells.length >= 3
          ? $(numberCells[1]!).text()
          : numberCells.length >= 1
            ? $(numberCells[0]!).text()
            : '';
      const number = parseInteger(numberText);
      const bestScore =
        parseFloatScore($row.find('.result-td-ave1').first().text()) ??
        parseFloatScore($row.find('.result-td-best').first().text());
      const nameJa = normalizeReportDriverName($row.find('.result-td-driver').first().text());
      if (position == null || number == null || bestScore == null) return;
      qualByNumber.set(number, { position, bestScore });
      if (nameJa) qualByNameJa.set(nameJa, { position, bestScore });
    });
}

function legacyReportTableIsQualifying($: cheerio.CheerioAPI, table: Element): boolean {
  const $table = $(table);
  const heading = $table
    .prevAll('h2, p.common-title-j, p.common-title')
    .first()
    .text()
    .replace(/\s+/g, '');
  if (heading.includes('単走予選')) return true;
  if (heading.includes('単走決勝')) return false;
  return $table.find('.result-ti-ave1, .result-td-ave1').length > 0;
}

function legacyReportSectionMatchesRound(sectionTitle: string, eventRound?: number): boolean {
  if (eventRound == null) return true;
  const match = sectionTitle.match(/第(\d+)戦/);
  if (!match) return true;
  return Number.parseInt(match[1]!, 10) === eventRound;
}

function parseLegacyQualifyingSection(
  html: string,
  eventRound?: number,
): Pick<RoundReportData, 'qualByNumber' | 'qualByNameJa'> {
  const qualByNumber = new Map<number, { position: number; bestScore: number }>();
  const qualByNameJa = new Map<string, { position: number; bestScore: number }>();
  const $ = cheerio.load(html);

  $('h2').each((_, h2) => {
    const title = $(h2).text().replace(/\s+/g, '');
    if (!title.includes('単走予選')) return;
    const sectionHeading = $(h2).prevAll('p.common-title-j').first().text();
    if (!legacyReportSectionMatchesRound(sectionHeading, eventRound)) return;
    let $next = $(h2).next();
    while ($next.length && ($next.is('table.table-result-l') || $next.is('table.table-result-r'))) {
      const table = $next.get(0);
      if (table) legacyQualRowsFromTable($, table, qualByNumber, qualByNameJa);
      $next = $next.next();
    }
  });

  if (qualByNumber.size === 0) {
    const start = html.indexOf('単走予選');
    const end = start === -1 ? -1 : html.indexOf('単走決勝', start + 4);
    if (start !== -1 && end !== -1 && end > start) {
      const $frag = cheerio.load(html.slice(start, end));
      $frag('table.table-result-l, table.table-result-r').each((_, table) => {
        legacyQualRowsFromTable($frag, table, qualByNumber, qualByNameJa);
      });
    }
  }

  if (qualByNumber.size === 0) {
    for (const table of $('table.table-result-l, table.table-result-r').toArray()) {
      if (!legacyReportTableIsQualifying($, table)) continue;
      legacyQualRowsFromTable($, table, qualByNumber, qualByNameJa);
    }
  }

  return { qualByNumber, qualByNameJa };
}

function legacyReportTableIsOverallTandem($: cheerio.CheerioAPI, table: Element): boolean {
  const $table = $(table);
  const sectionTitle = $table
    .find('thead .tanking-table-mi, thead td[class*="table-mi"]')
    .first()
    .text()
    .replace(/\s+/g, '');
  if (sectionTitle.includes('総合')) return true;
  if (sectionTitle.includes('単走') || sectionTitle.includes('チーム')) return false;

  const heading = $table.prevAll('h2').first().text().replace(/\s+/g, '');
  if (heading.includes('総合')) return true;
  if (heading.includes('単走') || heading.includes('チーム')) return false;

  return legacyReportRankingTables($).length === 1;
}

function legacyReportRankingTables($: cheerio.CheerioAPI): Element[] {
  return [...$('table.ranking-table').toArray(), ...$('table#ranking-table').toArray()].filter(
    (table, index, tables) => tables.indexOf(table) === index,
  );
}

function parseLegacyTandemFromReport(
  $: cheerio.CheerioAPI,
  eventRound?: number,
): Pick<RoundReportData, 'tandemByNumber' | 'tandemByNameJa'> {
  const tandemByNumber = new Map<number, { position: number }>();
  const tandemByNameJa = new Map<string, { position: number }>();

  const recordTandemRow = ($row: cheerio.Cheerio<Element>, position: number | null) => {
    if (position == null) return;
    const number = parseInteger($row.find('.rank-td-no').first().text());
    const nameJa = normalizeReportDriverName($row.find('.rank-td-driver').first().text());
    if (number != null) tandemByNumber.set(number, { position });
    if (nameJa) tandemByNameJa.set(nameJa, { position });
  };

  for (const table of legacyReportRankingTables($)) {
    if (!legacyReportTableIsOverallTandem($, table)) continue;
    $(table)
      .find('tbody tr')
      .each((_, row) => {
        recordTandemRow($(row), parseInteger($(row).find('.rank-td-other').first().text()));
      });
  }

  $('h4').each((_, h4) => {
    const title = $(h4).text().replace(/\s+/g, '');
    if (!title.includes('ドライバー総合順位')) return;
    const sectionHeading = $(h4).prevAll('p.common-title-j').first().text();
    if (!legacyReportSectionMatchesRound(sectionHeading, eventRound)) return;
    $(h4)
      .nextAll('table.ranking-table')
      .first()
      .find('tbody tr')
      .each((_, row) => {
        recordTandemRow($(row), parseInteger($(row).find('.rank-td-other').first().text()));
      });
  });

  for (const table of $('table.result').toArray()) {
    const $table = $(table);
    const sectionMarker = $table.find('.rti-mi').first().text().replace(/\s+/g, '');
    if (!sectionMarker.includes('総合順位') || sectionMarker.includes('シリーズ')) continue;
    const sectionHeading = $table.prevAll('p.common-title-j').first().text();
    if (!legacyReportSectionMatchesRound(sectionHeading, eventRound)) continue;

    $table.find('tr').each((_, row) => {
      const $row = $(row);
      if ($row.find('.rtia-pos, .rtia-no').length > 0) return;
      const position = parseInteger($row.find('.rta-pos').first().text());
      const number = parseInteger($row.find('.rta-no').first().text());
      if (position == null || number == null) return;
      if (number != null) tandemByNumber.set(number, { position });
    });
  }

  return { tandemByNumber, tandemByNameJa };
}

/** gp2014-style reports (`table.r-tb`, `td.r-mi`). */
function parseLegacy2014RoundReport(html: string, eventRound?: number): RoundReportData {
  const $ = cheerio.load(html);
  const qualByNumber = new Map<number, { position: number; bestScore: number }>();
  const qualByNameJa = new Map<string, { position: number; bestScore: number }>();

  for (const table of $('table.r-tb').toArray()) {
    const sectionHeading = $(table).prevAll('p.common-title-j').first().text();
    if (!legacyReportSectionMatchesRound(sectionHeading, eventRound)) continue;

    let inQualSection = false;
    $(table)
      .find('tr')
      .each((_, row) => {
        const $row = $(row);
        const sectionMarker = $row.find('td.r-mi').first().text().replace(/\s+/g, '');
        if (
          sectionMarker.includes('単走決勝') ||
          sectionMarker.includes('予備予選') ||
          sectionMarker.includes('追走')
        ) {
          inQualSection = false;
        } else if (
          sectionMarker.includes('単走予選') ||
          (sectionMarker.includes('予選結果') && !sectionMarker.includes('追走'))
        ) {
          inQualSection = true;
        }
        if (!inQualSection || $row.find('td.r-ti').length > 0) return;

        const cells = $row.find('td');
        if (cells.length < 5) return;
        const position = parseInteger($(cells[0]!).text());
        const number = parseInteger($(cells[1]!).text());
        const scoreCell = $(cells[cells.length - 1]!);
        const bestScore = parseFloatScore(scoreCell.text());
        if (position == null || number == null || bestScore == null) return;
        qualByNumber.set(number, { position, bestScore });
      });
  }

  const tandem = parseLegacyTandemFromReport($, eventRound);
  return { qualByNumber, qualByNameJa, ...tandem };
}

/** gp2015-style reports (`event-repo-table`, no table-result-l). */
function parseLegacy2015RoundReport(html: string, eventRound?: number): RoundReportData {
  const $ = cheerio.load(html);
  const qualByNumber = new Map<number, { position: number; bestScore: number }>();
  const qualByNameJa = new Map<string, { position: number; bestScore: number }>();

  for (const table of $('table#event-repo-table').toArray()) {
    let inQualSection = false;
    $(table)
      .find('tr')
      .each((_, row) => {
        const $row = $(row);
        const sectionMarker = $row
          .find('.repo-table-mi-l, .repo-table-mi-r')
          .first()
          .text()
          .replace(/\s+/g, '');
        if (
          sectionMarker.includes('予備予選') ||
          sectionMarker.includes('追走') ||
          sectionMarker.includes('単走決勝')
        ) {
          inQualSection = false;
        } else if (
          sectionMarker.includes('単走予選') ||
          (sectionMarker.includes('予選結果') && !sectionMarker.includes('追走'))
        ) {
          inQualSection = true;
        }
        if (!inQualSection || $row.find('.repo-table-ti-l, .repo-table-ti-r').length > 0) {
          return;
        }

        const position = parseInteger($row.find('.repo-table-pos').first().text());
        const number = parseInteger($row.find('.repo-table-no').first().text());
        const bestScore = parseFloatScore($row.find('.repo-table-score').first().text());
        if (position == null || number == null || bestScore == null) return;
        qualByNumber.set(number, { position, bestScore });
      });
  }

  const tandem = parseLegacyTandemFromReport($, eventRound);
  return { qualByNumber, qualByNameJa, ...tandem };
}

/** Pre-WP event reports under www.d1gp.co.jp/03_sche/ (2019 etc.). */
function parseLegacyRoundReport(html: string, eventRound?: number): RoundReportData {
  const $ = cheerio.load(html);
  const qual = parseLegacyQualifyingSection(html, eventRound);
  const tandem = parseLegacyTandemFromReport($, eventRound);
  return { ...qual, ...tandem };
}

function parseRoundReportFromHtml(html: string, eventRound?: number): RoundReportData {
  if (
    html.includes('table-result-l') &&
    (html.includes('result-td-ave1') || html.includes('result-td-best'))
  ) {
    return parseLegacyRoundReport(html, eventRound);
  }
  if (html.includes('event-repo-table') && html.includes('repo-table-score')) {
    return parseLegacy2015RoundReport(html, eventRound);
  }
  if (html.includes('class="r-tb"') && html.includes('r-mi')) {
    return parseLegacy2014RoundReport(html, eventRound);
  }
  return parseRoundReport(html);
}

function parseLegacyRankingRoundPoints(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-') return null;
  const beforeParens = trimmed.split(/[（(]/)[0]?.trim() ?? '';
  if (!beforeParens) return null;
  const leading = beforeParens.match(/^-?\d+(?:\.\d+)?/);
  if (!leading) return null;
  const parsed = Number.parseFloat(leading[0]!);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLegacyRankingRoundRank(raw: string): number | null {
  const match = raw.match(/[（(](\d+)[）)]/);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

/** Prize-place colors on 04_rank cells: 1 red, 2 orange, 3 gold. */
function parseLegacyRankingPrizeColorRank(html: string): number | null {
  if (/\bcolor-f00\b|color\s*:\s*#f00\b/i.test(html)) return 1;
  if (/\bcolor-f60\b|color\s*:\s*#f60\b/i.test(html)) return 2;
  if (/\bcolor-cc0\b|color\s*:\s*#cc0\b/i.test(html)) return 3;
  return null;
}

function parseLegacyRankingRoundCell(
  $: cheerio.CheerioAPI,
  cell: Element,
): { points: number | null; rank: number | null } {
  const $cell = $(cell);
  const raw = $cell.text();
  const points = parseLegacyRankingRoundPoints(raw);
  const rank =
    parseLegacyRankingRoundRank(raw) ?? parseLegacyRankingPrizeColorRank($cell.html() ?? '');
  return { points, rank };
}

function parseLegacyStaticRankingTable(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>,
): { rows: RankingRow[]; roundNumbers: number[] } {
  const roundNumbers: number[] = [];
  table.find('thead .rank-ti-round').each((_, cell) => {
    const match = $(cell).text().trim().match(/Rd\.(\d+)/i);
    if (match) roundNumbers.push(Number.parseInt(match[1]!, 10));
  });

  const rows: RankingRow[] = [];
  table.find('tbody tr').each((_, row) => {
    const $row = $(row);
    const nameJa = $row.find('.rank-td-driver').first().text().trim();
    if (!nameJa) return;

    let number =
      parseInteger($row.find('.rank-td-no').first().text()) ?? lookupD1CarNumberByNameJa(nameJa);
    const team = $row.find('.rank-td-team').first().text().trim();
    const roundPoints = new Map<number, number>();
    const roundRanks = new Map<number, number>();
    $row.find('.rank-td-round').each((index, cell) => {
      const roundNumber = roundNumbers[index];
      if (roundNumber == null) return;
      const { points, rank } = parseLegacyRankingRoundCell($, cell);
      if (points != null) roundPoints.set(roundNumber, points);
      if (rank != null) roundRanks.set(roundNumber, rank);
    });

    const totalRaw = $row.find('.rank-td-total').first().text().trim();
    const totalPoints = parseLegacyRankingRoundPoints(totalRaw) ?? parseInteger(totalRaw) ?? 0;
    registerLatinDriverFromRanking(number, nameJa);

    rows.push({ number, nameJa, team, roundPoints, roundRanks, totalPoints });
  });

  return { rows, roundNumbers };
}

function parseLegacyStaticRankingSection(
  html: string,
  headingNeedle: string,
): { rows: RankingRow[]; roundNumbers: number[] } | null {
  const $ = cheerio.load(html);
  let found: { rows: RankingRow[]; roundNumbers: number[] } | null = null;

  $('p.common-title-j, p.common-title').each((_, heading) => {
    if (!$(heading).text().includes(headingNeedle)) return;
    const table = $(heading).nextAll('div.event-box').first().find('table.ranking-table').first();
    if (!table.length) return;
    found = parseLegacyStaticRankingTable($, table);
    return false;
  });

  return found;
}

/** 2012 rk2012.html hides the tanso (qual) points table inside an HTML comment. */
function parseLegacyTansoRankingInComment(html: string): RankingRow[] {
  const marker = 'Tanso Ranking';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return [];

  const commentStart = html.lastIndexOf('<!--', markerIndex);
  const commentEnd = html.indexOf('-->', markerIndex);
  if (commentStart === -1 || commentEnd === -1 || commentEnd <= commentStart) return [];

  const fragment = html.slice(commentStart + 4, commentEnd);
  if (!fragment.includes('ranking-table')) return [];

  try {
    const $ = cheerio.load(`<div>${fragment}</div>`);
    const table = $('table.ranking-table').first();
    if (!table.length) return [];
    return parseLegacyStaticRankingTable($, table).rows;
  } catch {
    return [];
  }
}

function parseLegacyTansoRankingRows(html: string): RankingRow[] {
  const fromComment = parseLegacyTansoRankingInComment(html);
  if (fromComment.length > 0) return fromComment;

  for (const needle of ['Tanso Ranking', '単走ランキング']) {
    const section = parseLegacyStaticRankingSection(html, needle);
    if (section && section.rows.length > 0) return section.rows;
  }

  return [];
}

/** Per-round tanso table: prefer printed （N）, else rank by championship qual points. */
function qualGridFromTansoRankingRows(
  tansoRows: RankingRow[],
  roundNumbers: number[],
): Map<number, Map<string, { position: number; points: number }>> {
  const byRound = new Map<number, Map<string, { position: number; points: number }>>();

  for (const roundNumber of roundNumbers) {
    const byName = new Map<string, { position: number; points: number }>();
    const inferred: { nameJa: string; points: number }[] = [];

    for (const row of tansoRows) {
      const points = row.roundPoints.get(roundNumber);
      if (points == null || points <= 0) continue;
      const printed = row.roundRanks.get(roundNumber);
      if (printed != null) {
        byName.set(row.nameJa, { position: printed, points });
      } else {
        inferred.push({ nameJa: row.nameJa, points });
      }
    }

    inferred.sort((a, b) => b.points - a.points);
    let position = 0;
    let prevPoints: number | null = null;
    for (let index = 0; index < inferred.length; index++) {
      const entry = inferred[index]!;
      if (prevPoints !== entry.points) {
        position = index + 1;
        prevPoints = entry.points;
      }
      byName.set(entry.nameJa, { position, points: entry.points });
    }
    byRound.set(roundNumber, byName);
  }

  return byRound;
}

/** When 04_rank cells have points but no （N）, derive event place from that round's points. */
function fillMissingRoundRanksFromPoints(rows: RankingRow[]): void {
  const roundNumbers = new Set<number>();
  for (const row of rows) {
    for (const roundNumber of row.roundPoints.keys()) roundNumbers.add(roundNumber);
  }

  for (const roundNumber of roundNumbers) {
    if (rows.some((row) => row.roundRanks.has(roundNumber))) continue;

    const inferred = rows
      .map((row) => ({ row, points: row.roundPoints.get(roundNumber) }))
      .filter((entry): entry is { row: RankingRow; points: number } => (entry.points ?? 0) > 0)
      .sort((a, b) => b.points - a.points);

    let position = 0;
    let prevPoints: number | null = null;
    for (let index = 0; index < inferred.length; index++) {
      const entry = inferred[index]!;
      if (prevPoints !== entry.points) {
        position = index + 1;
        prevPoints = entry.points;
      }
      entry.row.roundRanks.set(roundNumber, position);
    }
  }
}

function parseLegacyStaticRanking(html: string): { rows: RankingRow[]; roundNumbers: number[] } {
  const $ = cheerio.load(html);
  const table = $('table.ranking-table').first();
  if (!table.length) {
    throw new Error('D1GP legacy ranking table not found');
  }
  return parseLegacyStaticRankingTable($, table);
}

function parseLegacy2014Ranking(html: string): { rows: RankingRow[]; roundNumbers: number[] } {
  const $ = cheerio.load(html);
  const table = $('table.ranking').first();
  if (!table.length) {
    throw new Error('D1GP 2014 ranking table not found');
  }

  const roundNumbers: number[] = [];
  table.find('thead .rkta-round, thead .rkta-final').each((_, cell) => {
    const match = $(cell).text().trim().match(/Rd\.(\d+)/i);
    if (match) roundNumbers.push(Number.parseInt(match[1]!, 10));
  });

  const rows: RankingRow[] = [];
  table.find('tbody.rkb tr').each((_, row) => {
    const $row = $(row);
    const number = parseInteger($row.find('.rkb-no').first().text());
    if (number == null) return;

    const nameJa = $row.find('.rkb-driver').first().text().trim();
    const team = $row.find('.rkb-team').first().text().trim();
    const roundPoints = new Map<number, number>();
    const roundRanks = new Map<number, number>();

    $row.find('.rkb-round').each((index, cell) => {
      const roundNumber = roundNumbers[index];
      if (roundNumber == null) return;
      const { points, rank } = parseLegacyRankingRoundCell($, cell);
      if (points != null) roundPoints.set(roundNumber, points);
      if (rank != null) roundRanks.set(roundNumber, rank);
    });

    const finalIndex = roundNumbers.length - 1;
    const finalRound = roundNumbers[finalIndex];
    if (finalRound != null) {
      const finalCell = $row.find('.rkb-final').get(0);
      if (finalCell) {
        const { points, rank } = parseLegacyRankingRoundCell($, finalCell);
        if (points != null) roundPoints.set(finalRound, points);
        if (rank != null) roundRanks.set(finalRound, rank);
      }
    }

    const totalRaw = $row.find('.rkb-total').first().text().trim();
    const totalPoints = parseLegacyRankingRoundPoints(totalRaw) ?? 0;
    registerLatinDriverFromRanking(number, nameJa);

    rows.push({ number, nameJa, team, roundPoints, roundRanks, totalPoints });
  });

  return { rows, roundNumbers };
}

function parseTsuisoRanking(html: string): { rows: RankingRow[]; roundNumbers: number[] } {
  if (html.includes('ranking-table') && html.includes('rank-td-driver')) {
    for (const needle of ['Drivers Ranking', 'ドライバーズランキング']) {
      const section = parseLegacyStaticRankingSection(html, needle);
      if (section) return section;
    }
    for (const needle of ['Tsuiso Ranking', '追走ランキング']) {
      const section = parseLegacyStaticRankingSection(html, needle);
      if (section) return section;
    }
    return parseLegacyStaticRanking(html);
  }
  if (html.includes('class="ranking"') && html.includes('rkb-driver')) {
    return parseLegacy2014Ranking(html);
  }

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
      roundRanks: new Map(),
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
  auxPointsRows: RankingRow[] = [],
): D1Event[] {
  const seasonIsPast = seasonYear < new Date().getUTCFullYear();
  return roundNumbers.map((roundNumber) => {
    const trackName = venueSchedule.get(roundNumber) ?? `Round ${roundNumber}`;
    const hasPoints = [...rankingRows, ...auxPointsRows].some(
      (row) => (row.roundPoints.get(roundNumber) ?? 0) > 0,
    );
    const status: D1Event['status'] =
      reportRounds.has(roundNumber) || hasPoints || seasonIsPast ? 'FINISHED' : 'SCHEDULED';

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
  let { rows: rankingRows, roundNumbers } = parseTsuisoRanking(rankingHtml);
  fillMissingRoundRanksFromPoints(rankingRows);
  const tansoRankingRows = parseLegacyTansoRankingRows(rankingHtml);
  const tansoRoundNumbers =
    tansoRankingRows.length > 0
      ? [
          ...new Set(tansoRankingRows.flatMap((row) => [...row.roundPoints.keys()])),
        ].sort((a, b) => a - b)
      : [];
  if (config.roundStartsAt) {
    roundNumbers = [
      ...new Set([...roundNumbers, ...Object.keys(config.roundStartsAt).map(Number)]),
    ].sort((a, b) => a - b);
  }
  const qualRoundNumbers = tansoRoundNumbers.length > 0 ? tansoRoundNumbers : roundNumbers;
  const qualByRoundFromTanso =
    tansoRankingRows.length > 0
      ? qualGridFromTansoRankingRows(tansoRankingRows, qualRoundNumbers)
      : new Map<number, Map<string, { position: number; points: number }>>();
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

  const reportUrlsByRound = new Map<number, string>();
  if (config.legacyReportUrls) {
    for (const [round, url] of Object.entries(config.legacyReportUrls)) {
      reportUrlsByRound.set(Number(round), url);
    }
  }
  const discoveredReports = await discoverRoundReports(categoryUrls);
  for (const [roundNumber, url] of discoveredReports) {
    if (!reportUrlsByRound.has(roundNumber)) {
      reportUrlsByRound.set(roundNumber, url);
    }
  }
  const reportRounds = new Set(reportUrlsByRound.keys());

  const reportHtmlByUrl = new Map<string, string>();
  const reportsByRound = new Map<number, RoundReportData>();
  for (const [roundNumber, url] of [...reportUrlsByRound.entries()].sort(([a], [b]) => a - b)) {
    let html = reportHtmlByUrl.get(url);
    if (!html) {
      try {
        html = await fetchHtml(url);
        reportHtmlByUrl.set(url, html);
      } catch (error) {
        console.warn(
          `D1GP ${seasonYear} RD${roundNumber}: report unavailable (${url}): ${
            error instanceof Error ? error.message : error
          }`,
        );
        continue;
      }
    }
    reportsByRound.set(roundNumber, parseRoundReportFromHtml(html, roundNumber));
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
    tansoRankingRows,
  );
  const finishedRounds = events.filter((event) => event.status === 'FINISHED').map((event) => event.roundNumber);

  const pilots: D1Pilot[] = rankingRows
    .filter((row) => row.totalPoints > 0 || [...row.roundPoints.values()].some((points) => points > 0))
    .map((row) => {
      const driver = resolveDriver(seasonYear, row.number ?? 0, row.nameJa);
      const stages: D1StageResult[] = [];

      for (const roundNumber of finishedRounds) {
        const points = row.roundPoints.get(roundNumber) ?? 0;
        const report = reportsByRound.get(roundNumber);
        const driverName = normalizeReportDriverName(row.nameJa);
        const qual =
          (row.number != null ? report?.qualByNumber.get(row.number) : undefined) ??
          report?.qualByNameJa.get(driverName);
        const tansoQual = qualByRoundFromTanso.get(roundNumber)?.get(row.nameJa);
        const tandem =
          (row.number != null ? report?.tandemByNumber.get(row.number) : undefined) ??
          report?.tandemByNameJa.get(driverName);
        const rankingRoundRank = row.roundRanks.get(roundNumber);
        const tandemPosition = rankingRoundRank ?? tandem?.position ?? null;
        const qualifyingPosition = qual?.position ?? tansoQual?.position ?? null;
        const qualifyingPoints = tansoQual?.points ?? null;
        if (points <= 0 && qualifyingPosition == null && qual?.bestScore == null && tandemPosition == null) {
          continue;
        }

        stages.push({
          eventSlug: eventSlug(roundNumber),
          roundNumber,
          qualifyingPosition,
          qualifyingPoints,
          qualScore100: qual?.bestScore ?? null,
          tandemPosition,
          points,
        });
      }

      return {
        slug: d1PilotSlugForDriver(driver, row.number),
        firstName: driver.firstName,
        lastName: driver.lastName,
        nameAlias: driver.nameJa,
        country: driver.country,
        number: row.number,
        team: row.team,
        totalPoints: row.totalPoints,
        photoSourceUrl: row.number != null ? (photosByNumber.get(row.number) ?? null) : null,
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
