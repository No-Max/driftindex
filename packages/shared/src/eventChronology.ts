export interface EventChronologyFields {
  startsAt: string | null;
  seasonYear: number;
  roundNumber: number;
  seriesSlug?: string;
  eventSlug?: string;
}

/** Best-effort calendar timestamp for sorting results (handles bad import dates). */
export function eventChronologyTimestamp(result: EventChronologyFields): number {
  if (result.startsAt) {
    const date = new Date(result.startsAt);
    const time = date.getTime();
    if (Number.isFinite(time)) {
      const dateYear = date.getUTCFullYear();
      if (Math.abs(dateYear - result.seasonYear) <= 1) {
        return time;
      }
    }
  }

  const month = Math.min(11, Math.max(0, result.roundNumber - 1));
  return Date.UTC(result.seasonYear, month, 15, 12);
}

export function compareEventResultsChronologically(
  a: EventChronologyFields,
  b: EventChronologyFields,
): number {
  const timeDiff = eventChronologyTimestamp(b) - eventChronologyTimestamp(a);
  if (timeDiff !== 0) return timeDiff;
  if (b.seasonYear !== a.seasonYear) return b.seasonYear - a.seasonYear;
  if (b.roundNumber !== a.roundNumber) return b.roundNumber - a.roundNumber;
  const seriesDiff = (a.seriesSlug ?? '').localeCompare(b.seriesSlug ?? '');
  if (seriesDiff !== 0) return seriesDiff;
  return (a.eventSlug ?? '').localeCompare(b.eventSlug ?? '');
}
