<script setup lang="ts">
import type { TrackProfileResponse } from '@drift-index/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { fetchTrack } from '../api/client';

const route = useRoute();
const { t, locale } = useI18n();

const track = ref<TrackProfileResponse | null>(null);
const loading = ref(true);
const error = ref(false);

const slug = computed(() => String(route.params.slug));

async function load() {
  loading.value = true;
  error.value = false;
  try {
    track.value = await fetchTrack(slug.value);
  } catch {
    error.value = true;
    track.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => route.fullPath, load);

function locationLabel(): string {
  if (!track.value) return '';
  return [track.value.city, track.value.country].filter(Boolean).join(', ');
}

function formatDate(iso: string | null): string {
  if (!iso) return t('tracks.noDate');
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}
</script>

<template>
  <section class="track-page">
    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <template v-else-if="track">
      <div class="hero card">
        <div class="hero__photo">
          <img v-if="track.photoUrl" :src="track.photoUrl" :alt="track.name" />
          <span v-else>{{ t('tracks.noPhoto') }}</span>
        </div>
        <div class="hero__body">
          <RouterLink to="/tracks" class="back-link">← {{ t('tracks.back') }}</RouterLink>
          <p v-if="locationLabel()" class="muted">{{ locationLabel() }}</p>
          <h1 class="page-title">{{ track.name }}</h1>
          <p class="page-subtitle">
            {{ track.description || t('tracks.noDescription') }}
          </p>
        </div>
      </div>

      <section class="events-section">
        <h2 class="section-title">{{ t('tracks.eventsTitle') }}</h2>
        <div class="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t('tracks.date') }}</th>
                <th>{{ t('pilot.series') }}</th>
                <th>{{ t('pilot.event') }}</th>
                <th>{{ t('tracks.round') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in track.events" :key="`${event.seriesSlug}-${event.seasonYear}-${event.eventSlug}`">
                <td class="muted">{{ formatDate(event.startsAt) }}</td>
                <td>{{ event.seriesShortName ?? event.seriesName }} {{ event.seasonYear }}</td>
                <td>
                  <RouterLink :to="event.standingsPath" class="event-link">
                    {{ event.eventName }}
                  </RouterLink>
                </td>
                <td class="muted">{{ t('standings.round', { n: event.roundNumber }) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.track-page {
  display: grid;
  gap: 1.5rem;
}

.hero {
  display: grid;
  grid-template-columns: minmax(220px, 360px) 1fr;
  overflow: hidden;
}

.hero__photo {
  display: grid;
  place-items: center;
  min-height: 260px;
  background: var(--surface-2);
  color: var(--muted);
}

.hero__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero__body {
  padding: 1.5rem;
}

.back-link,
.event-link {
  color: var(--accent);
}

.back-link:hover,
.event-link:hover {
  text-decoration: underline;
}

.section-title {
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 1rem;
}

@media (max-width: 720px) {
  .hero {
    grid-template-columns: 1fr;
  }
}
</style>
