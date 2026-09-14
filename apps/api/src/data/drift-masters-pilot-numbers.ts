import type { DmPilot } from '../importers/drift-masters.js';

/** Start numbers missing from archived standings (guests, wildcards). Keyed by pilot slug. */
export const DM_ARCHIVE_PILOT_NUMBERS: Record<number, Record<string, number>> = {
  2019: {
    'dm-georgy-chivchyan': 93,
  },
};

export function applyArchivePilotNumbers(seasonYear: number, pilots: DmPilot[]): void {
  const overrides = DM_ARCHIVE_PILOT_NUMBERS[seasonYear];
  if (!overrides) return;

  for (const pilot of pilots) {
    const number = overrides[pilot.slug];
    if (number != null && pilot.number == null) {
      pilot.number = number;
    }
  }
}
