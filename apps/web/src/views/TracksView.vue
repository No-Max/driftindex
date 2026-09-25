<script setup lang="ts">
import type { TrackListEntry } from '@drift-index/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { fetchTracks } from '../api/client';
import { useLocalePath } from '../composables/useLocalePath';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { localePath } = useLocalePath();

const NO_COUNTRY = '__none__';
const COUNTRY_QUERY = 'country';

const tracks = ref<TrackListEntry[]>([]);
const loading = ref(true);
const error = ref(false);
const country = ref(readCountryQuery(route.query[COUNTRY_QUERY]));

function readCountryQuery(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function syncCountryToUrl(value: string) {
  const nextQuery = { ...route.query };
  if (value) nextQuery[COUNTRY_QUERY] = value;
  else delete nextQuery[COUNTRY_QUERY];

  if (readCountryQuery(route.query[COUNTRY_QUERY]) === value) return;

  router.replace({ query: nextQuery });
}

watch(country, syncCountryToUrl);

watch(
  () => route.query[COUNTRY_QUERY],
  (value) => {
    const parsed = readCountryQuery(value);
    if (parsed !== country.value) country.value = parsed;
  },
);

onMounted(async () => {
  try {
    const response = await fetchTracks();
    tracks.value = response.tracks;
  } catch {
    error.value = true;
    tracks.value = [];
  } finally {
    loading.value = false;
  }
});

function locationLabel(track: TrackListEntry): string {
  return [track.city, track.country].filter(Boolean).join(', ');
}

function seriesLabel(track: TrackListEntry): string {
  return track.series.map((series) => series.shortName ?? series.name).join(' · ');
}

function trackCountryKey(track: TrackListEntry): string {
  return track.country?.trim() || NO_COUNTRY;
}

const countryOptions = computed(() => {
  const known = new Set<string>();
  let hasUnknown = false;
  for (const track of tracks.value) {
    const key = trackCountryKey(track);
    if (key === NO_COUNTRY) hasUnknown = true;
    else known.add(key);
  }
  const sorted = [...known].sort((a, b) => a.localeCompare(b));
  if (hasUnknown) sorted.push(NO_COUNTRY);
  return sorted;
});

const filteredTracks = computed(() => {
  if (!country.value) return tracks.value;
  return tracks.value.filter((track) => trackCountryKey(track) === country.value);
});
</script>

<template>
  <section class="tracks-page">
    <div class="hero">
      <div>
        <h1 class="page-title">{{ t('tracks.title') }}</h1>
        <p class="page-subtitle">{{ t('tracks.subtitle') }}</p>
      </div>
      <div v-if="!loading && !error" class="hero__filters">
        <label class="country-filter">
          <span class="sr-only">{{ t('tracks.filterCountry') }}</span>
          <select v-model="country" :disabled="countryOptions.length === 0">
            <option value="">{{ t('tracks.filterAllCountries') }}</option>
            <option v-for="value in countryOptions" :key="value" :value="value">
              {{ value === NO_COUNTRY ? t('tracks.countryUnknown') : value }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <p v-else-if="country && filteredTracks.length === 0" class="muted">
      {{ t('tracks.noResults') }}
    </p>

    <div v-else-if="!loading && !error" class="tracks-grid">
      <RouterLink
        v-for="track in filteredTracks"
        :key="track.slug"
        class="card track-card"
        :to="localePath(`/tracks/${track.slug}`)"
      >
        <div class="track-card__photo">
          <img v-if="track.photoUrl" :src="track.photoUrl" :alt="track.name" />
          <span v-else>{{ t('tracks.noPhoto') }}</span>
        </div>

        <div class="track-card__body">
          <p v-if="locationLabel(track)" class="track-card__location muted">{{ locationLabel(track) }}</p>
          <h2>{{ track.name }}</h2>
          <p class="track-card__description">
            {{ track.description || t('tracks.noDescription') }}
          </p>
          <div class="track-card__meta">
            <span>{{ t('tracks.eventCount', { count: track.eventCount }) }}</span>
            <span v-if="seriesLabel(track)">{{ seriesLabel(track) }}</span>
          </div>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.tracks-page {
  display: grid;
  gap: 1.5rem;
}

.hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero .page-subtitle {
  margin-bottom: 0;
}

.hero__filters {
  display: flex;
  flex: 1 1 200px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  min-width: 0;
}

.country-filter {
  position: relative;
  flex: 1 1 160px;
  max-width: 220px;
  min-width: 0;
  display: block;
}

.country-filter::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 1rem;
  width: 0.45rem;
  height: 0.45rem;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}

.country-filter select {
  width: 100%;
  padding: 0.65rem 2.15rem 0.65rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background-color: var(--surface-2);
  color: var(--text);
  font: inherit;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s;
}

.country-filter select:hover:not(:disabled) {
  border-color: rgba(255, 77, 26, 0.35);
  background-color: var(--surface);
}

.country-filter select:disabled {
  opacity: 0.55;
  cursor: default;
}

.country-filter select:focus {
  outline: 2px solid var(--accent-soft);
  outline-offset: 0;
  border-color: rgba(255, 77, 26, 0.45);
  background-color: var(--surface);
}

.country-filter select option {
  background: var(--surface-2);
  color: var(--text);
}

.tracks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.track-card {
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s;
}

.track-card:hover {
  border-color: rgba(255, 77, 26, 0.45);
  transform: translateY(-2px);
}

.track-card__photo {
  display: grid;
  place-items: center;
  min-height: 140px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 0.82rem;
}

.track-card__photo img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
}

.track-card__body {
  padding: 1rem 1.1rem;
}

.track-card__location {
  margin: 0 0 0.3rem;
  font-size: 0.78rem;
}

.track-card h2 {
  margin: 0;
  font-size: 1.05rem;
}

.track-card__description {
  margin: 0.55rem 0 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.45;
}

.track-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.85rem;
}

.track-card__meta span {
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 0.72rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
