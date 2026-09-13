<script setup lang="ts">
import type { SeasonStandingsResponse } from '@drift-index/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { fetchStandings } from '../api/client';

const route = useRoute();
const { t, locale } = useI18n();

const data = ref<SeasonStandingsResponse | null>(null);
const loading = ref(true);
const error = ref(false);

const slug = computed(() => String(route.params.slug));
const year = computed(() => Number(route.params.year));

const seriesTitle = computed(() => {
  if (!data.value) return '';
  return locale.value === 'ru' ? data.value.series.nameRu : data.value.series.nameEn;
});

const sourceLabel = computed(() => {
  if (!data.value?.source) return '';
  return locale.value === 'ru' ? data.value.source.labelRu : data.value.source.labelEn;
});

async function load() {
  loading.value = true;
  error.value = false;
  try {
    data.value = await fetchStandings(slug.value, year.value);
  } catch {
    error.value = true;
    data.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => route.fullPath, load);

function pilotName(row: SeasonStandingsResponse['standings'][0]) {
  return `${row.firstName} ${row.lastName}`;
}

function eventLabel(index: number) {
  return t('standings.round', { n: data.value?.events[index]?.roundNumber ?? index + 1 });
}
</script>

<template>
  <section>
    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <template v-else-if="data">
      <div class="hero">
        <div>
          <h1 class="page-title">{{ seriesTitle }}</h1>
          <p class="page-subtitle">
            {{ data.season.year }} ·
            {{ t('standings.eventsProgress', { finished: data.season.finishedEventCount, total: data.season.eventCount }) }}
          </p>
        </div>
        <p v-if="data.source" class="source-meta">
          {{ t('standings.source') }}:
          <a
            v-if="data.source.url"
            :href="data.source.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ sourceLabel }}
          </a>
          <span v-else>{{ sourceLabel }}</span>
        </p>
      </div>

      <div class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('standings.rank') }}</th>
              <th>{{ t('standings.pilot') }}</th>
              <th v-for="(_, index) in data.events" :key="data.events[index].slug">
                {{ eventLabel(index) }}
              </th>
              <th>{{ t('standings.total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.standings" :key="row.pilotSlug">
              <td class="rank">{{ row.rank }}</td>
              <td>
                <RouterLink class="pilot-link" :to="`/pilots/${row.pilotSlug}`">
                  <span v-if="row.number" class="muted">#{{ row.number }} · </span>
                  {{ pilotName(row) }}
                </RouterLink>
              </td>
              <td v-for="(points, index) in row.eventPoints" :key="index" class="muted">
                {{ points ?? '—' }}
              </td>
              <td><strong>{{ row.totalPoints }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.source-meta {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  text-align: right;
}

.source-meta a {
  color: var(--accent);
}

.source-meta a:hover {
  text-decoration: underline;
}
</style>
