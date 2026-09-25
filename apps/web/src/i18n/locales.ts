export const APP_LOCALES = ['en', 'ru'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

export const LOCALE_STORAGE_KEY = 'di_locale';

export const SITE_ORIGIN =
  (import.meta.env.VITE_SITE_ORIGIN as string | undefined)?.replace(/\/$/, '') ??
  'https://driftindex.pro';

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

export function detectPreferredLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isAppLocale(stored)) return stored;
  } catch {
    // ignore (SSR / private mode)
  }

  if (typeof navigator !== 'undefined') {
    const lang = navigator.language?.toLowerCase() ?? '';
    if (lang.startsWith('ru')) return 'ru';
  }

  return DEFAULT_LOCALE;
}

/** Strip a leading /en or /ru segment from a path. */
export function stripLocalePrefix(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const match = normalized.match(/^\/(en|ru)(?=\/|$)/);
  if (!match) return normalized === '' ? '/' : normalized;
  const rest = normalized.slice(match[0].length);
  return rest.length === 0 ? '/' : rest;
}

/** Prefix an app path with a locale. Paths from the API stay locale-free. */
export function withLocalePrefix(path: string, locale: AppLocale): string {
  const bare = stripLocalePrefix(path);
  if (bare === '/') return `/${locale}`;
  return `/${locale}${bare.startsWith('/') ? bare : `/${bare}`}`;
}

/** Swap the locale segment of a full path (keeps query/hash if present in path only). */
export function switchLocaleInPath(fullPath: string, next: AppLocale): string {
  const qIndex = fullPath.indexOf('?');
  const hIndex = fullPath.indexOf('#');
  let pathEnd = fullPath.length;
  if (qIndex >= 0) pathEnd = Math.min(pathEnd, qIndex);
  if (hIndex >= 0) pathEnd = Math.min(pathEnd, hIndex);

  const path = fullPath.slice(0, pathEnd);
  const suffix = fullPath.slice(pathEnd);
  return `${withLocalePrefix(path, next)}${suffix}`;
}
