<script setup lang="ts">
import type { SeriesProfileResponse } from '@drift-index/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { fetchSeriesProfile } from '../api/client';
import SeriesLogo from '../components/SeriesLogo.vue';

const route = useRoute();
const { t, locale } = useI18n();

const data = ref<SeriesProfileResponse | null>(null);
const loading = ref(true);
const error = ref(false);

const slug = computed(() => String(route.params.slug));

async function load() {
  loading.value = true;
  error.value = false;
  try {
    data.value = await fetchSeriesProfile(slug.value);
  } catch {
    error.value = true;
    data.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => route.fullPath, load);

function seasonName(season: SeriesProfileResponse['seasons'][0]) {
  const localized = locale.value === 'ru' ? season.nameRu : season.nameEn;
  return localized ?? season.nameEn ?? season.nameRu ?? String(season.year);
}

function sourceLabel(season: SeriesProfileResponse['seasons'][0]) {
  if (!season.source) return '';
  return locale.value === 'ru' ? season.source.labelRu : season.source.labelEn;
}

function formatDate(iso: string | null): string {
  if (!iso) return t('tracks.noDate');
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

function eventStatusLabel(status: SeriesProfileResponse['seasons'][0]['events'][0]['status']) {
  return t(`home.eventStatus.${status.toLowerCase()}`);
}

function trackLabel(track: SeriesProfileResponse['seasons'][0]['events'][0]['track']) {
  if (!track) return '—';
  return track.city ? `${track.name}, ${track.city}` : track.name;
}

function isEventClickable(status: SeriesProfileResponse['seasons'][0]['events'][0]['status']) {
  return status === 'FINISHED';
}
</script>

<template>
  <section class="series-detail">
    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <template v-else-if="data">
      <div class="hero card">
        <SeriesLogo
          :slug="data.series.slug"
          :name="data.series.name"
          :logo-url="data.series.logoUrl"
          :country="data.series.country"
          size="xl"
        />
        <div class="hero__body">
          <RouterLink to="/series" class="back-link">← {{ t('seriesDetail.back') }}</RouterLink>
          <h1 class="page-title">{{ data.series.name }}</h1>
          <p v-if="data.series.shortName && data.series.shortName !== data.series.name" class="muted">
            {{ data.series.shortName }}
          </p>
          <p class="page-subtitle">
            {{ t('seriesDetail.seasonCount', { count: data.seasons.length }) }}
          </p>
        </div>
      </div>

      <p v-if="data.seasons.length === 0" class="muted">{{ t('seriesDetail.noSeasons') }}</p>

      <section v-for="season in data.seasons" :key="season.year" class="season-block">
        <div class="season-head">
          <div>
            <h2 class="section-title">{{ seasonName(season) }}</h2>
            <p class="muted season-meta">
              {{ t('standings.eventsProgress', { finished: season.finishedEventCount, total: season.eventCount }) }}
            </p>
          </div>
          <RouterLink :to="season.standingsPath" class="standings-link">
            {{ t('seriesDetail.openStandings') }} →
          </RouterLink>
        </div>

        <p v-if="season.source" class="source-meta muted">
          {{ t('standings.source') }}:
          <a
            v-if="season.source.url"
            :href="season.source.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ sourceLabel(season) }}
          </a>
          <span v-else>{{ sourceLabel(season) }}</span>
        </p>

        <div v-if="season.events.length > 0" class="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t('tracks.round') }}</th>
                <th>{{ t('seriesDetail.date') }}</th>
                <th>{{ t('pilot.event') }}</th>
                <th>{{ t('seriesDetail.track') }}</th>
                <th>{{ t('seriesDetail.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in season.events" :key="event.slug">
                <td class="muted">{{ t('standings.round', { n: event.roundNumber }) }}</td>
                <td class="muted">{{ formatDate(event.startsAt) }}</td>
                <td>
                  <RouterLink
                    v-if="isEventClickable(event.status)"
                    :to="event.standingsPath"
                    class="event-link"
                  >
                    {{ event.name }}
                  </RouterLink>
                  <span v-else class="event-name">{{ event.name }}</span>
                </td>
                <td>
                  <RouterLink
                    v-if="event.track && isEventClickable(event.status)"
                    :to="`/tracks/${event.track.slug}`"
                    class="track-link"
                  >
                    {{ trackLabel(event.track) }}
                  </RouterLink>
                  <span v-else-if="event.track" class="muted">{{ trackLabel(event.track) }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td>
                  <span class="status-badge" :class="`status-badge--${event.status.toLowerCase()}`">
                    {{ eventStatusLabel(event.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="muted">{{ t('seriesDetail.noEvents') }}</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.series-detail {
  display: grid;
  gap: 2rem;
}

.hero {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 1.25rem 1.35rem;
}

.hero__body {
  display: grid;
  gap: 0.35rem;
}

.back-link {
  color: var(--muted);
  font-size: 0.88rem;
}

.back-link:hover {
  color: var(--accent);
}

.season-block {
  display: grid;
  gap: 0.75rem;
}

.season-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.section-title {
  margin: 0;
}

.season-meta {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

.standings-link {
  color: var(--accent);
  font-size: 0.92rem;
  font-weight: 600;
  white-space: nowrap;
}

.standings-link:hover {
  text-decoration: underline;
}

.source-meta {
  margin: 0;
  font-size: 0.88rem;
}

.source-meta a {
  color: var(--accent);
}

.source-meta a:hover {
  text-decoration: underline;
}

.event-link,
.track-link {
  color: var(--text);
}

.event-link:hover,
.track-link:hover {
  color: var(--accent);
}

.event-name {
  color: var(--text);
}

.status-badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
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
</style>
