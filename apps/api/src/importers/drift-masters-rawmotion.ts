const RAWMOTION_BASE = 'https://live.rawmotion.com/api/v1';

/** RawMotion event IDs for seasons where dm.gp omits qualifying data. */
export const RAWMOTION_DM_EVENT_IDS: Record<number, string> = {
  2019: '0c7108a1-8da7-11e9-909b-f171dc59e2a3',
  2020: 'a50a8291-dbe3-11ea-9f2a-4501e44f4496',
  2021: 'be93e8f1-df34-11eb-9b03-a1996b56ef47',
  2022: '9d5cb870-caba-11ec-9b6a-07912c2ae072',
  2024: 'f8488bd1-0eb8-11ef-8e9f-db3243ea316e',
  2025: '6fa30551-2d00-11f0-9310-b544412bc579',
  2026: '24217941-4497-11f1-9a48-e5b2f4f9b363',
};

export async function fetchRawMotionJson<T>(path: string): Promise<T> {
  const response = await fetch(`${RAWMOTION_BASE}${path}`, {
    headers: { accept: 'application/json', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${RAWMOTION_BASE}${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchRawMotionContestRounds(
  eventId: string,
  contestNumber: number,
): Promise<unknown[]> {
  return fetchRawMotionJson<unknown[]>(`/event/${eventId}/contest/${contestNumber}/rounds`);
}
