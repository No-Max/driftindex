/** ISO 3166-1 alpha-3 → alpha-2 (Drift Masters API uses alpha-3). */
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  AUT: 'AT',
  CHE: 'CH',
  CHN: 'CN',
  CYP: 'CY',
  CZE: 'CZ',
  DEU: 'DE',
  DNK: 'DK',
  EGY: 'EG',
  ESP: 'ES',
  EST: 'EE',
  FIN: 'FI',
  FRA: 'FR',
  GBR: 'GB',
  HRV: 'HR',
  HUN: 'HU',
  IRL: 'IE',
  ISR: 'IL',
  ITA: 'IT',
  JPN: 'JP',
  LTU: 'LT',
  LVA: 'LV',
  NLD: 'NL',
  NOR: 'NO',
  POL: 'PL',
  PRT: 'PT',
  SAU: 'SA',
  SVK: 'SK',
  SVN: 'SI',
  SWE: 'SE',
  THA: 'TH',
  TUR: 'TR',
  UKR: 'UA',
  USA: 'US',
};

export function alpha3ToAlpha2(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  if (upper.length === 2) return upper;
  if (upper.length === 3) return ALPHA3_TO_ALPHA2[upper] ?? null;
  return null;
}

const COUNTRY_NAME_TO_ALPHA2: Record<string, string> = {
  AUSTRIA: 'AT',
  CROATIA: 'HR',
  'CZECH REPUBLIC': 'CZ',
  ESTONIA: 'EE',
  FINLAND: 'FI',
  FINNISH: 'FI',
  FRANCE: 'FR',
  FRENCH: 'FR',
  GEORGIA: 'GE',
  GERMANY: 'DE',
  HUNGARIAN: 'HU',
  HUNGARY: 'HU',
  IRELAND: 'IE',
  ITALY: 'IT',
  LATVIA: 'LV',
  LATVIAN: 'LV',
  LITHUANIA: 'LT',
  LITHUANIAN: 'LT',
  NORWAY: 'NO',
  POLAND: 'PL',
  POLISH: 'PL',
  ROMANIA: 'RO',
  ROMANIAN: 'RO',
  SWEDEN: 'SE',
  UKRAINE: 'UA',
  'UNITED KINGDOM': 'GB',
};

/** Normalize 2/3-letter codes and English country names from archived HTML. */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-') return null;

  const fromCode = alpha3ToAlpha2(trimmed);
  if (fromCode) return fromCode;

  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) return upper;

  return COUNTRY_NAME_TO_ALPHA2[upper] ?? null;
}
