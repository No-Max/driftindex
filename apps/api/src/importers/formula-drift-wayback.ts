import * as cheerio from 'cheerio';
import type { FdEvent, FdPilot, FdSeasonData, FdStageResult } from './formula-drift.js';

const WAYBACK_UA = 'DriftIndexBot/1.0 (https://driftindex.pro; Formula Drift archive import)';

export const FD_2007_WAYBACK_URL =
  'https://web.archive.org/web/20080826234412/http://www.formulad.com/standings/2007.php';

interface WaybackRoundMeta {
  roundNumber: number;
  name: string;
  trackName: string;
  startsAt: string;
  winnerSlug: string;
}

const FD_2007_ROUNDS: WaybackRoundMeta[] = [
  {
    roundNumber: 1,
    name: 'Streets of Long Beach',
    trackName: 'Streets of Long Beach',
    startsAt: '2007-04-07T12:00:00.000Z',
    winnerSlug: 'mitsuru-haruguchi',
  },
  {
    roundNumber: 2,
    name: 'Road Atlanta',
    trackName: 'Road Atlanta',
    startsAt: '2007-05-12T12:00:00.000Z',
    winnerSlug: 'chris-forsberg',
  },
  {
    roundNumber: 3,
    name: 'Summit Point Raceway',
    trackName: 'Summit Point Raceway',
    startsAt: '2007-06-02T12:00:00.000Z',
    winnerSlug: 'samuel-hubinette',
  },
  {
    roundNumber: 4,
    name: 'Evergreen Speedway',
    trackName: 'Evergreen Speedway',
    startsAt: '2007-07-14T12:00:00.000Z',
    winnerSlug: 'daijiro-yoshihara',
  },
  {
    roundNumber: 5,
    name: 'Infineon Raceway',
    trackName: 'Infineon Raceway',
    startsAt: '2007-08-11T12:00:00.000Z',
    winnerSlug: 'chris-forsberg',
  },
  {
    roundNumber: 6,
    name: 'Wall Speedway',
    trackName: 'Wall Speedway',
    startsAt: '2007-09-08T12:00:00.000Z',
    winnerSlug: 'daijiro-yoshihara',
  },
  {
    roundNumber: 7,
    name: 'Irwindale Speedway',
    trackName: 'Irwindale Speedway',
    startsAt: '2007-10-13T12:00:00.000Z',
    winnerSlug: 'tanner-foust',
  },
];

function cleanCell(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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

export function namesFromWaybackDriverSlug(slug: string): { firstName: string; lastName: string; nameAlias: string } {
  const junior = /(?:^|-)jr$/.test(slug);
  const parts = slug.replace(/-(jr|sr)$/g, '').split('-').filter(Boolean);
  const firstName = titleCase(parts[0] ?? slug);
  const lastName = titleCase(parts.slice(1).join(' ') || parts[0] || slug) + (junior ? ' Jr' : '');
  return {
    firstName,
    lastName,
    nameAlias: `${firstName} ${lastName}`.trim(),
  };
}

function fdDriverIdFromSlug(driverSlug: string): number {
  let hash = 0;
  for (const char of driverSlug) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) || 1;
}

export function parseWaybackPointsCell(raw: string): number | null {
  const trimmed = cleanCell(raw);
  if (!trimmed || trimmed === '—' || trimmed === '–' || trimmed === '-' || trimmed === '*') {
    return null;
  }
  const parsed = Number.parseFloat(trimmed.replace(/^\./, '0.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function eventRecords(): FdEvent[] {
  return FD_2007_ROUNDS.map((round) => ({
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

export function parseFormulaDrift2007StandingsHtml(html: string): FdSeasonData {
  const $ = cheerio.load(html);
  const events = eventRecords();
  const winners = new Set(FD_2007_ROUNDS.map((round) => round.winnerSlug));
  const pilots = new Map<string, FdPilot>();

  $('table').each((_, table) => {
    const rows = $(table).find('tr').toArray();
    if (rows.length < 20) return;

    for (const row of rows) {
      const driverLink = $(row).find('a[href*="/drivers/"]').first();
      const href = driverLink.attr('href') ?? '';
      const slug = href.match(/\/drivers\/([^./?#]+)/)?.[1];
      if (!slug) continue;

      const cells = $(row)
        .find('td')
        .toArray()
        .map((cell) => cleanCell($(cell).text()));
      const nameIndex = cells.findIndex((cell) => cell && cell === cleanCell(driverLink.text()));
      if (nameIndex < 0) continue;

      const carNumber = parseWaybackPointsCell(cells[nameIndex - 1] ?? '');
      const pairCells = cells.slice(nameIndex + 1);
      const stages: FdStageResult[] = [];

      for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
        const qualRaw = pairCells[eventIndex * 2] ?? '';
        const compRaw = pairCells[eventIndex * 2 + 1] ?? '';
        const qualifyingPoints = parseWaybackPointsCell(qualRaw);
        const competitionPoints = parseWaybackPointsCell(compRaw);
        if (qualifyingPoints == null && competitionPoints == null) continue;

        const event = events[eventIndex]!;
        const combined = (qualifyingPoints ?? 0) + (competitionPoints ?? 0);
        stages.push({
          eventSlug: event.slug,
          roundNumber: event.roundNumber,
          qualifyingPosition: null,
          qualifyingPoints,
          qualScore100: null,
          tandemPosition:
            winners.has(slug) && FD_2007_ROUNDS[eventIndex]!.winnerSlug === slug
              ? 1
              : competitionPoints === 100
                ? 1
                : null,
          points: Math.round(combined),
        });
      }

      if (stages.length === 0) continue;
      const names = namesFromWaybackDriverSlug(slug);
      pilots.set(slug, {
        slug,
        fdDriverId: fdDriverIdFromSlug(slug),
        firstName: names.firstName,
        lastName: names.lastName,
        nameAlias: names.nameAlias,
        country: null,
        number: carNumber != null ? Math.round(carNumber) : null,
        photoSourceUrl: null,
        team: null,
        stages,
      });
    }
  });

  if (pilots.size === 0) {
    throw new Error('Wayback 2007 Formula Drift standings table parsed empty');
  }

  return {
    sourceUrl: FD_2007_WAYBACK_URL,
    seasonYear: 2007,
    events,
    pilots: [...pilots.values()],
  };
}

export async function fetchFormulaDriftSeasonFromWayback(seasonYear: number): Promise<FdSeasonData> {
  if (seasonYear !== 2007) {
    throw new Error(`Wayback Formula Drift importer only covers 2007, not ${seasonYear}`);
  }

  const response = await fetch(FD_2007_WAYBACK_URL, {
    headers: { accept: 'text/html', 'user-agent': WAYBACK_UA },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Wayback 2007 standings: ${response.status}`);
  }

  return parseFormulaDrift2007StandingsHtml(await response.text());
}
