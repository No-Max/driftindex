const CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
};

/** Localised full country name from ISO 3166-1 alpha-2 (falls back to the raw value). */
export function formatCountryName(country: string, locale: string): string {
  const raw = country.trim();
  if (!raw) return raw;

  const upper = raw.toUpperCase();
  const code = CODE_ALIASES[upper] ?? upper;
  if (!/^[A-Z]{2}$/.test(code)) return raw;

  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? raw;
  } catch {
    return raw;
  }
}
