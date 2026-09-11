export type EventStatus = 'SCHEDULED' | 'FINISHED' | 'CANCELLED';

export interface DataSource {
  labelEn: string;
  labelRu: string;
  url: string | null;
}

export interface SeriesSummary {
  slug: string;
  nameEn: string;
  nameRu: string;
  country: string | null;
}

export interface SeasonSummary {
  year: number;
  nameEn: string | null;
  nameRu: string | null;
  eventCount: number;
  finishedEventCount: number;
}

export interface StandingRow {
  rank: number;
  pilotSlug: string;
  firstName: string;
  lastName: string;
  nameRu: string | null;
  country: string | null;
  number: number | null;
  totalPoints: number;
  eventPoints: Array<number | null>;
}

export interface SeasonStandingsResponse {
  series: SeriesSummary;
  season: SeasonSummary;
  events: Array<{
    slug: string;
    roundNumber: number;
    nameEn: string;
    nameRu: string;
    status: EventStatus;
  }>;
  standings: StandingRow[];
  source: DataSource | null;
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
  nameRu: string | null;
  country: string | null;
  number: number | null;
  photoUrl?: string | null;
  stats?: PilotStats;
}

export interface SeriesCard extends SeriesSummary {
  logoUrl: string | null;
}

export interface HomeChampionshipCard {
  series: SeriesCard;
  seasonYear: number;
  leader: PilotSummary | null;
  leaderPoints: number | null;
  standingsPath: string;
}

export interface HomeSuperPodiumEntry {
  pilot: PilotSummary;
  series: SeriesCard;
  seasonYear: number;
  totalPoints: number;
  standingsPath: string;
}

export interface HomeQualWinner {
  pilot: PilotSummary;
  series: SeriesCard;
  event: {
    slug: string;
    roundNumber: number;
    nameEn: string;
    nameRu: string;
  };
  qualScore: number | null;
  gapToSecond: number | null;
}

export interface HomeCalendarEvent {
  seriesSlug: string;
  seriesNameEn: string;
  seriesNameRu: string;
  logoUrl: string | null;
  seasonYear: number;
  eventSlug: string;
  roundNumber: number;
  nameEn: string;
  nameRu: string;
  trackEn: string | null;
  trackRu: string | null;
  startsAt: string;
  status: EventStatus;
  standingsPath: string;
}

export interface HomeP4PEntry {
  rank: number;
  score: number;
  pilot: PilotSummary;
  bestSeries: {
    slug: string;
    nameEn: string;
    nameRu: string;
    /** Raw series Hardness used in P4P. */
    weight: number;
    /** Mean event place in the season (1 decimal). */
    place: number;
    avgQualScore: number | null;
  };
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
  nameEn: string;
  nameRu: string;
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
  superPodium: HomeSuperPodiumEntry[];
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
  seriesNameEn: string;
  seriesNameRu: string;
  photoUrl: string;
}

export interface PilotListEntry {
  rank: number | null;
  score: number | null;
  pilot: PilotSummary;
  bestSeries: {
    slug: string;
    nameEn: string;
    nameRu: string;
    weight: number;
    place: number;
    avgQualScore: number | null;
  } | null;
}

export interface PilotsListResponse {
  year: number;
  pilots: PilotListEntry[];
}

export interface PilotProfileResponse extends PilotSummary {
  photos: PilotSeriesPhoto[];
  stats: PilotStats;
  results: Array<{
    seriesSlug: string;
    seriesNameEn: string;
    seriesNameRu: string;
    seasonYear: number;
    eventSlug: string;
    eventNameEn: string;
    eventNameRu: string;
    roundNumber: number;
    qualPosition: number | null;
    qualPoints: number | null;
    eventPlace: number | null;
    tandemBattles: number | null;
    tandemWins: number | null;
    points: number;
    source: DataSource | null;
  }>;
}
