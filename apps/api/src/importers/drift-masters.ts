import { alpha3ToAlpha2 } from '../lib/countryCode.js';

const BASE = 'https://dm.gp/umbraco/api/v1';
const SITE = 'https://dm.gp';

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
  nameEn: string;
  nameRu: string;
  trackEn: string;
  trackRu: string;
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

interface DmSeasonMeta {
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

function formatEventName(round: DmRoundMeta): { nameEn: string; trackEn: string } {
  const track = [round.circuitName, round.circuitCity].filter(Boolean).join(', ');
  return {
    nameEn: `Round ${round.roundNumber} — ${track}`,
    trackEn: track || round.circuitName,
  };
}

export async function listDriftMastersSeasons(): Promise<DmSeasonMeta[]> {
  return fetchJson<DmSeasonMeta[]>('/seasons');
}

export async function fetchDriftMastersSeason(seasonYear: number): Promise<DmSeasonData> {
  const seasons = await listDriftMastersSeasons();
  const season = seasons.find((item) => item.year === seasonYear);
  if (!season) {
    throw new Error(`Drift Masters season ${seasonYear} not found on dm.gp`);
  }

  const [rounds, standings] = await Promise.all([
    fetchJson<DmRoundMeta[]>(`/seasons/${season.id}/rounds`),
    fetchJson<DmDriverStanding[]>(`/seasons/${season.id}/standings/drivers`),
  ]);

  const roundByNumber = new Map(rounds.map((round) => [round.roundNumber, round]));

  const events: DmEvent[] = rounds
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map((round) => {
      const { nameEn, trackEn } = formatEventName(round);
      return {
        slug: eventSlug(round.roundNumber),
        roundNumber: round.roundNumber,
        nameEn,
        nameRu: nameEn,
        trackEn,
        trackRu: trackEn,
        startsAt: round.startDate,
        status: mapEventStatus(round.endDate),
      };
    });

  const pilots: DmPilot[] = standings
    .filter((row) => row.totalPoints > 0)
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
