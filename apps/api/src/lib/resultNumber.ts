/** Car number for display: prefer per-event value, fall back to legacy Pilot.number. */
export function resultDisplayNumber(result: {
  number: number | null;
  pilot?: { number: number | null } | null;
}): number | null {
  return result.number ?? result.pilot?.number ?? null;
}

/** Season standings number: latest finished round, then any round in the season. */
export function seasonStandingNumber(
  results: Array<{
    number: number | null;
    pilot?: { number: number | null } | null;
    event: { roundNumber: number; status: string };
  }>,
): number | null {
  const sorted = [...results].sort((a, b) => b.event.roundNumber - a.event.roundNumber);
  for (const result of sorted) {
    if (result.event.status !== 'FINISHED') continue;
    const number = resultDisplayNumber(result);
    if (number != null) return number;
  }
  for (const result of sorted) {
    const number = resultDisplayNumber(result);
    if (number != null) return number;
  }
  return null;
}
