import type { SeasonEventWithSeries } from './p4pSeasonEvents.js';
import { eventResultPlace } from './standings.js';

/** Trophy bonuses subtracted from raw P4P (summed across all featured series). */
export const P4P_TROPHY_GOLD = 0.3;
export const P4P_TROPHY_SILVER = 0.2;
export const P4P_TROPHY_BRONZE = 0.1;
export const P4P_TROPHY_QUAL_WIN = 0.2;

export type P4PTrophyCounts = {
  gold: number;
  silver: number;
  bronze: number;
  qual: number;
};

export function emptyP4PTrophyCounts(): P4PTrophyCounts {
  return { gold: 0, silver: 0, bronze: 0, qual: 0 };
}

export function p4pTrophyBonusFromCounts(counts: P4PTrophyCounts): number {
  return (
    counts.gold * P4P_TROPHY_GOLD +
    counts.silver * P4P_TROPHY_SILVER +
    counts.bronze * P4P_TROPHY_BRONZE +
    counts.qual * P4P_TROPHY_QUAL_WIN
  );
}

/**
 * Sum podium + qual-win bonuses for every pilot across all loaded featured-series events.
 * Applied once to raw P4P after best-series selection (not when choosing best series).
 */
export function computeP4PTrophyBonusByPilotId(
  events: readonly SeasonEventWithSeries[],
  pointsPlaceByEventId: Map<string, Map<string, number>>,
): Map<string, number> {
  const countsByPilot = new Map<string, P4PTrophyCounts>();

  for (const event of events) {
    if (event.status !== 'FINISHED') continue;
    const places = pointsPlaceByEventId.get(event.id);

    for (const result of event.results) {
      const place = eventResultPlace({
        pointsPlace: places?.get(result.pilotId) ?? null,
        tandemPosition: result.tandemPosition,
        qualPosition: result.qualPosition,
      });

      let counts = countsByPilot.get(result.pilotId);
      if (!counts) {
        counts = emptyP4PTrophyCounts();
        countsByPilot.set(result.pilotId, counts);
      }

      if (place === 1) counts.gold += 1;
      else if (place === 2) counts.silver += 1;
      else if (place === 3) counts.bronze += 1;
      if (result.qualPosition === 1) counts.qual += 1;
    }
  }

  const bonusByPilot = new Map<string, number>();
  for (const [pilotId, counts] of countsByPilot) {
    const bonus = p4pTrophyBonusFromCounts(counts);
    if (bonus > 0) bonusByPilot.set(pilotId, bonus);
  }
  return bonusByPilot;
}
