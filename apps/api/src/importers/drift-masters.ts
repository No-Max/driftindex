import { alpha3ToAlpha2 } from '../lib/countryCode.js';
import { buildNameKey, normalizeToken } from '../lib/transliterate.js';

const BASE = 'https://dm.gp/umbraco/api/v1';
const SITE = 'https://dm.gp';
const RAWMOTION_BASE = 'https://live.rawmotion.com/api/v1';

/** dm.gp season metadata — used when /seasons API is unavailable. */
export const DM_GP_SEASONS: DmSeasonMeta[] = [
  { id: 'e1ce883d-7c51-4eca-9568-19e128ae491e', slug: 'drift-masters-2023', year: 2023, isCurrent: false },
  { id: 'f12a7013-244a-4c0d-bcac-2f114745d236', slug: 'drift-masters-2024', year: 2024, isCurrent: false },
  { id: '2921cac0-c54c-4448-9c88-dfc42b8b967a', slug: 'drift-masters-2025', year: 2025, isCurrent: false },
  { id: 'de78e5bb-ebc3-4d79-abdf-fdcf4fd99c26', slug: 'drift-masters-2026', year: 2026, isCurrent: true },
];

/** RawMotion event IDs for seasons where dm.gp omits qualifying data. */
const RAWMOTION_DM_EVENT_IDS: Record<number, string> = {
  2019: '0c7108a1-8da7-11e9-909b-f171dc59e2a3',
  2020: 'a50a8291-dbe3-11ea-9f2a-4501e44f4496',
  2021: 'be93e8f1-df34-11eb-9b03-a1996b56ef47',
  2022: '9d5cb870-caba-11ec-9b6a-07912c2ae072',
  2024: 'f8488bd1-0eb8-11ef-8e9f-db3243ea316e',
  2025: '6fa30551-2d00-11f0-9310-b544412bc579',
  2026: '24217941-4497-11f1-9a48-e5b2f4f9b363',
};

const rawMotionAthleteNamesByEvent = new Map<
  string,
  Map<string, { firstName: string; lastName: string }>
>();

export interface DmStageResult {
  eventSlug: string;
  roundNumber: number;
  qualifyingPosition: number | null;
  qualifyingPoints: number | null;
  tandemPosition: number | null;
  points: number;
}

export interface DmPilot {
  slug: string;
  firstName: string;
  lastName: string;
  nameAlias: string | null;
  country: string | null;
  number: number | null;
  photoSourceUrl: string | null;
  team: string | null;
  totalPoints: number;
  stages: DmStageResult[];
}

export interface DmEvent {
  slug: string;
  roundNumber: number;
  name: string;
  trackName: string;
  startsAt: string;
  status: 'FINISHED' | 'SCHEDULED' | 'CANCELLED';
}

export interface DmSeasonData {
  sourceUrl: string;
  seasonYear: number;
  seasonId: string;
  events: DmEvent[];
  pilots: DmPilot[];
}

export interface DmQualResult {
  roundNumber: number;
  rank: number;
  qualScore100: number;
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string | null;
  bib: number | null;
}

export interface DmSeasonMeta {
  id: string;
  slug: string;
  year: number;
  isCurrent: boolean;
}

interface DmRoundMeta {
  id: string;
  roundNumber: number;
  slug: string;
  startDate: string;
  endDate: string;
  circuitName: string;
  circuitCity: string;
  countryCode: string;
}

interface DmDriverStanding {
  globalDriverId: string;
  seasonDriverId: string;
  fullName: string;
  startingNumber: number;
  nationality: string;
  position: number | null;
  totalPoints: number;
  imageUrl: string | null;
  carName: string | null;
  isWildcard: boolean;
  driverSlug: string;
  roundsResults: Array<{
    roundId: string;
    roundNumber: number;
    points: number;
    position: number | null;
  }>;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { accept: 'application/json', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${BASE}${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function fetchRawMotionJson<T>(path: string): Promise<T> {
  const response = await fetch(`${RAWMOTION_BASE}${path}`, {
    headers: { accept: 'application/json', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${RAWMOTION_BASE}${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

interface RawMotionRoundMeta {
  name: string;
  externalId: string;
}

interface RawMotionQualRow {
  rank: number;
  value: string;
  firstname?: string;
  lastname?: string;
  nation?: string;
  bib?: string;
  externalAthleteId?: string;
}

interface RawMotionHeat {
  results: RawMotionQualRow[];
}

function parseQualScore(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function titleCaseName(value: string): string {
  return titleCase(value.trim());
}

/** Qualifying results keyed by normalized pilot name (round number → lookup). */
export function buildDmQualLookup(results: DmQualResult[]): Map<string, DmQualResult> {
  const lookup = new Map<string, DmQualResult>();
  for (const row of results) {
    const key = buildNameKey(row.firstName, row.lastName, row.fullName);
    lookup.set(key, row);
  }
  return lookup;
}

function lastNamesMatch(left: string, right: string): boolean {
  const a = normalizeToken(left);
  const b = normalizeToken(right);
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function firstNamesMatch(left: string, right: string): boolean {
  const a = normalizeToken(left);
  const b = normalizeToken(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const prefixLength = Math.min(3, a.length, b.length);
  return a.slice(0, prefixLength) === b.slice(0, prefixLength);
}

/** Match dm.gp pilot to RawMotion qual row (handles Pawel/Paweł, Dave/David, etc.). */
export function findDmQualResult(
  rows: DmQualResult[],
  firstName: string,
  lastName: string,
  nameAlias: string | null | undefined,
): DmQualResult | undefined {
  const lookup = buildDmQualLookup(rows);
  const aliasNames = nameAlias ? parseDriverName(nameAlias) : null;
  const keys = [
    buildNameKey(firstName, lastName, nameAlias),
    aliasNames ? buildNameKey(aliasNames.firstName, aliasNames.lastName, nameAlias) : null,
  ].filter((key): key is string => key != null);

  for (const key of keys) {
    const hit = lookup.get(key);
    if (hit) return hit;
  }

  const lastMatches = rows.filter((row) => lastNamesMatch(row.lastName, lastName));
  if (lastMatches.length === 1) return lastMatches[0];

  const fuzzyMatches = lastMatches.filter((row) => firstNamesMatch(row.firstName, firstName));
  return fuzzyMatches.length === 1 ? fuzzyMatches[0] : undefined;
}

async function loadRawMotionAthleteNamesForEvent(
  eventId: string,
): Promise<Map<string, { firstName: string; lastName: string }>> {
  const cached = rawMotionAthleteNamesByEvent.get(eventId);
  if (cached) return cached;

  const names = new Map<string, { firstName: string; lastName: string }>();

  for (let roundNumber = 1; roundNumber <= 7; roundNumber++) {
    try {
      const rounds = await fetchRawMotionJson<RawMotionRoundMeta[]>(
        `/event/${eventId}/contest/${roundNumber}/rounds`,
      );
      const qualRound =
        rounds.find((round) => round.name === 'Qualifying') ??
        rounds.find((round) => /^Q\d+\s+Qualifying$/i.test(round.name)) ??
        rounds.find((round) => /qualifying/i.test(round.name) && !/top\s*32/i.test(round.name));
      if (!qualRound) continue;

      const heats = await fetchRawMotionJson<RawMotionHeat[]>(
        `/event/${eventId}/contest/${roundNumber}/round/${qualRound.externalId}/heat/0`,
      );
      for (const row of heats[0]?.results ?? []) {
        if (!row.externalAthleteId || !row.firstname || !row.lastname) continue;
        names.set(row.externalAthleteId, {
          firstName: titleCaseName(row.firstname),
          lastName: titleCaseName(row.lastname),
        });
      }
    } catch {
      // Some event/round combinations are missing on RawMotion.
    }
  }

  rawMotionAthleteNamesByEvent.set(eventId, names);
  return names;
}

async function fetchRawMotionRoundQual(
  eventId: string,
  roundNumber: number,
): Promise<DmQualResult[]> {
  const athleteNames = await loadRawMotionAthleteNamesForEvent(eventId);
  const rounds = await fetchRawMotionJson<RawMotionRoundMeta[]>(
    `/event/${eventId}/contest/${roundNumber}/rounds`,
  );
  const qualRound =
    rounds.find((round) => round.name === 'Qualifying') ??
    rounds.find((round) => /^Q\d+\s+Qualifying$/i.test(round.name)) ??
    rounds.find((round) => /qualifying/i.test(round.name) && !/top\s*32/i.test(round.name));
  if (!qualRound) {
    throw new Error(`Qualifying round not found for contest ${roundNumber}`);
  }

  const heats = await fetchRawMotionJson<RawMotionHeat[]>(
    `/event/${eventId}/contest/${roundNumber}/round/${qualRound.externalId}/heat/0`,
  );
  const results = heats[0]?.results ?? [];

  return results
    .map((row) => {
      const qualScore100 = parseQualScore(row.value);
      if (qualScore100 == null) return null;

      const resolved = row.externalAthleteId ? athleteNames.get(row.externalAthleteId) : undefined;
      const firstName = row.firstname
        ? titleCaseName(row.firstname)
        : (resolved?.firstName ?? '');
      const lastName = row.lastname ? titleCaseName(row.lastname) : (resolved?.lastName ?? '');
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      const bibRaw = row.bib == null ? '' : String(row.bib).trim();
      const bibParsed = bibRaw ? Number.parseInt(bibRaw, 10) : Number.NaN;
      const bib = Number.isFinite(bibParsed) ? bibParsed : null;
      if (!fullName && bib == null) return null;

      return {
        roundNumber,
        rank: row.rank,
        qualScore100,
        firstName,
        lastName,
        fullName: fullName || 'Unknown',
        nationality: row.nation || null,
        bib,
      } satisfies DmQualResult;
    })
    .filter((row): row is DmQualResult => row != null);
}

/** Fetch qualifying scores from RawMotion live scoring (dm.gp API has no qual data). */
export async function fetchDriftMastersQualByRound(
  seasonYear: number,
  roundCount = 7,
): Promise<Map<number, DmQualResult[]>> {
  const eventId = RAWMOTION_DM_EVENT_IDS[seasonYear];
  if (!eventId) {
    return new Map();
  }

  const byRound = new Map<number, DmQualResult[]>();
  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    try {
      const rows = await fetchRawMotionRoundQual(eventId, roundNumber);
      byRound.set(roundNumber, rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`RawMotion qual unavailable for round ${roundNumber}: ${message}`);
    }
  }

  return byRound;
}

function parseDriverName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    const only = titleCase(parts[0]!);
    return { firstName: only, lastName: only };
  }

  const firstName = titleCase(parts[0]!);
  const lastName = titleCase(parts.slice(1).join(' '));
  return { firstName, lastName };
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/([\s-'])/)
    .map((part) => (/^[a-z]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('');
}

function eventSlug(roundNumber: number): string {
  return `dm-r${roundNumber}`;
}

function pilotSlug(driverSlug: string): string {
  return `dm-${driverSlug}`;
}

function absoluteMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SITE}${path.startsWith('/') ? path : `/${path}`}`;
}

function mapEventStatus(endDate: string): DmEvent['status'] {
  const end = Date.parse(endDate);
  if (!Number.isFinite(end)) return 'SCHEDULED';
  return end < Date.now() ? 'FINISHED' : 'SCHEDULED';
}

function formatEventName(round: DmRoundMeta): { name: string; trackName: string } {
  const track = [round.circuitName, round.circuitCity].filter(Boolean).join(', ');
  return {
    name: `Round ${round.roundNumber} — ${track}`,
    trackName: track || round.circuitName,
  };
}

export async function listDriftMastersSeasons(): Promise<DmSeasonMeta[]> {
  try {
    return await fetchJson<DmSeasonMeta[]>('/seasons');
  } catch {
    return [...DM_GP_SEASONS];
  }
}

async function resolveDriftMastersSeason(seasonYear: number): Promise<DmSeasonMeta> {
  const fallback = DM_GP_SEASONS.find((item) => item.year === seasonYear);
  try {
    const seasons = await fetchJson<DmSeasonMeta[]>('/seasons');
    const season = seasons.find((item) => item.year === seasonYear);
    if (season) return season;
  } catch {
    // dm.gp /seasons endpoint is occasionally unavailable — use hardcoded IDs.
  }
  if (!fallback) {
    throw new Error(
      `Drift Masters season ${seasonYear} not found on dm.gp. Available: ${DM_GP_SEASONS.map((s) => s.year).join(', ')}`,
    );
  }
  return fallback;
}

export async function fetchDriftMastersSeason(seasonYear: number): Promise<DmSeasonData> {
  const season = await resolveDriftMastersSeason(seasonYear);

  const [rounds, standings] = await Promise.all([
    fetchJson<DmRoundMeta[]>(`/seasons/${season.id}/rounds`),
    fetchJson<DmDriverStanding[]>(`/seasons/${season.id}/standings/drivers`),
  ]);

  const roundByNumber = new Map(rounds.map((round) => [round.roundNumber, round]));

  const events: DmEvent[] = rounds
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map((round) => {
      const { name, trackName } = formatEventName(round);
      return {
        slug: eventSlug(round.roundNumber),
        roundNumber: round.roundNumber,
        name,
        trackName,
        startsAt: round.startDate,
        status: mapEventStatus(round.endDate),
      };
    });

  const pilots: DmPilot[] = standings
    .filter(
      (row) =>
        row.totalPoints > 0 ||
        row.imageUrl != null ||
        row.roundsResults.some((stage) => stage.points > 0 || stage.position != null),
    )
    .map((row) => {
      const { firstName, lastName } = parseDriverName(row.fullName);
      const stages: DmStageResult[] = row.roundsResults
        .filter((stage) => stage.points > 0)
        .map((stage) => ({
          eventSlug: eventSlug(stage.roundNumber),
          roundNumber: stage.roundNumber,
          qualifyingPosition: null,
          qualifyingPoints: null,
          tandemPosition: stage.position,
          points: Math.round(stage.points),
        }));

      return {
        slug: pilotSlug(row.driverSlug),
        firstName,
        lastName,
        nameAlias: row.fullName,
        country: alpha3ToAlpha2(row.nationality),
        number: row.startingNumber || null,
        photoSourceUrl: absoluteMediaUrl(row.imageUrl),
        team: row.carName,
        totalPoints: Math.round(row.totalPoints),
        stages,
      };
    });

  return {
    sourceUrl: `${SITE}/seasons/${season.slug}/standings/`,
    seasonYear: season.year,
    seasonId: season.id,
    events,
    pilots,
  };
}
