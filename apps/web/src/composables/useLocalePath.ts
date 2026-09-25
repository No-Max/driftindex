import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  type AppLocale,
  isAppLocale,
  LOCALE_STORAGE_KEY,
  switchLocaleInPath,
  withLocalePrefix,
} from '../i18n/locales';

export function useLocalePath() {
  const { locale } = useI18n();
  const route = useRoute();
  const router = useRouter();

  function currentLocale(): AppLocale {
    const fromRoute = route.params.locale;
    if (typeof fromRoute === 'string' && isAppLocale(fromRoute)) return fromRoute;
    return isAppLocale(locale.value) ? locale.value : 'en';
  }

  function localePath(path: string, loc: AppLocale = currentLocale()): string {
    return withLocalePrefix(path, loc);
  }

  function switchLocale(next: AppLocale) {
    locale.value = next;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    document.documentElement.lang = next;
    return router.push(switchLocaleInPath(route.fullPath, next));
  }

  return { localePath, switchLocale, currentLocale };
}
