import * as cheerio from 'cheerio';
import { D1GP_2026_DRIVERS } from '../data/d1gp-2026-drivers.js';

const SITE = 'https://d1gp.co.jp';
const RANKING_URL =
  SITE +
  '/2026d1%e3%82%b0%e3%83%a9%e3%83%b3%e3%83%97%e3%83%aa%e3%82%b7%e3%83%aa%e3%83%bc%e3%82%ba%e3%83%a9%e3%83%b3%e3%82%ad%e3%83%b3%e3%82%b0/';
const DRIVERS_INTRO_URL =
  SITE +
  '/2026-d1%e3%82%b0%e3%83%a9%e3%83%b3%e3%83%97%e3%83%aa%e3%83%89%e3%83%a9%e3%82%a4%e3%83%90%e3%83%bc%e7%b4%b9%e4%bb%8b/';

/** e.g. DM2026_003-KeiichiNomura-D.jpg or …-683x1024.jpg */
const DRIVER_PHOTO_RE =
  /DM2026_(\d+)-([A-Za-z]+(?:-[A-Za-z]+)?)-D(?:-683x1024)?\.jpg/gi;

const ROUND_REPORT_URLS: Record<number, string> = {
  1: SITE + '/25117/',
  2: SITE + '/25129/',
  3: SITE + '/25728/',
  4: SITE + '/25738/',
};

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

const D1GP_2026_EVENTS: D1Event[] = [
  {
    slug: 'd1-r1',
    roundNumber: 1,
    name: 'Round 1 — Aichi Sky Expo',
    trackName: 'Aichi Sky Expo',
    startsAt: '2026-05-09T09:00:00.000Z',
    status: 'FINISHED',
  },
  {
    slug: 'd1-r2',
    roundNumber: 2,
    name: 'Round 2 — Aichi Sky Expo',
    trackName: 'Aichi Sky Expo',
    startsAt: '2026-05-10T09:00:00.000Z',
    status: 'FINISHED',
  },
  {
    slug: 'd1-r3',
    roundNumber: 3,
    name: 'Round 3 — Tsukuba Circuit',
    trackName: 'Tsukuba Circuit',
    startsAt: '2026-06-27T09:00:00.000Z',
    status: 'FINISHED',
  },
  {
    slug: 'd1-r4',
    roundNumber: 4,
    name: 'Round 4 — Tsukuba Circuit',
    trackName: 'Tsukuba Circuit',
    startsAt: '2026-06-28T09:00:00.000Z',
    status: 'FINISHED',
  },
  {
    slug: 'd1-r5',
    roundNumber: 5,
    name: 'Round 5 — Ebisu Circuit',
    trackName: 'Ebisu Circuit',
    startsAt: '2026-09-26T09:00:00.000Z',
    status: 'SCHEDULED',
  },
  {
    slug: 'd1-r6',
    roundNumber: 6,
    name: 'Round 6 — Ebisu Circuit',
    trackName: 'Ebisu Circuit',
    startsAt: '2026-09-27T09:00:00.000Z',
    status: 'SCHEDULED',
  },
  {
    slug: 'd1-r7',
    roundNumber: 7,
    name: 'Round 7 — Autopolis',
    trackName: 'Autopolis',
    startsAt: '2026-10-24T09:00:00.000Z',
    status: 'SCHEDULED',
  },
  {
    slug: 'd1-r8',
    roundNumber: 8,
    name: 'Round 8 — Autopolis',
    trackName: 'Autopolis',
    startsAt: '2026-10-25T09:00:00.000Z',
    status: 'SCHEDULED',
  },
  {
    slug: 'd1-r9',
    roundNumber: 9,
    name: 'Round 9 — Odaiba',
    trackName: 'Odaiba, Tokyo Bay',
    startsAt: '2026-11-14T09:00:00.000Z',
    status: 'SCHEDULED',
  },
  {
    slug: 'd1-r10',
    roundNumber: 10,
    name: 'Round 10 — Odaiba',
    trackName: 'Odaiba, Tokyo Bay',
    startsAt: '2026-11-15T09:00:00.000Z',
    status: 'SCHEDULED',
  },
];

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
  return `d1-${base || number}`;
}

function eventSlug(roundNumber: number): string {
  return `d1-r${roundNumber}`;
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
      if (cells.length <= Math.max(positionIndex, numberIndex, bestIndex)) return;
      const position = parseInteger(cells[positionIndex]!);
      const number = parseInteger(cells[numberIndex]!);
      const bestScore = parseFloatScore(cells[bestIndex]!);
      if (position == null || number == null || bestScore == null) return;
      qualByNumber.set(number, { position, bestScore });
    });
  }

  const tandemTable =
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
      if (cells.length <= Math.max(positionIndex, numberIndex)) return;
      const position = parseInteger(cells[positionIndex]!);
      const number = parseInteger(cells[numberIndex]!);
      if (position == null || number == null) return;
      tandemByNumber.set(number, { position });
    });
  }

  return { qualByNumber, tandemByNumber };
}

interface RankingRow {
  number: number;
  nameJa: string;
  team: string;
  roundPoints: Map<number, number>;
  totalPoints: number;
}

function parseTsuisoRanking(html: string): RankingRow[] {
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

    rows.push({
      number,
      nameJa: cells[2]!,
      team: cells[3]!,
      roundPoints,
      totalPoints,
    });
  });

  return rows;
}

function parseDriverPhotos(html: string): Map<number, string> {
  const byNumber = new Map<number, string>();

  for (const match of html.matchAll(DRIVER_PHOTO_RE)) {
    const number = Number.parseInt(match[1]!, 10);
    const nameSlug = match[2]!;
    const url = `${SITE}/wp-content/uploads/2026/05/DM2026_${match[1]!.padStart(3, '0')}-${nameSlug}-D.jpg`;
    byNumber.set(number, url);
  }

  return byNumber;
}

function resolveDriver(number: number, nameJa: string) {
  const known = D1GP_2026_DRIVERS[number];
  if (known) return known;

  const parts = nameJa.trim().split(/\s+/);
  const lastName = parts[0] ?? nameJa;
  const firstName = parts.slice(1).join(' ') || lastName;
  return {
    firstName,
    lastName,
    nameJa,
    country: 'JP' as const,
  };
}

export async function fetchD1gpSeason(seasonYear: number): Promise<D1SeasonData> {
  if (seasonYear !== 2026) {
    throw new Error(`D1GP importer currently supports 2026 only (requested ${seasonYear})`);
  }

  const [rankingHtml, driversIntroHtml, ...reportHtmls] = await Promise.all([
    fetchHtml(RANKING_URL),
    fetchHtml(DRIVERS_INTRO_URL),
    ...Object.values(ROUND_REPORT_URLS).map((url) => fetchHtml(url)),
  ]);

  const rankingRows = parseTsuisoRanking(rankingHtml);
  const photosByNumber = parseDriverPhotos(driversIntroHtml);
  const reportsByRound = new Map<number, RoundReportData>();
  for (const [roundNumber, html] of Object.entries(ROUND_REPORT_URLS).map(([round, url], index) => [
    Number(round),
    reportHtmls[index]!,
  ] as const)) {
    reportsByRound.set(roundNumber, parseRoundReport(html));
  }

  const finishedRounds = [...reportsByRound.keys()].sort((a, b) => a - b);
  const pilots: D1Pilot[] = rankingRows
    .filter((row) => row.totalPoints > 0 || [...row.roundPoints.values()].some((points) => points > 0))
    .map((row) => {
      const driver = resolveDriver(row.number, row.nameJa);
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
    sourceUrl: RANKING_URL,
    seasonYear,
    events: D1GP_2026_EVENTS,
    pilots,
  };
}
