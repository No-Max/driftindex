import type { Pilot } from '@prisma/client';

export interface SeasonEventWithResults {
  id: string;
  slug: string;
  roundNumber: number;
  nameEn: string;
  nameRu: string;
  status: string;
  startsAt: Date | null;
  trackEn: string | null;
  trackRu: string | null;
  results: Array<{
    pilotId: string;
    points: number;
    qualPosition: number | null;
    qualPoints: number | null;
    pilot: Pilot;
  }>;
}

export interface ComputedStandingRow {
  rank: number;
  pilot: Pilot;
  totalPoints: number;
  eventPoints: Array<number | null>;
}

export function computeStandings(events: SeasonEventWithResults[]): ComputedStandingRow[] {
  const finishedEvents = events.filter((e) => e.status === 'FINISHED');
  const pointsByPilot = new Map<string, { pilot: Pilot; byEvent: Map<string, number>; total: number }>();

  for (const event of finishedEvents) {
    for (const result of event.results) {
      const entry = pointsByPilot.get(result.pilotId) ?? {
        pilot: result.pilot,
        byEvent: new Map<string, number>(),
        total: 0,
      };
      entry.byEvent.set(event.id, result.points);
      entry.total += result.points;
      pointsByPilot.set(result.pilotId, entry);
    }
  }

  return [...pointsByPilot.values()]
    .sort((a, b) => b.total - a.total || a.pilot.lastName.localeCompare(b.pilot.lastName))
    .map((row, index) => ({
      rank: index + 1,
      pilot: row.pilot,
      totalPoints: row.total,
      eventPoints: finishedEvents.map((event) => row.byEvent.get(event.id) ?? null),
    }));
}
