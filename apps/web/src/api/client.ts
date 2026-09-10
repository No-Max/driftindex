import type {
  HomeResponse,
  PilotProfileResponse,
  PilotsListResponse,
  SeasonStandingsResponse,
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
  nameEn: string;
  nameRu: string;
  country: string | null;
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

export function fetchStandings(slug: string, year: number) {
  return getJson<SeasonStandingsResponse>(`/api/series/${slug}/seasons/${year}/standings`);
}

export function fetchPilots(year?: number) {
  const query = year ? `?year=${year}` : '';
  return getJson<PilotsListResponse>(`/api/pilots${query}`);
}

export function fetchPilot(slug: string) {
  return getJson<PilotProfileResponse>(`/api/pilots/${slug}`);
}

export function fetchHome(year?: number) {
  const query = year ? `?year=${year}` : '';
  return getJson<HomeResponse>(`/api/home${query}`);
}
