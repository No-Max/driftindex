<script setup lang="ts">
import type { HomeResponse, PollDetail } from '@drift-index/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchHome, fetchPolls } from '../api/client';
import ChampionshipSlider from '../components/home/ChampionshipSlider.vue';
import FanVoteResults from '../components/home/FanVoteResults.vue';
import P4PPodium from '../components/home/P4PPodium.vue';
import QualWinners from '../components/home/QualWinners.vue';
import SectionHeading from '../components/home/SectionHeading.vue';
import Top3Series from '../components/home/Top3Series.vue';
import YearCalendar from '../components/home/YearCalendar.vue';

const { t } = useI18n();
const data = ref<HomeResponse | null>(null);
const pilotsPoll = ref<PollDetail | null>(null);
const seriesPoll = ref<PollDetail | null>(null);
const loading = ref(true);
const error = ref(false);

const heroTitle = computed(() => {
  if (data.value) return t('home.sections.p4p', { year: data.value.year });
  return t('home.title');
});

const heroSubtitle = computed(() => {
  if (data.value) return t('home.sections.p4pSub');
  return t('home.subtitle');
});

const hasFanVotes = computed(() => Boolean(pilotsPoll.value || seriesPoll.value));

onMounted(async () => {
  try {
    const [home, pollsPayload] = await Promise.all([
      fetchHome(2026),
      fetchPolls().catch(() => ({ polls: [] as PollDetail[] })),
    ]);
    data.value = home;
    pilotsPoll.value = pollsPayload.polls.find((poll) => poll.type === 'PILOTS') ?? null;
    seriesPoll.value = pollsPayload.polls.find((poll) => poll.type === 'SERIES') ?? null;
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
      <h1 class="page-title">{{ heroTitle }}</h1>
      <p class="page-subtitle">{{ heroSubtitle }}</p>
    </section>

    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <template v-else-if="data">
      <section class="home-section home-section--p4p">
        <P4PPodium :items="data.poundForPound" :year="data.year" />
      </section>

      <section v-if="hasFanVotes" class="home-section">
        <SectionHeading
          :title="t('home.sections.fanVotes')"
          :subtitle="t('home.sections.fanVotesSub')"
        />
        <FanVoteResults :pilots-poll="pilotsPoll" :series-poll="seriesPoll" />
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
    </template>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: 2.5rem;
}

.hero {
  margin-bottom: 0;
}

@media (max-width: 420px) {
  .hero .page-title {
    font-size: 1.75rem;
  }
}

.home-section {
  display: grid;
}

.home-section--p4p {
  margin-top: -1.25rem;
}
</style>
