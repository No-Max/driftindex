import * as cheerio from 'cheerio';
import type { DmEvent, DmPilot, DmSeasonData, DmStageResult } from './drift-masters.js';
import { normalizeCountryCode } from '../lib/countryCode.js';

const WAYBACK = 'https://web.archive.org/web';

/** Best archived driftmasters.gp/standings/ snapshot per season year. */
export const DM_ARCHIVE_SNAPSHOTS: Record<number, string> = {
  2017: '20181217014814',
  2018: '20181217014814',
  2019: '20191122200048',
  2021: '20220104225713',
  2022: '20221203083725',
};

export const DM_ARCHIVE_SEASONS = Object.keys(DM_ARCHIVE_SNAPSHOTS)
  .map(Number)
  .sort((a, b) => a - b);

function archiveStandingsUrl(snapshot: string): string {
  return `${WAYBACK}/${snapshot}/https://driftmasters.gp/standings/`;
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

  const pilots: DmPilot[] = [];

  for (const row of dataRows) {
    if (row.length < 3) continue;

    const place = parseIntCell(row[0] ?? '');
    if (place === null || place <= 0) continue;

    const rawName = isDmgp2017 ? row[1]! : row[1]!;
    const { firstName, lastName, number } = parseDriverName(rawName);
    const countryRaw = isDmgp2017 ? null : row[2]!;
    const country = normalizeCountryCode(countryRaw);

    let roundPoints: number[];
    if (isDmgp2017) {
      roundPoints = parsePairRoundRow(row, roundCount);
    } else if (isTripleFormat) {
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
      slug: `dm-${driverSlug}`,
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

  const maxRound =
    roundNumbers.length > 0
      ? Math.max(...roundNumbers)
      : pilots.reduce((max, pilot) => Math.max(max, pilot.stages.length), 0);

  const events: DmEvent[] = Array.from({ length: maxRound }, (_, index) => {
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
