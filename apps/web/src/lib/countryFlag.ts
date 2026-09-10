const FLAGCDN_OVERRIDES: Record<string, string> = {
  EU: 'eu',
  INT: 'un',
};

export function countryFlagSrc(country: string, width = 40): string | null {
  const code = country.trim().toUpperCase();
  const slug = FLAGCDN_OVERRIDES[code] ?? code.toLowerCase();
  if (!/^[a-z]{2}$/.test(slug)) return null;
  return `https://flagcdn.com/w${width}/${slug}.png`;
}

export function countryFlagEmoji(country: string): string | null {
  const code = country.trim().toUpperCase();
  if (code === 'EU') return '🇪🇺';
  if (code === 'INT') return '🌍';
  if (!/^[A-Z]{2}$/.test(code)) return null;

  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + code.charCodeAt(0) - 65,
    base + code.charCodeAt(1) - 65,
  );
}
