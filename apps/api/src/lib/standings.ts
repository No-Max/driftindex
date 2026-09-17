import type { Pilot } from '@prisma/client';
import { averageQualScore100 } from './qualScore.js';
import { seasonStandingNumber } from './resultNumber.js';
import { GRID_REFERENCE } from './stageCoefficient.js';

/** Imputed place for a missed round when averaging over the full season. */
export const MISSED_EVENT_PLACE = GRID_REFERENCE;

/** Default qual score (0–100) for P4P when a pilot has no qualifying data in a season. */
export const DEFAULT_P4P_QUAL_SCORE = 90;

export function computeSeasonAveragePlace(
  placeSum: number,
  participatedEvents: number,
  totalFinishedEvents: number,
): number | null {
  if (totalFinishedEvents <= 0 || participatedEvents <= 0) return null;

  const missed = Math.max(0, totalFinishedEvents - participatedEvents);
  const adjustedSum = placeSum + missed * MISSED_EVENT_PLACE;
  return Math.round((adjustedSum / totalFinishedEvents) * 10) / 10;
}

/** P4P qual: mean qual on attended rounds, or 90 default, minus 1 pt per missed round. */
export function computeSeasonP4PQualScore(
  qualScores: number[],
  participatedEvents: number,
  totalFinishedEvents: number,
): number {
  const missed = Math.max(0, totalFinishedEvents - participatedEvents);
  const avgQualBase =
    qualScores.length > 0
      ? (averageQualScore100(qualScores) ?? DEFAULT_P4P_QUAL_SCORE)
      : DEFAULT_P4P_QUAL_SCORE;
  return Math.max(0, Math.round((avgQualBase - missed) * 10) / 10);
}

export interface SeasonEventWithResults {
  id: string;
  slug: string;
  roundNumber: number;
  name: string;
  status: string;
  startsAt: Date | null;
  results: Array<{
    pilotId: string;
    points: number;
    number: number | null;
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
  /** P4P-adjusted qual: mean qual or 90 default, minus 1 pt per missed round. */
  avgQualScore: number;
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

/** Season metrics for P4P: imputed mean place and adjusted qual score (0–100). */
export function computeSeasonP4PMetrics(events: SeasonEventWithResults[]): SeasonP4PMetricsRow[] {
  const finishedEvents = events.filter((event) => event.status === 'FINISHED');
  const totalEvents = finishedEvents.length;
  if (totalEvents === 0) return [];

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

  const rows: SeasonP4PMetricsRow[] = [];
  for (const bucket of buckets.values()) {
    const avgPlace = computeSeasonAveragePlace(bucket.placeSum, bucket.eventCount, totalEvents);
    if (avgPlace == null) continue;
    rows.push({
      pilot: bucket.pilot,
      avgPlace,
      avgQualScore: computeSeasonP4PQualScore(
        bucket.qualScores,
        bucket.eventCount,
        totalEvents,
      ),
      eventCount: bucket.eventCount,
    });
  }
  return rows;
}

export interface EventQualCell {
  qualPosition: number | null;
  qualScore100: number | null;
}

export interface ComputedStandingRow {
  rank: number;
  pilot: Pilot;
  number: number | null;
  totalPoints: number;
  eventPoints: Array<number | null>;
  eventQual: Array<EventQualCell | null>;
}

export function computeStandings(events: SeasonEventWithResults[]): ComputedStandingRow[] {
  const finishedEvents = events.filter((e) => e.status === 'FINISHED');
  const pointsByPilot = new Map<
    string,
    {
      pilot: Pilot;
      byEvent: Map<string, number>;
      qualByEvent: Map<string, EventQualCell>;
      results: Array<{
        number: number | null;
        pilot: Pilot;
        event: { roundNumber: number; status: string };
      }>;
      total: number;
    }
  >();

  for (const event of finishedEvents) {
    for (const result of event.results) {
      const entry = pointsByPilot.get(result.pilotId) ?? {
        pilot: result.pilot,
        byEvent: new Map<string, number>(),
        qualByEvent: new Map<string, EventQualCell>(),
        results: [],
        total: 0,
      };
      entry.byEvent.set(event.id, result.points);
      entry.qualByEvent.set(event.id, {
        qualPosition: result.qualPosition,
        qualScore100: result.qualScore100,
      });
      entry.results.push({
        number: result.number,
        pilot: result.pilot,
        event: { roundNumber: event.roundNumber, status: event.status },
      });
      entry.total += result.points;
      pointsByPilot.set(result.pilotId, entry);
    }
  }

  return [...pointsByPilot.values()]
    .sort((a, b) => b.total - a.total || a.pilot.lastName.localeCompare(b.pilot.lastName))
    .map((row, index) => ({
      rank: index + 1,
      pilot: row.pilot,
      number: seasonStandingNumber(row.results),
      totalPoints: row.total,
      eventPoints: events.map((event) => row.byEvent.get(event.id) ?? null),
      eventQual: events.map((event) => row.qualByEvent.get(event.id) ?? null),
    }));
}

export interface SeasonEventWithTeamResults {
  id: string;
  status: string;
  teamResults: Array<{
    points: number;
    team: { name: string };
  }>;
}

export interface ComputedTeamStandingRow {
  rank: number;
  teamName: string;
  totalPoints: number;
  eventPoints: Array<number | null>;
}

export function computeTeamStandings(events: SeasonEventWithTeamResults[]): ComputedTeamStandingRow[] {
  const finishedEvents = events.filter((event) => event.status === 'FINISHED');
  const byTeam = new Map<string, { byEvent: Map<string, number>; total: number }>();

  for (const event of finishedEvents) {
    for (const row of event.teamResults) {
      const entry = byTeam.get(row.team.name) ?? { byEvent: new Map<string, number>(), total: 0 };
      entry.byEvent.set(event.id, row.points);
      entry.total += row.points;
      byTeam.set(row.team.name, entry);
    }
  }

  return [...byTeam.entries()]
    .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))
    .map(([teamName, row], index) => ({
      rank: index + 1,
      teamName,
      totalPoints: row.total,
      eventPoints: events.map((event) => row.byEvent.get(event.id) ?? null),
    }));
}
