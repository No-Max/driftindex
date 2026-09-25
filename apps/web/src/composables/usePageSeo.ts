import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import {
  APP_LOCALES,
  type AppLocale,
  DEFAULT_LOCALE,
  isAppLocale,
  SITE_ORIGIN,
  stripLocalePrefix,
  withLocalePrefix,
} from '../i18n/locales';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    if (hreflang) el.hreflang = hreflang;
    document.head.appendChild(el);
  }
  el.href = href;
}

function removeStaleHreflang() {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
}

export function usePageSeo() {
  const { t, te, locale } = useI18n();
  const route = useRoute();

  function apply() {
    const loc: AppLocale =
      typeof route.params.locale === 'string' && isAppLocale(route.params.locale)
        ? route.params.locale
        : isAppLocale(locale.value)
          ? locale.value
          : DEFAULT_LOCALE;

    const seoKey = typeof route.meta.seoKey === 'string' ? route.meta.seoKey : 'default';
    const titleKey = `seo.${seoKey}.title`;
    const descKey = `seo.${seoKey}.description`;
    const title = te(titleKey) ? t(titleKey) : t('seo.default.title');
    const description = te(descKey) ? t(descKey) : t('seo.default.description');

    const barePath = stripLocalePrefix(route.path);
    const canonicalPath = withLocalePrefix(barePath, loc);
    const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;

    document.title = title;
    document.documentElement.lang = loc;

    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', t('seo.siteName'));
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:locale', loc === 'ru' ? 'ru_RU' : 'en_US');
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);

    upsertLink('canonical', canonicalUrl);

    removeStaleHreflang();
    for (const alt of APP_LOCALES) {
      upsertLink('alternate', `${SITE_ORIGIN}${withLocalePrefix(barePath, alt)}`, alt);
    }
    upsertLink(
      'alternate',
      `${SITE_ORIGIN}${withLocalePrefix(barePath, DEFAULT_LOCALE)}`,
      'x-default',
    );
  }

  watch(() => [route.fullPath, locale.value], apply, { immediate: true });
}
