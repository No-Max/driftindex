import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import PilotView from '../views/PilotView.vue';
import PilotsView from '../views/PilotsView.vue';
import SeriesDetailView from '../views/SeriesDetailView.vue';
import SeriesView from '../views/SeriesView.vue';
import StandingsView from '../views/StandingsView.vue';
import TrackView from '../views/TrackView.vue';
import TracksView from '../views/TracksView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/series/:slug/:year',
      name: 'standings',
      component: StandingsView,
    },
    {
      path: '/series/:slug',
      name: 'series-detail',
      component: SeriesDetailView,
    },
    { path: '/series', name: 'series', component: SeriesView },
    { path: '/tracks', name: 'tracks', component: TracksView },
    { path: '/tracks/:slug', name: 'track', component: TrackView },
    { path: '/pilots', name: 'pilots', component: PilotsView },
    { path: '/pilots/:slug', name: 'pilot', component: PilotView },
  ],
});
