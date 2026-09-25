import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import PilotView from '../views/PilotView.vue';
import PilotsView from '../views/PilotsView.vue';
import EventView from '../views/EventView.vue';
import SeriesDetailView from '../views/SeriesDetailView.vue';
import SeriesView from '../views/SeriesView.vue';
import StandingsView from '../views/StandingsView.vue';
import TrackView from '../views/TrackView.vue';
import TracksView from '../views/TracksView.vue';
import { i18n } from '../i18n';
import {
  type AppLocale,
  detectPreferredLocale,
  isAppLocale,
  LOCALE_STORAGE_KEY,
  withLocalePrefix,
} from '../i18n/locales';

const localeParam = ':locale(en|ru)';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: `/${localeParam}`,
      name: 'home',
      component: HomeView,
      meta: { seoKey: 'home' },
    },
    {
      path: `/${localeParam}/series/:slug/:year/:eventSlug`,
      name: 'event',
      component: EventView,
      meta: { seoKey: 'default' },
    },
    {
      path: `/${localeParam}/series/:slug/:year`,
      name: 'standings',
      component: StandingsView,
      meta: { seoKey: 'default' },
    },
    {
      path: `/${localeParam}/series/:slug`,
      name: 'series-detail',
      component: SeriesDetailView,
      meta: { seoKey: 'default' },
    },
    {
      path: `/${localeParam}/series`,
      name: 'series',
      component: SeriesView,
      meta: { seoKey: 'series' },
    },
    {
      path: `/${localeParam}/tracks`,
      name: 'tracks',
      component: TracksView,
      meta: { seoKey: 'tracks' },
    },
    {
      path: `/${localeParam}/tracks/:slug`,
      name: 'track',
      component: TrackView,
      meta: { seoKey: 'default' },
    },
    {
      path: `/${localeParam}/pilots`,
      name: 'pilots',
      component: PilotsView,
      meta: { seoKey: 'pilots' },
    },
    {
      path: `/${localeParam}/pilots/:slug`,
      name: 'pilot',
      component: PilotView,
      meta: { seoKey: 'default' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: (to) => {
        const segments = to.path.split('/').filter(Boolean);
        if (segments[0] && isAppLocale(segments[0])) {
          return withLocalePrefix('/', segments[0]);
        }
        const preferred = detectPreferredLocale();
        const bare = to.path === '/' ? '/' : to.path;
        return {
          path: withLocalePrefix(bare, preferred),
          query: to.query,
          hash: to.hash,
        };
      },
    },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  const raw = to.params.locale;
  if (typeof raw !== 'string' || !isAppLocale(raw)) return;

  const next = raw as AppLocale;
  i18n.global.locale.value = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // ignore
  }
});
