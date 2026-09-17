import { fetchSvelteKitPage } from './sveltekit.js';
import { normalizeToken } from '../lib/transliterate.js';

const BASE = 'https://royalds.cn/en';

export interface RoyalDsStageResult {
  eventSlug: string;
  roundNumber: number;
  qualifyingPosition: number | null;
  qualifyingPoints: number | null;
  tandemPosition: number | null;
  tandemPoints: number | null;
  points: number;
  status: string | null;
  official: boolean;
}

export interface RoyalDsPilot {
  slug: string;
  firstName: string;
  lastName: string;
  nameAlias: string | null;
  nickname: string | null;
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
  name: string;
  nameCn: string | null;
  cityEn: string;
  trackName: string;
  country: string;
  startsAt: string;
  status: 'FINISHED' | 'SCHEDULED' | 'CANCELLED';
}

export interface RoyalDsTeamStage {
  eventSlug: string;
  roundNumber: number;
  points: number;
  official: boolean;
}

export interface RoyalDsTeam {
  slug: string;
  name: string;
  position: number;
  totalPoints: number;
  stages: RoyalDsTeamStage[];
}

export interface RoyalDsSeasonData {
  sourceUrl: string;
  seasonYear: number;
  events: RoyalDsEvent[];
  pilots: RoyalDsPilot[];
  teams: RoyalDsTeam[];
}

interface StandingsStage {
  eventSlug: string;
  roundNumber: number;
  qualifyingPosition: number | null;
  qualifyingPoints: number | null;
  tandemPoints: number | null;
  totalPoints: number | null;
  position: number | null;
  status: string | null;
  official: boolean;
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
      trackEn: string | null;
      phase: string;
      startsAt: string;
      official: boolean;
    }>;
    personal: Array<{
      totalPoints: number | null;
      driverSlug: string;
      fullNameEn: string;
      fullNameCn: string | null;
      nickname: string | null;
      racingNumber: string | number | null;
      countryCode: string | null;
      photoPortraitUrl: string | null;
      team: string | null;
      stages: StandingsStage[];
    }>;
    teams: Array<{
      position: number;
      totalPoints: number;
      teamSlug: string;
      teamLabel: string;
      nameEn: string | null;
      stages: Array<{
        eventSlug: string;
        roundNumber: number;
        totalPoints: number | null;
        official: boolean;
      }>;
    }>;
  };
}

export interface RoyalDsEventDetails {
  slug: string;
  trackName: string | null;
  cityEn: string | null;
  qualScores: Map<string, number>;
  tandemRecords: Map<string, { battles: number; wins: number }>;
  teams: Array<{ name: string; points: number; position: number | null }>;
}

interface EventPage {
  results: {
    event: {
      slug: string;
      trackEn: string | null;
      cityEn: string | null;
    };
    qualification?: Array<{
      driverSlug: string;
      total: number | null;
    }>;
    bracket?: Array<{
      status: string | null;
      top: { slug: string } | null;
      bottom: { slug: string } | null;
      winner: { slug: string } | null;
    }>;
    teams?: Array<{
      position: number | null;
      teamLabel: string;
      totalPoints: number | null;
    }>;
  };
}

const PARTICIPATED_STATUSES = new Set(['scored', 'zero', 'dnq', 'dns']);

export function parseRacingNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function participatedStage(stage: StandingsStage): boolean {
  if (!stage.official) return false;
  const status = (stage.status ?? '').trim().toLowerCase();
  if (PARTICIPATED_STATUSES.has(status)) return true;
  if ((stage.totalPoints ?? 0) > 0) return true;
  if (stage.qualifyingPosition != null || stage.position != null) return true;
  return false;
}

function titleCasePart(value: string): string {
  if (!value) return value;
  if (/[a-z]/.test(value) && /[A-ZÀ-ÖØ-Þ]/.test(value)) return value;
  return value
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join('-');
}

function formatNameParts(parts: string[]): string {
  return parts.map(titleCasePart).join(' ');
}

function tokensMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function sameTokenOrder(parts: string[], nickParts: string[]): boolean {
  if (parts.length !== nickParts.length) return false;
  return parts.every((part, index) => normalizeToken(part) === normalizeToken(nickParts[index]!));
}

/**
 * Official `fullNameEn` mixes «Family Given» and «Given Family».
 * `nickname` is consistently Given Family (ARTEM SHABANOV) and tells us the order;
 * spelling still comes from fullNameEn.
 */
export function parseRoyalDsName(
  fullNameEn: string,
  nickname: string | null | undefined,
  driverSlug: string,
): { firstName: string; lastName: string } {
  const parts = fullNameEn.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: driverSlug, lastName: driverSlug };
  if (parts.length === 1) {
    const single = formatNameParts(parts);
    return { firstName: single, lastName: single };
  }

  const nickParts = (nickname ?? '').trim().split(/\s+/).filter(Boolean);
  if (nickParts.length >= 2) {
    if (sameTokenOrder(parts, nickParts) && parts.length >= 3) {
      return { lastName: formatNameParts([parts[0]!]), firstName: formatNameParts(parts.slice(1)) };
    }
    const nickLast = normalizeToken(nickParts[nickParts.length - 1]!);
    const familyIndex = parts.findIndex((part) => tokensMatch(normalizeToken(part), nickLast));
    if (familyIndex === 0) {
      return { lastName: formatNameParts([parts[0]!]), firstName: formatNameParts(parts.slice(1)) };
    }
    if (familyIndex === parts.length - 1) {
      return {
        firstName: formatNameParts(parts.slice(0, -1)),
        lastName: formatNameParts([parts[parts.length - 1]!]),
      };
    }
    if (familyIndex > 0) {
      return {
        firstName: formatNameParts(parts.slice(0, familyIndex)),
        lastName: formatNameParts(parts.slice(familyIndex)),
      };
    }
  }

  const slugLead = normalizeToken(driverSlug.split('-')[0] ?? '');
  const firstLead = normalizeToken(parts[0]!);
  const lastLead = normalizeToken(parts[parts.length - 1]!);
  const matchesLead = (token: string) =>
    slugLead.length >= 3 && (slugLead.startsWith(token) || token.startsWith(slugLead));

  if (matchesLead(lastLead) && !matchesLead(firstLead)) {
    return { firstName: formatNameParts(parts.slice(0, -1)), lastName: formatNameParts([parts[parts.length - 1]!]) };
  }
  if (matchesLead(firstLead)) {
    return { lastName: formatNameParts([parts[0]!]), firstName: formatNameParts(parts.slice(1)) };
  }

  return { lastName: formatNameParts([parts[0]!]), firstName: formatNameParts(parts.slice(1)) };
}

function mapEventStatus(phase: string): RoyalDsEvent['status'] {
  if (phase === 'FINISHED') return 'FINISHED';
  if (phase === 'CANCELLED') return 'CANCELLED';
  return 'SCHEDULED';
}

export function tandemRecordsFromBracket(
  bracket: Array<{
    status: string | null;
    top: { slug: string } | null;
    bottom: { slug: string } | null;
    winner: { slug: string } | null;
  }>,
): Map<string, { battles: number; wins: number }> {
  const records = new Map<string, { battles: number; wins: number }>();
  const bump = (slug: string, win: boolean) => {
    const current = records.get(slug) ?? { battles: 0, wins: 0 };
    current.battles += 1;
    if (win) current.wins += 1;
    records.set(slug, current);
  };

  for (const battle of bracket) {
    if ((battle.status ?? '').toUpperCase() !== 'COMPLETED') continue;
    const top = battle.top?.slug;
    const bottom = battle.bottom?.slug;
    const winner = battle.winner?.slug;
    if (!top || !bottom || !winner) continue;
    bump(top, winner === top);
    bump(bottom, winner === bottom);
  }

  return records;
}

/** Keep official DNQ/DNS/zero rows; drop empty calendar placeholders. */
export function normalizeRoyalDsStandings(raw: StandingsPage): RoyalDsSeasonData {
  const { season, events, personal, teams } = raw.standings;

  const mappedEvents: RoyalDsEvent[] = events.map((event) => ({
    slug: event.slug,
    roundNumber: event.roundNumber,
    name: event.titleEn,
    nameCn: event.titleCn,
    cityEn: event.cityEn,
    trackName: event.trackEn?.trim() || event.titleEn,
    country: 'China',
    startsAt: event.startsAt,
    status: mapEventStatus(event.phase),
  }));

  const pilots: RoyalDsPilot[] = personal
    .map((row) => {
      const { firstName, lastName } = parseRoyalDsName(row.fullNameEn, row.nickname, row.driverSlug);
      const stages = (row.stages ?? [])
        .filter(participatedStage)
        .map((stage) => ({
          eventSlug: stage.eventSlug,
          roundNumber: stage.roundNumber,
          qualifyingPosition: stage.qualifyingPosition,
          qualifyingPoints: stage.qualifyingPoints,
          tandemPosition: stage.position,
          tandemPoints: stage.tandemPoints,
          points: stage.totalPoints ?? 0,
          status: stage.status,
          official: stage.official,
        }));

      return {
        slug: row.driverSlug,
        firstName,
        lastName,
        nameAlias: row.fullNameCn,
        nickname: row.nickname,
        country: row.countryCode,
        number: parseRacingNumber(row.racingNumber),
        photoSourceUrl: row.photoPortraitUrl,
        team: row.team,
        totalPoints: row.totalPoints ?? 0,
        stages,
      };
    })
    .filter((pilot) => pilot.stages.length > 0);

  const mappedTeams: RoyalDsTeam[] = (teams ?? []).map((team) => ({
    slug: team.teamSlug,
    name: team.teamLabel,
    position: team.position,
    totalPoints: team.totalPoints,
    stages: (team.stages ?? [])
      .filter((stage) => stage.official)
      .map((stage) => ({
        eventSlug: stage.eventSlug,
        roundNumber: stage.roundNumber,
        points: stage.totalPoints ?? 0,
        official: stage.official,
      })),
  }));

  return {
    sourceUrl: `${BASE}/results`,
    seasonYear: season.year,
    events: mappedEvents,
    pilots,
    teams: mappedTeams,
  };
}

export async function fetchRoyalDsSeason(): Promise<RoyalDsSeasonData> {
  const page = await fetchSvelteKitPage<StandingsPage>(`${BASE}/results`);
  return normalizeRoyalDsStandings(page);
}

export async function fetchRoyalDsEventDetails(eventSlug: string): Promise<RoyalDsEventDetails> {
  const page = await fetchSvelteKitPage<EventPage>(`${BASE}/results/${eventSlug}`);
  const event = page.results.event;
  const qualScores = new Map<string, number>();

  for (const row of page.results.qualification ?? []) {
    if (row.total != null && Number.isFinite(row.total)) {
      qualScores.set(row.driverSlug, row.total);
    }
  }

  return {
    slug: event.slug,
    trackName: event.trackEn?.trim() || null,
    cityEn: event.cityEn?.trim() || null,
    qualScores,
    tandemRecords: tandemRecordsFromBracket(page.results.bracket ?? []),
    teams: (page.results.teams ?? [])
      .filter((team) => Boolean(team.teamLabel))
      .map((team) => ({
        name: team.teamLabel,
        points: team.totalPoints ?? 0,
        position: team.position,
      })),
  };
}

/** @deprecated use fetchRoyalDsEventDetails */
export async function fetchRoyalDsEventQualScores(eventSlug: string): Promise<Map<string, number>> {
  const details = await fetchRoyalDsEventDetails(eventSlug);
  return details.qualScores;
}
