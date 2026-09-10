import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import PilotView from '../views/PilotView.vue';
import PilotsView from '../views/PilotsView.vue';
import StandingsView from '../views/StandingsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/series/:slug/:year',
      name: 'standings',
      component: StandingsView,
    },
    { path: '/pilots', name: 'pilots', component: PilotsView },
    { path: '/pilots/:slug', name: 'pilot', component: PilotView },
  ],
});
