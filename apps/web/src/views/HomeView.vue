<script setup lang="ts">
import type { HomeResponse } from '@drift-index/shared';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchHome } from '../api/client';
import ChampionshipSlider from '../components/home/ChampionshipSlider.vue';
import FanVoteStubs from '../components/home/FanVoteStubs.vue';
import P4PPodium from '../components/home/P4PPodium.vue';
import QualWinners from '../components/home/QualWinners.vue';
import SectionHeading from '../components/home/SectionHeading.vue';
import Top3Series from '../components/home/Top3Series.vue';
import YearCalendar from '../components/home/YearCalendar.vue';

const { t } = useI18n();
const data = ref<HomeResponse | null>(null);
const loading = ref(true);
const error = ref(false);

onMounted(async () => {
  try {
    data.value = await fetchHome(2026);
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="home">
    <section class="hero">
      <h1 class="page-title">{{ t('home.title') }}</h1>
      <p class="page-subtitle">{{ t('home.subtitle') }}</p>
    </section>

    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <template v-else-if="data">
      <section class="home-section">
        <P4PPodium :items="data.poundForPound" :year="data.year" />
      </section>

      <section v-if="data.seriesPrestige.entries.length > 0" class="home-section">
        <SectionHeading
          :title="t('home.sections.topSeries')"
          :subtitle="t('home.sections.topSeriesSub')"
        />
        <Top3Series
          :prestige="data.seriesPrestige"
          :championships="data.championships"
          :year="data.year"
        />
      </section>

      <section class="home-section">
        <SectionHeading
          :title="t('home.sections.championships')"
          :subtitle="t('home.sections.championshipsSub')"
        />
        <ChampionshipSlider :items="data.championships" />
      </section>

      <section class="home-section">
        <SectionHeading
          :title="t('home.sections.qualWinners')"
          :subtitle="t('home.sections.qualWinnersSub')"
        />
        <QualWinners :items="data.qualWinners" />
      </section>

      <section class="home-section">
        <SectionHeading
          :title="t('home.sections.calendar', { year: data.year })"
          :subtitle="t('home.sections.calendarSub')"
        />
        <YearCalendar :year="data.year" :events="data.calendar" />
      </section>

      <section class="home-section">
        <SectionHeading :title="t('home.sections.fanVotes')" />
        <FanVoteStubs />
      </section>
    </template>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: 2.5rem;
}

.hero {
  margin-bottom: -0.5rem;
}

.home-section {
  display: grid;
}
</style>
