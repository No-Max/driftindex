/** Known native qualifying score ceilings per series slug. */
const SERIES_QUAL_MAX: Record<string, number> = {
  'royal-ds': 100,
  'formula-drift-pro': 100,
  'drift-masters': 100,
  'd1gp': 100,
  'rds-gp': 100,
  'drift-kings': 100,
};

/** Convert a series-native qualifying score to Drift Index 0–100 scale. */
export function toQualScore100(raw: number | null | undefined, seriesSlug: string): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;

  const maxScore = SERIES_QUAL_MAX[seriesSlug] ?? 100;
  const normalized = maxScore === 100 ? raw : (raw / maxScore) * 100;
  const clamped = Math.min(100, Math.max(0, normalized));
  return Math.round(clamped * 10) / 10;
}

export function averageQualScore100(scores: Array<number | null | undefined>): number | null {
  const values = scores.filter((value): value is number => value != null && Number.isFinite(value));
  if (values.length === 0) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}
