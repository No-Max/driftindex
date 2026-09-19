/** Series prefixes historically baked into Pilot.slug. Event slugs like dm-r1 stay untouched. */
export const SERIES_PILOT_SLUG_PREFIXES = ['dm-', 'fd-', 'dk-', 'd1-', 'da-'] as const;

export function stripSeriesPilotSlugPrefix(slug: string): string {
  const value = slug.trim();
  for (const prefix of SERIES_PILOT_SLUG_PREFIXES) {
    if (!value.startsWith(prefix)) continue;
    const rest = value.slice(prefix.length);
    if (!rest || /^r\d+$/i.test(rest) || /^\d+$/.test(rest)) return value;
    return rest;
  }
  return value;
}

export function seriesPilotSlugPrefix(slug: string): string | null {
  const stripped = stripSeriesPilotSlugPrefix(slug);
  if (stripped === slug) return null;
  for (const prefix of SERIES_PILOT_SLUG_PREFIXES) {
    if (slug.startsWith(prefix)) return prefix;
  }
  return null;
}

/** Exact slug, unprefixed form, then each historical series-prefixed form. */
export function pilotSlugLookupCandidates(slug: string): string[] {
  const stripped = stripSeriesPilotSlugPrefix(slug);
  return [...new Set([slug, stripped, ...SERIES_PILOT_SLUG_PREFIXES.map((prefix) => `${prefix}${stripped}`)])];
}

export function lookupByPilotSlug<T>(
  map: Record<string, T> | Partial<Record<string, T>>,
  slug: string,
): T | undefined {
  for (const candidate of pilotSlugLookupCandidates(slug)) {
    const value = map[candidate];
    if (value !== undefined) return value as T;
  }
  return undefined;
}
