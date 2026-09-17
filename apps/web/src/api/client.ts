import type {
  HomeResponse,
  PilotProfileResponse,
  PilotsListResponse,
  SeasonEventResponse,
  SeasonStandingsResponse,
  SeriesPrestigeResponse,
  SeriesProfileResponse,
  TrackProfileResponse,
  TracksListResponse,
} from '@drift-index/shared';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export interface SeriesListItem {
  slug: string;
  name: string;
  shortName: string | null;
  country: string | null;
  logoUrl: string | null;
  seasons: Array<{
    year: number;
    nameEn: string | null;
    nameRu: string | null;
    eventCount: number;
  }>;
}

export function fetchSeriesList() {
  return getJson<SeriesListItem[]>('/api/series');
}

export function fetchSeriesPrestige(year?: number) {
  const query = year ? `?year=${year}` : '';
  return getJson<SeriesPrestigeResponse>(`/api/series/prestige${query}`);
}

export function fetchTracks() {
  return getJson<TracksListResponse>('/api/tracks');
}

export function fetchTrack(slug: string) {
  return getJson<TrackProfileResponse>(`/api/tracks/${slug}`);
}

export function fetchSeriesProfile(slug: string) {
  return getJson<SeriesProfileResponse>(`/api/series/${slug}`);
}

export function fetchStandings(slug: string, year: number) {
  return getJson<SeasonStandingsResponse>(`/api/series/${slug}/seasons/${year}/standings`);
}

export function fetchSeasonEvent(slug: string, year: number, eventSlug: string) {
  return getJson<SeasonEventResponse>(
    `/api/series/${slug}/seasons/${year}/events/${eventSlug}`,
  );
}

export function fetchPilots(options?: {
  year?: number;
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (options?.year != null) params.set('year', String(options.year));
  if (options?.page != null) params.set('page', String(options.page));
  if (options?.pageSize != null) params.set('pageSize', String(options.pageSize));
  const q = options?.q?.trim();
  if (q) params.set('q', q);
  const query = params.toString();
  return getJson<PilotsListResponse>(`/api/pilots${query ? `?${query}` : ''}`);
}

export function fetchPilot(slug: string) {
  return getJson<PilotProfileResponse>(`/api/pilots/${slug}`);
}

export function fetchHome(year?: number) {
  const query = year ? `?year=${year}` : '';
  return getJson<HomeResponse>(`/api/home${query}`);
}
