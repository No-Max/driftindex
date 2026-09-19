import * as cheerio from 'cheerio';
import type { DmEvent, DmPilot, DmSeasonData, DmStageResult } from './drift-masters.js';
import { normalizeCountryCode } from '../lib/countryCode.js';

const WAYBACK = 'https://web.archive.org/web';

/** Best archived driftmasters.gp snapshot per season year. */
export const DM_ARCHIVE_SNAPSHOTS: Record<number, string> = {
  /** /klasyfikacja-2015/ — per-round qual+fin totals (10 rounds). */
  2015: '20151121005140',
  /** /article/klasyfikacja-generalna — Eliminacje + Finały × 12 rounds. */
  2016: '20161221160808',
  2017: '20181217014814',
  2018: '20181217014814',
  2019: '20191122200048',
  2021: '20220104225713',
  2022: '20221203083725',
};

/** Typos on archived klasyfikacja pages. */
const DM_LEGACY_DRIVER_NAME_FIX: Record<string, string> = {
  'James Dean': 'James Deane',
  'Marek Wartalowicz': 'Marek Wartałowicz',
  'Phil Morisson': 'Phil Morrison',
  'Christaps Bluss': 'Kristaps Bluss',
  'Pawlonka Artur': 'Artur Pawlonka',
  'Marcehl Uhlig': 'Marcel Uhlig',
  'Redl Roland': 'Roland Redl',
};

/** Known venues/dates for archive standings seasons (generic event placeholders otherwise). */
const DM_ARCHIVE_STANDINGS_EVENT_TRACKS: Partial<
  Record<number, Array<{ roundNumber: number; trackName: string; month: number; day: number }>>
> = {
  2017: [
    { roundNumber: 1, trackName: 'Tor Poznań', month: 3, day: 22 },
    { roundNumber: 2, trackName: 'Nürburgring', month: 4, day: 20 },
    { roundNumber: 3, trackName: 'Stadion Wisły Płock', month: 5, day: 10 },
    { roundNumber: 4, trackName: 'Motoarena Toruń', month: 6, day: 8 },
    { roundNumber: 5, trackName: 'Biķernieki Circuit', month: 7, day: 12 },
    { roundNumber: 6, trackName: 'Hockenheimring', month: 7, day: 26 },
  ],
  2021: [
    { roundNumber: 1, trackName: 'PS Racing Center Greinbach', month: 7, day: 10 },
    { roundNumber: 2, trackName: 'PS Racing Center Greinbach', month: 7, day: 11 },
    { roundNumber: 3, trackName: 'Biķernieki Trase, Riga', month: 7, day: 31 },
    { roundNumber: 4, trackName: 'Biķernieki Trase, Riga', month: 8, day: 1 },
  ],
  2022: [
    { roundNumber: 1, trackName: 'Mondello Park, Ireland', month: 5, day: 8 },
    { roundNumber: 2, trackName: 'PS Racing Center Greinbach', month: 6, day: 19 },
    { roundNumber: 3, trackName: 'Drivecenter Arena, Fallfors', month: 7, day: 2 },
    { roundNumber: 4, trackName: 'Biķernieki Trase, Riga', month: 7, day: 30 },
    { roundNumber: 5, trackName: 'Ferropolis, Germany', month: 8, day: 20 },
    { roundNumber: 6, trackName: 'Moto Arena, Łódź', month: 10, day: 1 },
  ],
  2018: [
    { roundNumber: 1, trackName: 'Stadion Wisły Płock', month: 5, day: 8 },
    { roundNumber: 2, trackName: 'Rabócsiring Máriapócs', month: 5, day: 22 },
    { roundNumber: 3, trackName: 'Biķernieki Circuit', month: 7, day: 3 },
    { roundNumber: 4, trackName: 'Motoarena Toruń', month: 7, day: 17 },
    { roundNumber: 5, trackName: 'Hockenheimring', month: 8, day: 7 },
    { roundNumber: 6, trackName: 'Mondello Park', month: 8, day: 22 },
  ],
};

interface DmLegacySeasonMeta {
  path: string;
  roundCount: number;
  /** kw + fin + total per round (2015 klasyfikacja page). */
  columnsPerRound: 2 | 3;
  tableSelector: 'klasyfikacja' | 'article-table';
  eventTracks: Array<{ roundNumber: number; trackName: string; month: number; day: number }>;
}

const DM_LEGACY_SEASON_META: Partial<Record<number, DmLegacySeasonMeta>> = {
  2015: {
    path: 'klasyfikacja-2015/',
    roundCount: 10,
    columnsPerRound: 3,
    tableSelector: 'klasyfikacja',
    eventTracks: [
      { roundNumber: 1, trackName: 'Autodrom Jastrząb', month: 4, day: 2 },
      { roundNumber: 2, trackName: 'Autodrom Jastrząb', month: 4, day: 3 },
      { roundNumber: 3, trackName: 'Tor Poznań', month: 4, day: 30 },
      { roundNumber: 4, trackName: 'Tor Poznań', month: 5, day: 1 },
      { roundNumber: 5, trackName: 'Stadion Wisły Płock', month: 5, day: 20 },
      { roundNumber: 6, trackName: 'Stadion Wisły Płock', month: 5, day: 21 },
      { roundNumber: 7, trackName: 'INEA Stadion', month: 8, day: 5 },
      { roundNumber: 8, trackName: 'INEA Stadion', month: 8, day: 6 },
      { roundNumber: 9, trackName: 'Motoarena Toruń', month: 9, day: 17 },
      { roundNumber: 10, trackName: 'Motoarena Toruń', month: 9, day: 18 },
    ],
  },
  2016: {
    path: 'article/klasyfikacja-generalna',
    roundCount: 12,
    columnsPerRound: 2,
    tableSelector: 'article-table',
    eventTracks: [
      { roundNumber: 1, trackName: 'Tor Poznań', month: 3, day: 9 },
      { roundNumber: 2, trackName: 'Tor Poznań', month: 3, day: 10 },
      { roundNumber: 3, trackName: 'Stadion Wisły Płock', month: 5, day: 4 },
      { roundNumber: 4, trackName: 'Stadion Wisły Płock', month: 5, day: 5 },
      { roundNumber: 5, trackName: 'Ptak Warsaw Expo', month: 5, day: 18 },
      { roundNumber: 6, trackName: 'Ptak Warsaw Expo', month: 5, day: 19 },
      { roundNumber: 7, trackName: 'Biķernieki Circuit', month: 8, day: 17 },
      { roundNumber: 8, trackName: 'Biķernieki Circuit', month: 8, day: 18 },
      { roundNumber: 9, trackName: 'AmberExpo Gdańsk', month: 8, day: 24 },
      { roundNumber: 10, trackName: 'AmberExpo Gdańsk', month: 8, day: 25 },
      { roundNumber: 11, trackName: 'Stadion Wisły Płock', month: 9, day: 15 },
      { roundNumber: 12, trackName: 'Stadion Wisły Płock', month: 9, day: 16 },
    ],
  },
};

export const DM_ARCHIVE_SEASONS = Object.keys(DM_ARCHIVE_SNAPSHOTS)
  .map(Number)
  .sort((a, b) => a - b);

function archiveStandingsUrl(snapshot: string): string {
  return `${WAYBACK}/${snapshot}/https://driftmasters.gp/standings/`;
}

function archiveDriversUrl(snapshot: string): string {
  return `${WAYBACK}/${snapshot}/https://www.driftmasters.gp/drivers/`;
}

export interface DmArchiveDriverNumber {
  number: number;
  name: string;
}

/** Start numbers from archived driftmasters.gp/drivers (2019+ standings omit bibs). */
export async function fetchDriftMastersArchiveDriverNumbers(
  seasonYear: number,
): Promise<DmArchiveDriverNumber[]> {
  const snapshot = DM_ARCHIVE_SNAPSHOTS[seasonYear];
  if (!snapshot) return [];

  const sourceUrl = archiveDriversUrl(snapshot);
  try {
    const response = await fetch(sourceUrl, {
      headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
    });
    if (!response.ok) {
      console.warn(`Archive drivers fetch failed ${sourceUrl}: ${response.status}`);
      return [];
    }
    const html = await response.text();
    const pairs: DmArchiveDriverNumber[] = [];
    const pattern = /class="num">(\d+)\.<\/span>\s*([^<]+)/g;
    for (const match of html.matchAll(pattern)) {
      const number = Number.parseInt(match[1]!, 10);
      const rawName = match[2]!
        .replace(/&#[0-9]+;/g, (entity) => {
          const code = Number.parseInt(entity.slice(2, -1), 10);
          return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
        })
        .replace(/\s+/g, ' ')
        .trim();
      if (!Number.isFinite(number) || !rawName) continue;
      pairs.push({ number, name: rawName });
    }
    return pairs;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Archive drivers fetch error: ${message}`);
    return [];
  }
}

function archiveLegacyClassificationUrl(snapshot: string, path: string): string {
  return `${WAYBACK}/${snapshot}/http://www.driftmasters.gp/${path}`;
}

function parseLegacyDriverCell(raw: string): { name: string; number: number | null } {
  const match = raw.match(/^(.+?)\s*\((\d+)\)$/);
  if (match) {
    return { name: match[1]!.trim(), number: Number.parseInt(match[2]!, 10) };
  }
  return { name: raw.trim(), number: null };
}

function parseLegacyRoundCell(cell: string): number {
  if (!cell || cell === '----') return 0;
  const parsed = Number.parseFloat(cell.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

interface LegacyRoundCell {
  kw: number;
  fin: number;
  total: number;
}

interface LegacyDriverRow {
  name: string;
  rawName: string;
  number: number | null;
  country: string | null;
  rounds: LegacyRoundCell[];
  totalPoints: number;
}

function fixLegacyDriverName(name: string): string {
  return DM_LEGACY_DRIVER_NAME_FIX[name] ?? name;
}

function parseLegacyDriverRowsFromCells(
  cells: string[],
  meta: DmLegacySeasonMeta,
): LegacyDriverRow | null {
  if (cells.length < 2 + meta.roundCount * meta.columnsPerRound + 1) return null;

  const place = Number.parseInt(cells[0] ?? '', 10);
  if (!Number.isFinite(place) || place <= 0) return null;

  const rawName = cells[1] ?? '';
  const parsedCell = parseLegacyDriverCell(rawName);
  const name = fixLegacyDriverName(parsedCell.name);
  const number = parsedCell.number;

  const rounds: LegacyRoundCell[] = [];
  for (let roundIndex = 0; roundIndex < meta.roundCount; roundIndex++) {
    const base = 2 + roundIndex * meta.columnsPerRound;
    const kw = parseLegacyRoundCell(cells[base] ?? '');
    const fin = parseLegacyRoundCell(cells[base + 1] ?? '');
    if (meta.columnsPerRound === 3) {
      const totalFromCells = parseLegacyRoundCell(cells[base + 2] ?? '');
      rounds.push({
        kw,
        fin,
        total: totalFromCells > 0 ? totalFromCells : kw + fin,
      });
    } else {
      rounds.push({ kw, fin, total: kw + fin });
    }
  }

  const totalRaw = cells[cells.length - 1] ?? '';
  const totalFromRow = Number.parseFloat(totalRaw.replace(',', '.'));
  const totalPoints = Number.isFinite(totalFromRow)
    ? Math.round(totalFromRow)
    : rounds.reduce((sum, round) => sum + round.total, 0);
  if (totalPoints <= 0) return null;

  return { name, rawName: rawName || name, number, country: null, rounds, totalPoints };
}

/** Competition rank (1,2,2,4…) on a numeric key; higher is better. */
function legacyRoundRank(
  rows: LegacyDriverRow[],
  roundIndex: number,
  key: 'kw' | 'fin',
): Map<number, number> {
  const entries = rows
    .map((row, rowIndex) => ({
      rowIndex,
      value: row.rounds[roundIndex]?.[key] ?? 0,
      tieBreak: key === 'kw' ? (row.rounds[roundIndex]?.fin ?? 0) : (row.rounds[roundIndex]?.kw ?? 0),
    }))
    .filter((entry) => entry.value > 0);

  entries.sort((a, b) => b.value - a.value || b.tieBreak - a.tieBreak);

  const rankByRow = new Map<number, number>();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const prev = entries[i - 1];
    const rank = i === 0 || entry.value !== prev!.value ? i + 1 : rankByRow.get(prev!.rowIndex)!;
    rankByRow.set(entry.rowIndex, rank);
  }
  return rankByRow;
}

function parsePairRoundDetails(cells: string[], roundCount: number, dataStartCol: number): LegacyRoundCell[] {
  const rounds: LegacyRoundCell[] = [];
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const base = dataStartCol + roundIndex * 2;
    const kw = parseIntCell(cells[base] ?? '') ?? 0;
    const fin = parseIntCell(cells[base + 1] ?? '') ?? 0;
    rounds.push({ kw, fin, total: kw + fin });
  }
  return rounds;
}

/** DMEC standings tab: per round A (appearance) + Q (qual points) + B (battle points). */
function parseTripleRoundDetails(cells: string[], roundCount: number, dataStartCol: number): LegacyRoundCell[] {
  const rounds: LegacyRoundCell[] = [];
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const base = dataStartCol + roundIndex * 3;
    const appearance = parseIntCell(cells[base] ?? '') ?? 0;
    const kw = parseIntCell(cells[base + 1] ?? '') ?? 0;
    const fin = parseIntCell(cells[base + 2] ?? '') ?? 0;
    rounds.push({ kw, fin, total: appearance + kw + fin });
  }
  return rounds;
}

function pilotsFromLegacyDriverRows(driverRows: LegacyDriverRow[], roundCount: number): DmPilot[] {
  const qualRankByRound: Map<number, number>[] = [];
  const tandemRankByRound: Map<number, number>[] = [];
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    qualRankByRound.push(legacyRoundRank(driverRows, roundIndex, 'kw'));
    tandemRankByRound.push(legacyRoundRank(driverRows, roundIndex, 'fin'));
  }

  return driverRows.map((driver, rowIndex) => {
    const stages: DmStageResult[] = driver.rounds
      .map((round, roundIndex) => {
        if (round.total <= 0 && round.kw <= 0 && round.fin <= 0) return null;
        const roundNumber = roundIndex + 1;
        return {
          eventSlug: eventSlug(roundNumber),
          roundNumber,
          qualifyingPosition: round.kw > 0 ? (qualRankByRound[roundIndex]?.get(rowIndex) ?? null) : null,
          qualifyingPoints: round.kw > 0 ? round.kw : null,
          tandemPosition: round.fin > 0 ? (tandemRankByRound[roundIndex]?.get(rowIndex) ?? null) : null,
          points: round.total,
        } satisfies DmStageResult;
      })
      .filter((stage): stage is DmStageResult => stage != null);

    const { firstName, lastName } = parseDriverName(driver.name);
    return {
      slug: driverSlugFromName(driver.name),
      firstName,
      lastName,
      nameAlias: driver.rawName,
      country: driver.country,
      number: driver.number,
      photoSourceUrl: null,
      team: null,
      totalPoints: driver.totalPoints,
      stages,
    };
  });
}

function eventsForArchiveSeason(seasonYear: number, roundCount: number): DmEvent[] {
  const tracks = DM_ARCHIVE_STANDINGS_EVENT_TRACKS[seasonYear];
  if (tracks && tracks.length > 0) {
    return tracks.slice(0, roundCount).map((track) => ({
      slug: eventSlug(track.roundNumber),
      roundNumber: track.roundNumber,
      name: `Round ${track.roundNumber}`,
      trackName: track.trackName,
      startsAt: new Date(Date.UTC(seasonYear, track.month, track.day, 12, 0, 0)).toISOString(),
      status: 'FINISHED' as const,
    }));
  }

  return Array.from({ length: roundCount }, (_, index) => {
    const roundNumber = index + 1;
    return {
      slug: eventSlug(roundNumber),
      roundNumber,
      name: `Round ${roundNumber}`,
      trackName: `Round ${roundNumber}`,
      startsAt: new Date(Date.UTC(seasonYear, index, 1, 12, 0, 0)).toISOString(),
      status: 'FINISHED' as const,
    };
  });
}

function buildSeasonFromLegacyClassification(
  html: string,
  sourceUrl: string,
  seasonYear: number,
  meta: DmLegacySeasonMeta,
): DmSeasonData {
  const $ = cheerio.load(html);
  const driverRows: LegacyDriverRow[] = [];
  const rowSelector =
    meta.tableSelector === 'klasyfikacja' ? 'table.klasyfikacja tr' : 'table.table tr';

  $(rowSelector).each((_, row) => {
    const cells = $(row)
      .find('td')
      .toArray()
      .map((cell) => $(cell).text().replace(/\s+/g, ' ').trim());
    if (!/^\d+$/.test(cells[0] ?? '')) return;
    const parsed = parseLegacyDriverRowsFromCells(cells, meta);
    if (parsed) driverRows.push(parsed);
  });

  const pilots = pilotsFromLegacyDriverRows(driverRows, meta.roundCount);

  const events: DmEvent[] = meta.eventTracks.map((track) => ({
    slug: eventSlug(track.roundNumber),
    roundNumber: track.roundNumber,
    name: `Round ${track.roundNumber}`,
    trackName: track.trackName,
    startsAt: new Date(Date.UTC(seasonYear, track.month, track.day, 12, 0, 0)).toISOString(),
    status: 'FINISHED' as const,
  }));

  return {
    sourceUrl,
    seasonYear,
    seasonId: `archive-${seasonYear}`,
    events,
    pilots,
  };
}

function eventSlug(roundNumber: number): string {
  return `dm-r${roundNumber}`;
}

function driverSlugFromName(rawName: string): string {
  return rawName
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseDriverName(rawName: string): {
  firstName: string;
  lastName: string;
  number: number | null;
} {
  const numberMatch = rawName.match(/\((\d+)\)/);
  const number = numberMatch ? Number.parseInt(numberMatch[1]!, 10) : null;
  const cleaned = rawName
    .replace(/\([^)]*\)/g, '')
    .replace(/\s*\(C\)\s*$/i, '')
    .trim();

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    const only = titleCase(parts[0]!);
    return { firstName: only, lastName: only, number };
  }

  return {
    firstName: titleCase(parts[0]!),
    lastName: titleCase(parts.slice(1).join(' ')),
    number,
  };
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/([\s-'])/)
    .map((part) => (/^[a-z]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('');
}

function parseIntCell(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '—' || trimmed === '–' || trimmed === '-') return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSubheaderRow(cells: string[]): boolean {
  const joined = cells.join(' ').toUpperCase();
  if (/^(A Q B|A Q F|Q F)/.test(joined)) return true;
  if (cells.every((cell) => /^[AQFB]$/i.test(cell.trim()))) return true;
  return false;
}

function roundNumbersFromHeader(header: string[]): number[] {
  const rounds: number[] = [];
  for (const cell of header) {
    const match = cell.match(/^(?:R|RND\s*|ROUND\s*)(\d+)$/i);
    if (match) rounds.push(Number.parseInt(match[1]!, 10));
  }
  return rounds;
}

function parseSimpleRoundRow(cells: string[], roundCount: number): number[] {
  const start = 3;
  const values: number[] = [];
  for (let i = 0; i < roundCount; i++) {
    values.push(parseIntCell(cells[start + i] ?? '') ?? 0);
  }
  return values;
}

function parseTripleRoundRow(cells: string[], roundCount: number): number[] {
  const start = 3;
  const values: number[] = [];
  for (let i = 0; i < roundCount; i++) {
    const base = start + i * 3;
    const a = parseIntCell(cells[base] ?? '') ?? 0;
    const q = parseIntCell(cells[base + 1] ?? '') ?? 0;
    const b = parseIntCell(cells[base + 2] ?? '') ?? 0;
    values.push(a + q + b);
  }
  return values;
}

function parsePairRoundRow(cells: string[], roundCount: number): number[] {
  const start = 2;
  const values: number[] = [];
  for (let i = 0; i < roundCount; i++) {
    const base = start + i * 2;
    const q = parseIntCell(cells[base] ?? '') ?? 0;
    const f = parseIntCell(cells[base + 1] ?? '') ?? 0;
    values.push(q + f);
  }
  return values;
}

interface ParsedTable {
  title: string;
  header: string[];
  rows: string[][];
}

function tableTitleForYear(seasonYear: number): RegExp {
  if (seasonYear === 2017) return /^DMGP\s+2017$/i;
  if (seasonYear === 2018) return /^DMEC\s+2018$/i;
  return new RegExp(`DMEC\\s+Driver\\s+Standings\\s+${seasonYear}`, 'i');
}

function extractTables(html: string): ParsedTable[] {
  const $ = cheerio.load(html);
  const tables: ParsedTable[] = [];

  $('h2.tabtitle').each((_, heading) => {
    const title = $(heading).text().replace(/\s+/g, ' ').trim();
    const table = $(heading).next('div').find('table').first();
    if (!table.length) return;

    const rows: string[][] = [];
    table.find('tr').each((__, row) => {
      const cells = $(row)
        .find('th, td')
        .toArray()
        .map((cell) => $(cell).text().replace(/\s+/g, ' ').trim());
      if (cells.length > 0) rows.push(cells);
    });

    if (rows.length > 0) {
      tables.push({ title, header: rows[0]!, rows: rows.slice(1) });
    }
  });

  return tables;
}

function buildSeasonFromTable(
  seasonYear: number,
  sourceUrl: string,
  table: ParsedTable,
): DmSeasonData {
  const dataRows = table.rows.filter((row) => !isSubheaderRow(row));
  const roundNumbers = roundNumbersFromHeader(table.header);
  const roundCount = roundNumbers.length;
  const isDmgp2017 = seasonYear === 2017;
  const sampleRow = dataRows.find((row) => (parseIntCell(row[0] ?? '') ?? 0) > 0);
  const isTripleFormat =
    !isDmgp2017 &&
    roundCount > 0 &&
    !!sampleRow &&
    sampleRow.length >= 3 + roundCount * 3 + 1;

  let pilots: DmPilot[] = [];

  if (isDmgp2017 || isTripleFormat) {
    const driverRows: LegacyDriverRow[] = [];
    const dataStartCol = isDmgp2017 ? 2 : 3;
    const minCells = isDmgp2017 ? 2 + roundCount * 2 + 1 : 3 + roundCount * 3 + 1;

    for (const row of dataRows) {
      if (row.length < minCells) continue;
      const place = parseIntCell(row[0] ?? '');
      if (place === null || place <= 0) continue;

      const rawName = row[1] ?? '';
      const parsed = parseDriverName(rawName);
      const name = fixLegacyDriverName(`${parsed.firstName} ${parsed.lastName}`);
      const country = isTripleFormat ? normalizeCountryCode(row[2] ?? '') : null;
      const rounds = isDmgp2017
        ? parsePairRoundDetails(row, roundCount, dataStartCol)
        : parseTripleRoundDetails(row, roundCount, dataStartCol);
      const totalFromRow = parseIntCell(row[row.length - 1] ?? '');
      const totalPoints =
        totalFromRow ?? rounds.reduce((sum, round) => sum + round.total, 0);
      if (totalPoints <= 0) continue;

      driverRows.push({
        name,
        rawName,
        number: parsed.number,
        country,
        rounds,
        totalPoints,
      });
    }
    pilots = pilotsFromLegacyDriverRows(driverRows, roundCount);
  } else {
    for (const row of dataRows) {
      if (row.length < 3) continue;

      const place = parseIntCell(row[0] ?? '');
      if (place === null || place <= 0) continue;

      const rawName = row[1]!;
      const { firstName, lastName, number } = parseDriverName(rawName);
      const countryRaw = row[2]!;
      const country = normalizeCountryCode(countryRaw);

      let roundPoints: number[];
      if (isTripleFormat) {
        roundPoints = parseTripleRoundRow(row, roundCount);
      } else {
        roundPoints = parseSimpleRoundRow(row, roundCount);
      }

      const totalFromRow = parseIntCell(row[row.length - 1] ?? '');
      const totalPoints = totalFromRow ?? roundPoints.reduce((sum, value) => sum + value, 0);
      if (totalPoints <= 0) continue;

      const driverSlug = driverSlugFromName(rawName);
      const stages: DmStageResult[] = roundPoints
        .map((points, index) => ({
          roundNumber: roundNumbers[index] ?? index + 1,
          points,
        }))
        .filter((stage) => stage.points > 0)
        .map((stage) => ({
          eventSlug: eventSlug(stage.roundNumber),
          roundNumber: stage.roundNumber,
          qualifyingPosition: null,
          qualifyingPoints: null,
          tandemPosition: null,
          points: stage.points,
        }));

      pilots.push({
        slug: driverSlug,
        firstName,
        lastName,
        nameAlias: rawName,
        country,
        number,
        photoSourceUrl: null,
        team: null,
        totalPoints,
        stages,
      });
    }
  }

  const maxRound =
    roundNumbers.length > 0
      ? Math.max(...roundNumbers)
      : pilots.reduce((max, pilot) => Math.max(max, pilot.stages.length), 0);

  const events = eventsForArchiveSeason(seasonYear, maxRound);

  return {
    sourceUrl,
    seasonYear,
    seasonId: `archive-${seasonYear}`,
    events,
    pilots,
  };
}

export async function fetchDriftMastersArchiveSeason(seasonYear: number): Promise<DmSeasonData> {
  const snapshot = DM_ARCHIVE_SNAPSHOTS[seasonYear];
  if (!snapshot) {
    throw new Error(
      `No archived Drift Masters snapshot for ${seasonYear}. Available: ${DM_ARCHIVE_SEASONS.join(', ')}`,
    );
  }

  const legacyMeta = DM_LEGACY_SEASON_META[seasonYear];
  if (legacyMeta) {
    const sourceUrl = archiveLegacyClassificationUrl(snapshot, legacyMeta.path);
    const response = await fetch(sourceUrl, {
      headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch archived classification ${sourceUrl}: ${response.status}`);
    }
    const html = await response.text();
    return buildSeasonFromLegacyClassification(html, sourceUrl, seasonYear, legacyMeta);
  }

  const sourceUrl = archiveStandingsUrl(snapshot);
  const response = await fetch(sourceUrl, {
    headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch archived standings ${sourceUrl}: ${response.status}`);
  }

  const html = await response.text();
  const tables = extractTables(html);
  const titlePattern = tableTitleForYear(seasonYear);
  const table = tables.find((item) => titlePattern.test(item.title));
  if (!table) {
    throw new Error(
      `Standings table not found for Drift Masters ${seasonYear} in archive (found: ${tables.map((t) => t.title).join(', ')})`,
    );
  }

  return buildSeasonFromTable(seasonYear, sourceUrl, table);
}
