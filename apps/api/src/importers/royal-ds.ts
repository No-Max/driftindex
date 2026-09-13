import { fetchSvelteKitPage } from './sveltekit.js';

const BASE = 'https://royalds.cn/en';

export interface RoyalDsStageResult {
  eventSlug: string;
  roundNumber: number;
  qualifyingPosition: number | null;
  qualifyingPoints: number | null;
  tandemPosition: number | null;
  tandemPoints: number | null;
  points: number;
  status: string;
  official: boolean;
}

export interface RoyalDsPilot {
  slug: string;
  firstName: string;
  lastName: string;
  nameAlias: string | null;
  country: string | null;
  number: number | null;
  photoSourceUrl: string | null;
  team: string | null;
  totalPoints: number;
  stages: RoyalDsStageResult[];
}

export interface RoyalDsEvent {
  slug: string;
  roundNumber: number;
  nameEn: string;
  nameRu: string;
  nameCn: string | null;
  cityEn: string;
  trackEn: string;
  startsAt: string;
  status: 'FINISHED' | 'SCHEDULED' | 'CANCELLED';
}

export interface RoyalDsSeasonData {
  sourceUrl: string;
  seasonYear: number;
  events: RoyalDsEvent[];
  pilots: RoyalDsPilot[];
}

interface StandingsPage {
  standings: {
    season: { year: number };
    events: Array<{
      slug: string;
      roundNumber: number;
      titleEn: string;
      titleRu: string;
      titleCn: string | null;
      cityEn: string;
      trackEn: string;
      phase: string;
      startsAt: string;
      official: boolean;
    }>;
    personal: Array<{
      totalPoints: number;
      driverSlug: string;
      fullNameEn: string;
      fullNameCn: string | null;
      nickname: string;
      racingNumber: string;
      countryCode: string | null;
      photoPortraitUrl: string | null;
      team: string | null;
      stages: Array<{
        eventSlug: string;
        roundNumber: number;
        qualifyingPosition: number | null;
        qualifyingPoints: number | null;
        tandemPoints: number | null;
        totalPoints: number;
        position: number | null;
        status: string;
        official: boolean;
      }>;
    }>;
  };
}

function hasScoredPoints(points: number | null | undefined): boolean {
  return (points ?? 0) > 0;
}

function parseName(fullNameEn: string): { firstName: string; lastName: string } {
  const parts = fullNameEn.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  const lastName = parts[0]!;
  const firstName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

function mapEventStatus(phase: string): RoyalDsEvent['status'] {
  if (phase === 'FINISHED') return 'FINISHED';
  if (phase === 'CANCELLED') return 'CANCELLED';
  return 'SCHEDULED';
}

/** Drop pilots with zero season points; drop stages with zero event points. */
export function normalizeRoyalDsStandings(raw: StandingsPage): RoyalDsSeasonData {
  const { season, events, personal } = raw.standings;

  const mappedEvents: RoyalDsEvent[] = events.map((event) => ({
    slug: event.slug,
    roundNumber: event.roundNumber,
    nameEn: event.titleEn,
    nameRu: event.titleRu,
    nameCn: event.titleCn,
    cityEn: event.cityEn,
    trackEn: event.trackEn,
    startsAt: event.startsAt,
    status: mapEventStatus(event.phase),
  }));

  const pilots: RoyalDsPilot[] = personal
    .filter((row) => hasScoredPoints(row.totalPoints))
    .map((row) => {
      const { firstName, lastName } = parseName(row.fullNameEn);
      const stages = row.stages
        .filter((stage) => stage.official && hasScoredPoints(stage.totalPoints))
        .map((stage) => ({
          eventSlug: stage.eventSlug,
          roundNumber: stage.roundNumber,
          qualifyingPosition: stage.qualifyingPosition,
          qualifyingPoints: stage.qualifyingPoints,
          tandemPosition: stage.position,
          tandemPoints: stage.tandemPoints,
          points: stage.totalPoints,
          status: stage.status,
          official: stage.official,
        }));

      return {
        slug: row.driverSlug,
        firstName,
        lastName,
        nameAlias: row.fullNameCn,
        country: row.countryCode,
        number: Number.parseInt(row.racingNumber, 10) || null,
        photoSourceUrl: row.photoPortraitUrl,
        team: row.team,
        totalPoints: row.totalPoints,
        stages,
      };
    });

  return {
    sourceUrl: `${BASE}/results`,
    seasonYear: season.year,
    events: mappedEvents,
    pilots,
  };
}

export async function fetchRoyalDsSeason(): Promise<RoyalDsSeasonData> {
  const page = await fetchSvelteKitPage<StandingsPage>(`${BASE}/results`);
  return normalizeRoyalDsStandings(page);
}

interface EventQualificationPage {
  results: {
    event: { slug: string };
    qualification: Array<{
      driverSlug: string;
      total: number | null;
    }>;
  };
}

/** Best qualifying run score (0–100) per driver on an event page. */
export async function fetchRoyalDsEventQualScores(eventSlug: string): Promise<Map<string, number>> {
  const page = await fetchSvelteKitPage<EventQualificationPage>(`${BASE}/results/${eventSlug}`);
  const scores = new Map<string, number>();

  for (const row of page.results.qualification ?? []) {
    if (row.total != null && Number.isFinite(row.total)) {
      scores.set(row.driverSlug, row.total);
    }
  }

  return scores;
}
