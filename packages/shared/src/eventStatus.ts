export type DbEventStatus = 'SCHEDULED' | 'FINISHED' | 'CANCELLED';

/** Public/API status: past SCHEDULED events without results surface as WAITING_RESULTS. */
export type EventStatus = DbEventStatus | 'WAITING_RESULTS';

/**
 * Map stored event status for display/API.
 * SCHEDULED + startsAt in the past → WAITING_RESULTS (results not imported yet).
 */
export function resolvePublicEventStatus(
  status: DbEventStatus | EventStatus,
  startsAt: Date | string | null | undefined,
  now: Date | number = Date.now(),
): EventStatus {
  if (status === 'FINISHED' || status === 'CANCELLED') return status;
  if (status === 'WAITING_RESULTS') return 'WAITING_RESULTS';

  if (startsAt == null || startsAt === '') return 'SCHEDULED';

  const startMs = startsAt instanceof Date ? startsAt.getTime() : Date.parse(String(startsAt));
  if (!Number.isFinite(startMs)) return 'SCHEDULED';

  const nowMs = typeof now === 'number' ? now : now.getTime();
  return startMs < nowMs ? 'WAITING_RESULTS' : 'SCHEDULED';
}
