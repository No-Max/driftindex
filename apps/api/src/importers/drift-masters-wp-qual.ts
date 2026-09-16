import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DmQualResult } from './drift-masters.js';

const WAYBACK = 'https://web.archive.org/web';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Round 6 2018: no driftmasters.gp qual article in Wayback; see screens/DM/2018/round-6-qualifying-sources.md */
export const DMEC_2018_R6_QUAL_VIDEO = 'https://www.youtube.com/watch?v=cisiYh_q2bE';

interface LocalQualFile {
  roundNumber: number;
  sourceUrl?: string;
  rows: Array<{ rank: number; name: string; bib?: number | null; qualScore100: number }>;
}

/** Archived driftmasters.gp press-release qualifying tables (Pos / Name / bib / runs / Highest). */
const DM_WP_QUAL_ARTICLES: Partial<
  Record<number, Array<{ roundNumber: number; snapshot: string; path: string }>>
> = {
  2018: [
    {
      roundNumber: 1,
      snapshot: '20181125100253',
      path: '/2018/06/09/dmec-2018-round-1-qualifying-results/',
    },
    {
      roundNumber: 2,
      snapshot: '20181125100253',
      path: '/2018/06/22/dmec-2018-round-2-qualifying-results/',
    },
    {
      roundNumber: 3,
      snapshot: '20190514120013',
      path: '/2018/08/04/dmec-round-3-2018-qualifying-results/',
    },
    {
      roundNumber: 4,
      snapshot: '20181125100253',
      path: '/2018/08/17/dmec-round-4-2018-qualifying-results/',
    },
    {
      roundNumber: 5,
      snapshot: '20181125100253',
      path: '/2018/09/07/dmec-round-5-2018-qualifying-results/',
    },
  ],
};

function parseQualScoreCell(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) return null;
  return parsed;
}

function parseDriverName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    const only = parts[0]!;
    return { firstName: only, lastName: only };
  }
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(' '),
  };
}

function looksLikeRunScore(value: string): boolean {
  const normalized = value.replace(',', '.').trim();
  if (!/\d/.test(normalized)) return false;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) return false;
  return normalized.includes('.') || normalized.includes(',');
}

function looksLikeBib(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return false;
  const parsed = Number.parseInt(trimmed, 10);
  return parsed >= 1 && parsed <= 999;
}

/** drift.news tables: # | Drifter | Best run / Score */
export function parseDriftMastersDriftNewsQualTable(html: string, roundNumber: number): DmQualResult[] {
  const $ = cheerio.load(html);
  const results: DmQualResult[] = [];

  $('table').each((_, table) => {
    const headerCells = $(table)
      .find('tr')
      .first()
      .find('th, td')
      .toArray()
      .map((cell) => $(cell).text().replace(/\s+/g, ' ').trim().toLowerCase());
    const rankCol = headerCells.some((cell) => cell === '#' || cell === 'pos' || cell === 'position');
    const driverCol = headerCells.some((cell) => cell.includes('drifter') || cell === 'name');
    const scoreCol = headerCells.some(
      (cell) =>
        cell.includes('best run') ||
        cell.includes('best') ||
        cell === 'score' ||
        cell.includes('highest'),
    );
    if (!rankCol || !driverCol || !scoreCol) return;

    $(table)
      .find('tbody tr, tr')
      .slice(1)
      .each((__, row) => {
        const cells = $(row)
          .find('td')
          .toArray()
          .map((cell) => $(cell).text().replace(/\s+/g, ' ').trim());
        if (cells.length < 3) return;

        const rank = Number.parseInt(cells[0] ?? '', 10);
        if (!Number.isFinite(rank) || rank <= 0) return;

        const name = cells[1] ?? '';
        if (!name || /average score/i.test(name)) return;

        const qualScore100 = parseQualScoreCell(cells[2] ?? '');
        if (qualScore100 == null) return;

        const { firstName, lastName } = parseDriverName(name);
        results.push({
          roundNumber,
          rank,
          qualScore100,
          firstName,
          lastName,
          fullName: name,
          nationality: null,
          bib: null,
        });
      });
  });

  return results;
}

const DM_DRIFT_NEWS_QUAL_ARTICLES: Partial<Record<number, Array<{ roundNumber: number; url: string }>>> =
  {
    2023: [
      {
        roundNumber: 3,
        url: 'https://drift.news/dmec2023r3q/',
      },
      {
        roundNumber: 5,
        url: 'https://drift.news/dmec2023r5q/',
      },
    ],
  };

export async function fetchDriftMastersDriftNewsQualByRound(
  seasonYear: number,
  roundCount = 7,
): Promise<Map<number, DmQualResult[]>> {
  const articles = DM_DRIFT_NEWS_QUAL_ARTICLES[seasonYear];
  const byRound = new Map<number, DmQualResult[]>();
  if (!articles?.length) return byRound;

  for (const article of articles) {
    if (article.roundNumber > roundCount) continue;
    try {
      const response = await fetch(article.url, {
        headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
      });
      if (!response.ok) {
        console.warn(`drift.news qual fetch failed ${article.url}: ${response.status}`);
        continue;
      }
      const html = await response.text();
      const rows = parseDriftMastersDriftNewsQualTable(html, article.roundNumber);
      if (rows.length > 0) byRound.set(article.roundNumber, rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`drift.news qual error round ${article.roundNumber}: ${message}`);
    }
  }

  return byRound;
}

/** Table rows: Pos, Name, [bib], Run1, Run2, Highest (header omits bib column). */
export function parseDriftMastersWpQualTable(html: string, roundNumber: number): DmQualResult[] {
  const $ = cheerio.load(html);
  const results: DmQualResult[] = [];

  const root = $('article.content').length > 0 ? $('article.content') : $('article');
  root.find('table').each((_, table) => {
    const headerCells = $(table)
      .find('tr')
      .first()
      .find('th, td')
      .toArray()
      .map((cell) => $(cell).text().replace(/\s+/g, ' ').trim().toLowerCase());
    const hasQualHeader =
      headerCells.some((cell) => cell === 'pos' || cell === 'position') &&
      headerCells.some((cell) => cell.includes('highest') || cell.includes('best'));
    if (!hasQualHeader) return;

    $(table)
      .find('tbody tr, tr')
      .slice(1)
      .each((__, row) => {
        const cells = $(row)
          .find('td')
          .toArray()
          .map((cell) => $(cell).text().replace(/\s+/g, ' ').trim());
        if (cells.length < 4) return;

        const rank = Number.parseInt(cells[0] ?? '', 10);
        if (!Number.isFinite(rank) || rank <= 0) return;

        const name = cells[1] ?? '';
        if (!name) return;

        let bib: number | null = null;
        let highestRaw: string;

        if (
          cells.length >= 6 &&
          looksLikeBib(cells[2] ?? '') &&
          looksLikeRunScore(cells[3] ?? '')
        ) {
          bib = Number.parseInt(cells[2]!, 10);
          highestRaw = cells[cells.length - 1] ?? '';
        } else {
          highestRaw = cells[cells.length - 1] ?? '';
        }

        const qualScore100 = parseQualScoreCell(highestRaw);
        if (qualScore100 == null) return;

        const { firstName, lastName } = parseDriverName(name);
        results.push({
          roundNumber,
          rank,
          qualScore100,
          firstName,
          lastName,
          fullName: name,
          nationality: null,
          bib,
        });
      });
  });

  return results;
}

function archiveArticleUrl(snapshot: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const withSlash = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
  return `${WAYBACK}/${snapshot}/https://www.driftmasters.gp${withSlash}`;
}

export async function fetchDriftMastersArchiveQualByRound(
  seasonYear: number,
  roundCount = 7,
): Promise<Map<number, DmQualResult[]>> {
  const articles = DM_WP_QUAL_ARTICLES[seasonYear];
  const byRound = new Map<number, DmQualResult[]>();
  if (!articles?.length) return byRound;

  for (const article of articles) {
    if (article.roundNumber > roundCount) continue;

    const sourceUrl = archiveArticleUrl(article.snapshot, article.path);
    try {
      const response = await fetch(sourceUrl, {
        headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
      });
      if (!response.ok) {
        console.warn(`WP qual fetch failed ${sourceUrl}: ${response.status}`);
        continue;
      }
      const html = await response.text();
      const rows = parseDriftMastersWpQualTable(html, article.roundNumber);
      if (rows.length > 0) {
        byRound.set(article.roundNumber, rows);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`WP qual fetch error round ${article.roundNumber}: ${message}`);
    }
  }

  return byRound;
}

function localQualRowToDm(row: LocalQualFile['rows'][number], roundNumber: number): DmQualResult {
  const { firstName, lastName } = parseDriverName(row.name);
  return {
    roundNumber,
    rank: row.rank,
    qualScore100: row.qualScore100,
    firstName,
    lastName,
    fullName: row.name,
    nationality: null,
    bib: row.bib ?? null,
  };
}

/** Manual / OCR qual tables under screens/DM/{year}/round-{n}-qualifying.json */
export async function fetchDriftMastersLocalQualByRound(
  seasonYear: number,
): Promise<Map<number, DmQualResult[]>> {
  const dir = path.join(REPO_ROOT, 'screens', 'DM', String(seasonYear));
  const byRound = new Map<number, DmQualResult[]>();

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return byRound;
  }

  for (const file of entries) {
    if (!/^round-\d+-qualifying\.json$/.test(file)) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')) as LocalQualFile;
      if (!parsed.rows?.length || parsed.roundNumber <= 0) continue;
      byRound.set(
        parsed.roundNumber,
        parsed.rows.map((row) => localQualRowToDm(row, parsed.roundNumber)),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Local qual JSON skipped ${file}: ${message}`);
    }
  }

  return byRound;
}
