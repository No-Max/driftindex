import * as cheerio from 'cheerio';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transliterate } from '../lib/transliterate.js';
import {
  applyFdTandemPodiumFromPoints,
  type FdEvent,
  type FdPilot,
  type FdSeasonData,
  type FdStageResult,
} from './formula-drift.js';
import {
  fdDriverIdFromSlug,
  namesFromWaybackDriverSlug,
  parseWaybackPointsCell,
} from './formula-drift-wayback.js';

const WAYBACK_UA = 'DriftIndexBot/1.0 (https://driftindex.pro; Formula Drift archive import)';

export const FD_LEGACY_STANDINGS_YEARS = [2004, 2005, 2006] as const;

const WAYBACK_SNAPSHOTS = ['20071009081058', '20060801000000', '20051201000000'] as const;

const importerDir = dirname(fileURLToPath(import.meta.url));

function legacyStandingsFixturePath(seasonYear: number): string {
  return join(importerDir, 'fixtures', `formula-drift-${seasonYear}-standings.wayback.html`);
}

/** 2006 is on Wayback; 2004/2005 only when a committed HTML fixture exists (IA never captured those URLs). */
export function isLegacyStandingsSeasonImportable(seasonYear: number): boolean {
  if (!(FD_LEGACY_STANDINGS_YEARS as readonly number[]).includes(seasonYear)) return false;
  if (seasonYear === 2006) return true;
  return existsSync(legacyStandingsFixturePath(seasonYear));
}

interface LegacyRoundMeta {
  roundNumber: number;
  name: string;
  trackName: string;
  startsAt: string;
}

/** Official PRO calendar (formulad.com legacy era). */
const LEGACY_ROUNDS: Record<(typeof FD_LEGACY_STANDINGS_YEARS)[number], LegacyRoundMeta[]> = {
  2004: [
    {
      roundNumber: 1,
      name: 'Road Atlanta',
      trackName: 'Road Atlanta',
      startsAt: '2004-04-25T12:00:00.000Z',
    },
    {
      roundNumber: 2,
      name: 'Reliant Center',
      trackName: 'Reliant Center',
      startsAt: '2004-06-12T12:00:00.000Z',
    },
    {
      roundNumber: 3,
      name: 'Infineon Raceway',
      trackName: 'Infineon Raceway',
      startsAt: '2004-07-11T12:00:00.000Z',
    },
    {
      roundNumber: 4,
      name: 'Irwindale Speedway',
      trackName: 'Irwindale Speedway',
      startsAt: '2004-08-29T12:00:00.000Z',
    },
  ],
  2005: [
    {
      roundNumber: 1,
      name: 'Wall Speedway',
      trackName: 'Wall Speedway',
      startsAt: '2005-04-16T12:00:00.000Z',
    },
    {
      roundNumber: 2,
      name: 'Road Atlanta',
      trackName: 'Road Atlanta',
      startsAt: '2005-05-07T12:00:00.000Z',
    },
    {
      roundNumber: 3,
      name: 'Reliant Center',
      trackName: 'Reliant Center',
      startsAt: '2005-06-11T12:00:00.000Z',
    },
    {
      roundNumber: 4,
      name: 'Infineon Raceway',
      trackName: 'Infineon Raceway',
      startsAt: '2005-07-09T12:00:00.000Z',
    },
    {
      roundNumber: 5,
      name: 'Soldier Field',
      trackName: 'Soldier Field',
      startsAt: '2005-08-06T12:00:00.000Z',
    },
    {
      roundNumber: 6,
      name: 'Irwindale Speedway',
      trackName: 'Irwindale Speedway',
      startsAt: '2005-08-27T12:00:00.000Z',
    },
  ],
  2006: [
    {
      roundNumber: 1,
      name: 'Streets of Long Beach',
      trackName: 'Streets of Long Beach',
      startsAt: '2006-04-02T12:00:00.000Z',
    },
    {
      roundNumber: 2,
      name: 'Road Atlanta',
      trackName: 'Road Atlanta',
      startsAt: '2006-05-13T12:00:00.000Z',
    },
    {
      roundNumber: 3,
      name: 'Soldier Field',
      trackName: 'Soldier Field',
      startsAt: '2006-06-10T12:00:00.000Z',
    },
    {
      roundNumber: 4,
      name: 'Infineon Raceway',
      trackName: 'Infineon Raceway',
      startsAt: '2006-07-08T12:00:00.000Z',
    },
    {
      roundNumber: 5,
      name: 'Evergreen Speedway',
      trackName: 'Evergreen Speedway',
      startsAt: '2006-08-19T12:00:00.000Z',
    },
    {
      roundNumber: 6,
      name: 'Wall Speedway',
      trackName: 'Wall Speedway',
      startsAt: '2006-09-09T12:00:00.000Z',
    },
    {
      roundNumber: 7,
      name: 'Irwindale Speedway',
      trackName: 'Irwindale Speedway',
      startsAt: '2006-10-14T12:00:00.000Z',
    },
  ],
};

function legacyStandingsUrl(seasonYear: number, snapshot: string): string {
  return `https://web.archive.org/web/${snapshot}/http://www.formulad.com/standings.php?id=${seasonYear}`;
}

function slugFromDriverDisplayName(name: string): string {
  return transliterate(name)
    .replace(/[,.]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-?(jr|sr)$/i, (_, suffix: string) => `-${suffix.toLowerCase()}`);
}

function buildEvents(seasonYear: number): FdEvent[] {
  const rounds = LEGACY_ROUNDS[seasonYear as (typeof FD_LEGACY_STANDINGS_YEARS)[number]];
  if (!rounds) {
    throw new Error(`No legacy round metadata for Formula Drift ${seasonYear}`);
  }
  return rounds.map((round) => ({
    fdEventId: round.roundNumber,
    slug: `fd-${round.trackName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    roundNumber: round.roundNumber,
    name: round.name,
    trackName: round.trackName,
    startsAt: round.startsAt,
    status: 'FINISHED' as const,
    country: 'United States',
  }));
}

function countLegacyRoundColumns($: cheerio.CheerioAPI): number {
  let count = 0;
  $('table#championship tr')
    .eq(1)
    .find('th.round')
    .each((_, cell) => {
      const label = $(cell).text().replace(/\s+/g, ' ').trim();
      if (/^\d+$/.test(label) || /^final$/i.test(label)) {
        count += 1;
      }
    });
  return count;
}

function looksLikeLegacyStandingsHtml(html: string, seasonYear: number): boolean {
  return html.includes(`${seasonYear} Standings`) && html.includes('id="championship"');
}

export function parseLegacyStandingsHtml(html: string, seasonYear: number): FdSeasonData {
  const events = buildEvents(seasonYear);
  const $ = cheerio.load(html);
  const roundColumns = countLegacyRoundColumns($);
  if (roundColumns > 0 && roundColumns !== events.length) {
    throw new Error(
      `Legacy ${seasonYear} standings has ${roundColumns} round columns, expected ${events.length}`,
    );
  }

  const pilots = new Map<string, FdPilot>();

  $('table#championship tr').each((_, row) => {
    const driverLink = $(row).find('a[href*="drivers.php"]').first();
    const driverName = driverLink.text().replace(/\s+/g, ' ').trim();
    if (!driverName) return;

    const cells = $(row)
      .find('td')
      .toArray()
      .map((cell) => $(cell).text().replace(/\s+/g, ' ').trim());
    if (cells.length < 3 + events.length) return;

    const carNumber = parseWaybackPointsCell(cells[1] ?? '');
    const roundCells = cells.slice(3, 3 + events.length);
    const stages: FdStageResult[] = [];

    for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
      const rawPoints = roundCells[eventIndex] ?? '';
      const points = parseWaybackPointsCell(rawPoints);
      if (points == null || points <= 0) continue;

      const event = events[eventIndex]!;
      stages.push({
        eventSlug: event.slug,
        roundNumber: event.roundNumber,
        qualifyingPosition: null,
        qualifyingPoints: null,
        qualScore100: null,
        tandemPosition: null,
        tandemFinishPoints: null,
        points: Math.round(points),
      });
    }

    if (stages.length === 0) return;

    const slug = slugFromDriverDisplayName(driverName);
    const names = namesFromWaybackDriverSlug(slug);
    pilots.set(slug, {
      slug,
      fdDriverId: fdDriverIdFromSlug(slug),
      firstName: names.firstName,
      lastName: names.lastName,
      nameAlias: driverName,
      country: null,
      number: carNumber != null ? Math.round(carNumber) : null,
      photoSourceUrl: null,
      team: null,
      stages,
    });
  });

  if (pilots.size === 0) {
    throw new Error(`Legacy Formula Drift ${seasonYear} standings table parsed empty`);
  }

  return {
    sourceUrl: legacyStandingsUrl(seasonYear, WAYBACK_SNAPSHOTS[0]),
    seasonYear,
    events,
    pilots: [...pilots.values()],
  };
}

async function loadLegacyStandingsHtml(seasonYear: number): Promise<{ html: string; sourceUrl: string }> {
  for (const snapshot of WAYBACK_SNAPSHOTS) {
    const sourceUrl = legacyStandingsUrl(seasonYear, snapshot);
    try {
      const response = await fetch(sourceUrl, {
        headers: { accept: 'text/html', 'user-agent': WAYBACK_UA },
      });
      if (!response.ok) continue;
      const html = await response.text();
      if (looksLikeLegacyStandingsHtml(html, seasonYear)) {
        return { html, sourceUrl };
      }
    } catch {
      // try next snapshot / fixture
    }
  }

  const fixturePath = legacyStandingsFixturePath(seasonYear);
  const html = await readFile(fixturePath, 'utf8');
  if (!looksLikeLegacyStandingsHtml(html, seasonYear)) {
    throw new Error(`Fixture for Formula Drift ${seasonYear} does not look like legacy standings HTML`);
  }
  return { html, sourceUrl: `file://${fixturePath}` };
}

export async function fetchFormulaDriftSeasonFromLegacyStandings(seasonYear: number): Promise<FdSeasonData> {
  if (!(FD_LEGACY_STANDINGS_YEARS as readonly number[]).includes(seasonYear)) {
    throw new Error(`Legacy Formula Drift standings importer only covers 2004–2006, not ${seasonYear}`);
  }

  const { html, sourceUrl } = await loadLegacyStandingsHtml(seasonYear);
  const season = parseLegacyStandingsHtml(html, seasonYear);
  season.sourceUrl = sourceUrl;
  applyFdTandemPodiumFromPoints(season.pilots, season.events);
  return season;
}
