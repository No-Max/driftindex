export type EventStatus = 'SCHEDULED' | 'FINISHED' | 'CANCELLED';

export {
  compareEventResultsChronologically,
  eventChronologyTimestamp,
  type EventChronologyFields,
} from './eventChronology.js';

export interface DataSource {
  labelEn: string;
  labelRu: string;
  url: string | null;
}

export interface SeriesSummary {
  slug: string;
  name: string;
  shortName: string | null;
  country: string | null;
  logoUrl?: string | null;
}

export interface SeasonSummary {
  year: number;
  nameEn: string | null;
  nameRu: string | null;
  eventCount: number;
  finishedEventCount: number;
}

export interface TrackSummary {
  slug: string;
  name: string;
  country: string | null;
  city: string | null;
  description: string | null;
  photoUrl: string | null;
}

export interface StandingQualCell {
  qualPosition: number | null;
  qualScore100: number | null;
}

export interface StandingRow {
  rank: number;
  pilotSlug: string;
  firstName: string;
  lastName: string;
  country: string | null;
  number: number | null;
  totalPoints: number;
  eventPoints: Array<number | null>;
  eventQual: Array<StandingQualCell | null>;
}

export function seriesEventPath(seriesSlug: string, seasonYear: number, eventSlug: string): string {
  return `/series/${seriesSlug}/${seasonYear}/${eventSlug}`;
}

export function seriesStandingsPath(seriesSlug: string, seasonYear: number): string {
  return `/series/${seriesSlug}/${seasonYear}`;
}

export interface SeasonEventSummary {
  slug: string;
  roundNumber: number;
  name: string;
  track: TrackSummary | null;
  status: EventStatus;
  eventPath: string;
}

export interface SeasonStandingsResponse {
  series: SeriesSummary;
  season: SeasonSummary;
  events: SeasonEventSummary[];
  standings: StandingRow[];
  source: DataSource | null;
}

export interface SeriesProfileEvent {
  slug: string;
  roundNumber: number;
  name: string;
  track: TrackSummary | null;
  status: EventStatus;
  startsAt: string | null;
  standingsPath: string;
  eventPath: string;
}

export interface SeasonEventResultRow {
  pilotSlug: string;
  firstName: string;
  lastName: string;
  country: string | null;
  number: number | null;
  qualPosition: number | null;
  qualScore100: number | null;
  qualPoints: number | null;
  tandemPosition: number | null;
  tandemBattles: number | null;
  tandemWins: number | null;
  points: number;
}

export interface SeasonEventResponse {
  series: SeriesSummary;
  season: SeasonSummary;
  event: {
    slug: string;
    roundNumber: number;
    name: string;
    track: TrackSummary | null;
    status: EventStatus;
    startsAt: string | null;
    standingsPath: string;
  };
  source: DataSource | null;
  results: SeasonEventResultRow[];
}

export interface SeriesProfileSeason {
  year: number;
  nameEn: string | null;
  nameRu: string | null;
  eventCount: number;
  finishedEventCount: number;
  source: DataSource | null;
  standingsPath: string;
  events: SeriesProfileEvent[];
}

export interface SeriesProfileResponse {
  series: SeriesSummary;
  seasons: SeriesProfileSeason[];
}

export interface PilotStats {
  eventsCount: number;
  seasonsCount: number;
  tandemBattles: number;
  tandemWins: number;
  tandemWinPct: number | null;
  avgQualScore: number | null;
}

export interface PilotSummary {
  slug: string;
  firstName: string;
  lastName: string;
  country: string | null;
  number: number | null;
  photoUrl?: string | null;
  stats?: PilotStats;
}

export interface SeriesCard extends SeriesSummary {
  logoUrl: string | null;
}

export interface HomeChampionshipStandingEntry {
  pilot: PilotSummary;
  points: number;
}

export interface HomeChampionshipCard {
  series: SeriesCard;
  seasonYear: number;
  /** First tracked season year for the series. */
  seriesStartYear: number;
  leader: PilotSummary | null;
  leaderPoints: number | null;
  /** Current season standings, places 1–3 when available. */
  topThree: HomeChampionshipStandingEntry[];
  standingsPath: string;
}

export interface HomeQualWinner {
  pilot: PilotSummary;
  series: SeriesCard;
  event: {
    slug: string;
    roundNumber: number;
    name: string;
    track: TrackSummary | null;
  };
  qualScore: number | null;
  gapToSecond: number | null;
}

export interface HomeCalendarEvent {
  seriesSlug: string;
  seriesName: string;
  seriesShortName: string | null;
  logoUrl: string | null;
  seasonYear: number;
  eventSlug: string;
  roundNumber: number;
  name: string;
  track: TrackSummary | null;
  startsAt: string;
  status: EventStatus;
  standingsPath: string;
}

export interface HomeP4PSeasonEvent {
  roundNumber: number;
  eventName: string;
  qualPosition: number | null;
  qualScore100: number | null;
  eventPlace: number | null;
  tandemBattles: number | null;
  tandemWins: number | null;
  points: number;
}

export interface HomeP4PSeriesParticipation {
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl?: string | null;
  /** Raw series Hardness used in P4P. */
  weight: number;
  /** Mean event place in the season (1 decimal). */
  place: number;
  avgQualScore: number | null;
}

export interface HomeP4PEntry {
  rank: number;
  score: number;
  pilot: PilotSummary;
  bestSeries: HomeP4PSeriesParticipation;
  /** Other featured series the pilot entered in the same season (excluding best). */
  otherSeries: HomeP4PSeriesParticipation[];
  /** Finished events in the P4P best series for the current season. */
  bestSeriesEvents: HomeP4PSeasonEvent[];
}

export interface OverlapContribution {
  pilotSlug: string;
  firstName: string;
  lastName: string;
  targetSeriesSlug: string;
  otherSeriesSlug: string;
  /** Mean event place in the target series (1 decimal). */
  avgPlaceTarget: number;
  /** Mean event place in the other series (1 decimal). */
  avgPlaceOther: number;
  /** Internal indexPoints delta; used for sorting, not shown in UI. */
  delta: number;
}

export interface SeriesPrestigeEntry {
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl?: string | null;
  effectiveOrder: number;
  /** Raw overlap hardness = −mean(P); null when no overlap data. */
  hardnessScore: number | null;
  /** Overlap coefficient H = (hardnessScore + 32) / 32; null when no overlap data. */
  coefficient: number | null;
  overlapSamples: number;
  contributions: OverlapContribution[];
}

export interface SeriesPrestigeResponse {
  year: number | null;
  totalSeries: number;
  overlapGroups: number;
  historyYears: number;
  historyFromYear: number | null;
  historyToYear: number | null;
  source: 'overlap' | 'insufficient';
  entries: SeriesPrestigeEntry[];
}

export interface HomeResponse {
  year: number;
  seriesPrestige: SeriesPrestigeResponse;
  championships: HomeChampionshipCard[];
  qualWinners: HomeQualWinner[];
  calendar: HomeCalendarEvent[];
  poundForPound: HomeP4PEntry[];
  fanVotes: {
    bestPilot: { status: 'coming_soon' };
    bestCar: { status: 'coming_soon' };
  };
}

export interface PilotSeriesPhoto {
  seriesSlug: string;
  seriesName: string;
  seriesShortName: string | null;
  photoUrl: string;
}

export interface PilotListSeriesParticipation {
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl?: string | null;
  weight: number;
  place: number;
  avgQualScore: number | null;
}

export interface PilotListEntry {
  rank: number | null;
  score: number | null;
  pilot: PilotSummary;
  bestSeries: PilotListSeriesParticipation | null;
  /** Featured series the pilot entered in this season (best P4P series first). */
  seriesParticipations: PilotListSeriesParticipation[];
}

export interface PilotsListResponse {
  year: number;
  pilotCount: number;
  seriesCount: number;
  rankedCount: number;
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  pilots: PilotListEntry[];
}

export interface PilotProfileResponse extends PilotSummary {
  photos: PilotSeriesPhoto[];
  stats: PilotStats;
  results: Array<{
    seriesSlug: string;
    seriesName: string;
    seriesShortName: string | null;
    seasonYear: number;
    eventSlug: string;
    eventName: string;
    track: TrackSummary | null;
    startsAt: string | null;
    roundNumber: number;
    number: number | null;
    qualPosition: number | null;
    qualScore100: number | null;
    qualPoints: number | null;
    eventPlace: number | null;
    tandemBattles: number | null;
    tandemWins: number | null;
    points: number;
    source: DataSource | null;
  }>;
}

export interface TrackListEntry extends TrackSummary {
  eventCount: number;
  series: Array<{
    slug: string;
    name: string;
    shortName: string | null;
  }>;
  latestEvent: {
    seriesSlug: string;
    seriesName: string;
    seasonYear: number;
    eventSlug: string;
    eventName: string;
    startsAt: string | null;
  } | null;
}

export interface TracksListResponse {
  tracks: TrackListEntry[];
}

export interface TrackProfileResponse extends TrackSummary {
  events: Array<{
    seriesSlug: string;
    seriesName: string;
    seriesShortName: string | null;
    seasonYear: number;
    eventSlug: string;
    eventName: string;
    roundNumber: number;
    startsAt: string | null;
    status: EventStatus;
    standingsPath: string;
    eventPath: string;
  }>;
}
