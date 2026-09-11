import type { Pilot } from '@prisma/client';
import { averageQualScore100 } from './qualScore.js';

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
    qualScore100: number | null;
    tandemPosition: number | null;
    pilot: Pilot;
  }>;
}

export interface SeasonP4PMetricsRow {
  pilot: Pilot;
  avgPlace: number;
  avgQualScore: number | null;
  eventCount: number;
}

export function eventResultPlace(result: {
  tandemPosition: number | null;
  qualPosition: number | null;
}): number | null {
  const place = result.tandemPosition ?? result.qualPosition;
  if (place == null || place < 1) return null;
  return place;
}

/** Season metrics for P4P: mean event place and mean qual score (0–100). */
export function computeSeasonP4PMetrics(events: SeasonEventWithResults[]): SeasonP4PMetricsRow[] {
  const finishedEvents = events.filter((event) => event.status === 'FINISHED');
  const buckets = new Map<
    string,
    { pilot: Pilot; placeSum: number; eventCount: number; qualScores: number[] }
  >();

  for (const event of finishedEvents) {
    for (const result of event.results) {
      const place = eventResultPlace(result);
      if (place == null) continue;

      const bucket = buckets.get(result.pilotId) ?? {
        pilot: result.pilot,
        placeSum: 0,
        eventCount: 0,
        qualScores: [],
      };
      bucket.placeSum += place;
      bucket.eventCount += 1;
      if (result.qualScore100 != null) {
        bucket.qualScores.push(result.qualScore100);
      }
      buckets.set(result.pilotId, bucket);
    }
  }

  return [...buckets.values()].map((bucket) => ({
    pilot: bucket.pilot,
    avgPlace: Math.round((bucket.placeSum / bucket.eventCount) * 10) / 10,
    avgQualScore: averageQualScore100(bucket.qualScores),
    eventCount: bucket.eventCount,
  }));
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
