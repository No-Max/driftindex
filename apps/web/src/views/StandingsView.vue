<script setup lang="ts">
import type { SeasonStandingsResponse } from '@drift-index/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { fetchStandings } from '../api/client';
import SeriesLogo from '../components/SeriesLogo.vue';
import { formatPilotName } from '../lib/formatPilotName';
import { formatQualCell } from '../lib/formatQualCell';

const route = useRoute();
const { t, locale } = useI18n();

const data = ref<SeasonStandingsResponse | null>(null);
const loading = ref(true);
const error = ref(false);

const slug = computed(() => String(route.params.slug));
const year = computed(() => Number(route.params.year));

const seriesTitle = computed(() => {
  if (!data.value) return '';
  return data.value.series.name;
});

const sourceLabel = computed(() => {
  if (!data.value?.source) return '';
  return locale.value === 'ru' ? data.value.source.labelRu : data.value.source.labelEn;
});

const showQual = computed(() => (data.value ? hasAnyQualData(data.value.standings) : false));
const teamStandings = computed(() => data.value?.teamStandings ?? []);

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
  return formatPilotName(row);
}

function eventLabel(index: number) {
  return t('standings.round', { n: data.value?.events[index]?.roundNumber ?? index + 1 });
}

function formatQualCellForRow(
  row: SeasonStandingsResponse['standings'][0],
  index: number,
) {
  const qual = row.eventQual[index];
  if (!qual) return '—';
  return formatQualCell(qual.qualScore100, qual.qualPosition, locale.value);
}

function hasAnyQualData(standings: SeasonStandingsResponse['standings']) {
  return standings.some((row) =>
    row.eventQual.some((qual) => qual != null && (qual.qualScore100 != null || qual.qualPosition != null)),
  );
}

function isEventClickable(event: SeasonStandingsResponse['events'][0]) {
  return event.status === 'FINISHED';
}
</script>

<template>
  <section>
    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <template v-else-if="data">
      <div class="hero">
        <div class="hero__head">
          <SeriesLogo
            v-if="data.series"
            :slug="data.series.slug"
            :name="data.series.name"
            :logo-url="data.series.logoUrl"
            :country="data.series.country"
            size="xl"
          />
          <div>
          <RouterLink :to="`/series/${slug}`" class="back-link">← {{ t('seriesDetail.backToSeries') }}</RouterLink>
          <h1 class="page-title">{{ seriesTitle }}</h1>
          <p class="page-subtitle">
            {{ data.season.year }} ·
            {{ t('standings.eventsProgress', { finished: data.season.finishedEventCount, total: data.season.eventCount }) }}
          </p>
          </div>
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
              <th v-for="(event, index) in data.events" :key="event.slug" class="round-col">
                <RouterLink
                  v-if="isEventClickable(event)"
                  :to="event.eventPath"
                  class="round-link"
                >
                  {{ eventLabel(index) }}
                </RouterLink>
                <span v-else>{{ eventLabel(index) }}</span>
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
              <td v-for="(points, index) in row.eventPoints" :key="index" class="event-cell">
                <RouterLink
                  v-if="isEventClickable(data.events[index])"
                  :to="data.events[index].eventPath"
                  class="event-cell-link"
                >
                  <span class="event-cell__points">{{ points ?? '—' }}</span>
                  <span v-if="showQual" class="event-cell__qual muted">
                    {{ formatQualCellForRow(row, index) }}
                  </span>
                </RouterLink>
                <template v-else>
                  <span class="event-cell__points">{{ points ?? '—' }}</span>
                  <span v-if="showQual" class="event-cell__qual muted">
                    {{ formatQualCellForRow(row, index) }}
                  </span>
                </template>
              </td>
              <td><strong>{{ row.totalPoints }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <template v-if="teamStandings.length > 0">
        <h2 class="section-title">{{ t('standings.teamsTitle') }}</h2>
        <div class="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t('standings.rank') }}</th>
                <th>{{ t('standings.team') }}</th>
                <th v-for="(event, index) in data.events" :key="`team-${event.slug}`" class="round-col">
                  <RouterLink
                    v-if="isEventClickable(event)"
                    :to="event.eventPath"
                    class="round-link"
                  >
                    {{ eventLabel(index) }}
                  </RouterLink>
                  <span v-else>{{ eventLabel(index) }}</span>
                </th>
                <th>{{ t('standings.total') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in teamStandings" :key="row.teamName">
                <td class="rank">{{ row.rank }}</td>
                <td>{{ row.teamName }}</td>
                <td v-for="(points, index) in row.eventPoints" :key="index" class="event-cell">
                  <span class="event-cell__points">{{ points ?? '—' }}</span>
                </td>
                <td><strong>{{ row.totalPoints }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
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

.hero__head {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-link {
  display: inline-block;
  margin-bottom: 0.35rem;
  color: var(--muted);
  font-size: 0.88rem;
}

.back-link:hover {
  color: var(--accent);
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

.event-cell {
  line-height: 1.35;
}

.event-cell__points {
  display: block;
}

.event-cell__qual {
  display: block;
  font-size: 0.78rem;
}

.round-link,
.event-cell-link {
  color: inherit;
  text-decoration: none;
}

.round-link:hover,
.event-cell-link:hover {
  color: var(--accent);
}

.round-link:hover .event-cell__points,
.event-cell-link:hover .event-cell__points {
  text-decoration: underline;
}

.section-title {
  margin: 1.5rem 0 0.75rem;
}
</style>
