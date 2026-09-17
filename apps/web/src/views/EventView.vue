<script setup lang="ts">
import type { SeasonEventResponse } from '@drift-index/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { fetchSeasonEvent } from '../api/client';
import SeriesLogo from '../components/SeriesLogo.vue';
import { formatPilotName } from '../lib/formatPilotName';
import { formatQualCell } from '../lib/formatQualCell';

const route = useRoute();
const { t, locale } = useI18n();

const data = ref<SeasonEventResponse | null>(null);
const loading = ref(true);
const error = ref(false);

const slug = computed(() => String(route.params.slug));
const year = computed(() => Number(route.params.year));
const eventSlug = computed(() => String(route.params.eventSlug));

const sourceLabel = computed(() => {
  if (!data.value?.source) return '';
  return locale.value === 'ru' ? data.value.source.labelRu : data.value.source.labelEn;
});

const showQual = computed(() =>
  (data.value?.results ?? []).some(
    (row) => row.qualScore100 != null || row.qualPosition != null,
  ),
);

const showTandem = computed(() =>
  (data.value?.results ?? []).some((row) => row.tandemPosition != null),
);

const showDuels = computed(() =>
  (data.value?.results ?? []).some((row) => row.tandemBattles != null && row.tandemBattles > 0),
);

async function load() {
  loading.value = true;
  error.value = false;
  try {
    data.value = await fetchSeasonEvent(slug.value, year.value, eventSlug.value);
  } catch {
    error.value = true;
    data.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => route.fullPath, load);

function pilotName(row: SeasonEventResponse['results'][0]) {
  return formatPilotName(row);
}

function formatQual(row: SeasonEventResponse['results'][0]) {
  return formatQualCell(row.qualScore100, row.qualPosition, locale.value);
}

function formatDate(iso: string | null): string {
  if (!iso) return t('tracks.noDate');
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

function eventStatusLabel(status: SeasonEventResponse['event']['status']) {
  return t(`home.eventStatus.${status.toLowerCase()}`);
}

function trackLabel(track: SeasonEventResponse['event']['track']) {
  if (!track) return null;
  return track.city ? `${track.name}, ${track.city}` : track.name;
}

function formatTandemBattles(row: SeasonEventResponse['results'][0]) {
  return row.tandemBattles != null && row.tandemBattles > 0 ? row.tandemBattles : '—';
}

function formatTandemWins(row: SeasonEventResponse['results'][0]) {
  if (row.tandemBattles == null || row.tandemBattles <= 0) return '—';
  return row.tandemWins ?? 0;
}
</script>

<template>
  <section class="event-page">
    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <template v-else-if="data">
      <div class="hero">
        <div class="hero__head">
          <SeriesLogo
            :slug="data.series.slug"
            :name="data.series.name"
            :logo-url="data.series.logoUrl"
            :country="data.series.country"
            size="xl"
          />
          <div>
            <RouterLink :to="data.event.standingsPath" class="back-link">
              ← {{ t('eventDetail.backToStandings') }}
            </RouterLink>
            <h1 class="page-title">{{ data.event.name }}</h1>
            <p class="page-subtitle">
              {{ data.series.name }} · {{ data.season.year }} ·
              {{ t('standings.round', { n: data.event.roundNumber }) }}
            </p>
            <p class="event-meta muted">
              <span>{{ formatDate(data.event.startsAt) }}</span>
              <span v-if="data.event.track" class="event-meta__sep">·</span>
              <RouterLink
                v-if="data.event.track"
                :to="`/tracks/${data.event.track.slug}`"
                class="track-link"
              >
                {{ trackLabel(data.event.track) }}
              </RouterLink>
              <span class="event-meta__sep">·</span>
              <span
                class="status-badge"
                :class="`status-badge--${data.event.status.toLowerCase()}`"
              >
                {{ eventStatusLabel(data.event.status) }}
              </span>
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

      <h2 v-if="data.event.status !== 'CANCELLED'" class="section-title">{{ t('eventDetail.resultsTitle') }}</h2>

      <p v-if="data.event.status === 'CANCELLED'" class="muted">{{ t('eventDetail.eventCancelled') }}</p>
      <p v-else-if="data.results.length === 0" class="muted">{{ t('eventDetail.noResults') }}</p>

      <div v-else class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('standings.pilot') }}</th>
              <th v-if="showQual">{{ t('pilot.qual') }}</th>
              <th v-if="showTandem">{{ t('eventDetail.tandemPlace') }}</th>
              <th v-if="showDuels">{{ t('eventDetail.tandemBattles') }}</th>
              <th v-if="showDuels">{{ t('eventDetail.tandemWins') }}</th>
              <th>{{ t('pilot.points') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.results" :key="row.pilotSlug">
              <td>
                <RouterLink class="pilot-link" :to="`/pilots/${row.pilotSlug}`">
                  <span v-if="row.number" class="muted">#{{ row.number }} · </span>
                  {{ pilotName(row) }}
                </RouterLink>
              </td>
              <td v-if="showQual" class="muted">{{ formatQual(row) }}</td>
              <td v-if="showTandem" class="muted num-col">{{ row.tandemPosition ?? '—' }}</td>
              <td v-if="showDuels" class="muted num-col">{{ formatTandemBattles(row) }}</td>
              <td v-if="showDuels" class="muted num-col">{{ formatTandemWins(row) }}</td>
              <td class="num-col"><strong>{{ row.points }}</strong></td>
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

.hero__head {
  display: flex;
  align-items: flex-start;
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

.event-meta {
  margin: 0.35rem 0 0;
  font-size: 0.92rem;
}

.event-meta__sep {
  margin: 0 0.35rem;
}

.track-link {
  color: var(--accent);
}

.track-link:hover {
  text-decoration: underline;
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

.status-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-badge--finished {
  background: rgba(139, 151, 171, 0.12);
  color: var(--muted);
}

.status-badge--scheduled {
  background: rgba(34, 197, 94, 0.12);
  color: var(--verified);
}

.status-badge--cancelled {
  background: rgba(255, 255, 255, 0.06);
  color: var(--muted);
}

.num-col {
  width: 3.5rem;
  text-align: center;
  white-space: nowrap;
}
</style>
