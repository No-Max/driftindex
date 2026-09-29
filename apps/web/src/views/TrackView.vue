<script setup lang="ts">
import type { TrackProfileResponse } from '@drift-index/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { fetchTrack } from '../api/client';
import TrackPhotoSlider from '../components/TrackPhotoSlider.vue';
import { useLocalePath } from '../composables/useLocalePath';

const route = useRoute();
const { t, locale } = useI18n();
const { localePath } = useLocalePath();

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

const seriesCount = computed(() => {
  if (!track.value) return 0;
  return new Set(track.value.events.map((event) => event.seriesSlug)).size;
});

const seriesNames = computed(() => {
  if (!track.value) return '';
  const seen = new Set<string>();
  const names: string[] = [];
  for (const event of track.value.events) {
    if (seen.has(event.seriesSlug)) continue;
    seen.add(event.seriesSlug);
    names.push(event.seriesShortName ?? event.seriesName);
  }
  return names.join(' · ');
});

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
          <TrackPhotoSlider :key="track.slug" :photos="track.photos" :alt="track.name" />
        </div>
        <div class="hero__body">
          <RouterLink :to="localePath('/tracks')" class="back-link">← {{ t('tracks.back') }}</RouterLink>
          <p v-if="locationLabel()" class="muted">{{ locationLabel() }}</p>
          <h1 class="page-title">{{ track.name }}</h1>
          <p class="page-subtitle track-stats">
            <span>{{ t('tracks.eventCount', { count: track.events.length }) }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ t('tracks.seriesCount', { count: seriesCount }) }}</span>
            <span v-if="seriesNames" class="track-stats__series">{{ seriesNames }}</span>
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
                  <RouterLink
                    :to="event.status === 'FINISHED' ? localePath(event.eventPath) : localePath(event.standingsPath)"
                    class="event-link"
                  >
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
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.hero,
.events-section {
  min-width: 0;
  max-width: 100%;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
  overflow: hidden;
}

.hero__photo {
  min-width: 0;
  min-height: 260px;
}

.hero__body {
  min-width: 0;
  padding: 1.5rem;
}

.hero__body .page-title {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.track-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 0.55rem;
  max-width: 100%;
}

.track-stats__series {
  width: 100%;
  color: var(--muted);
  font-size: 0.92em;
  overflow-wrap: anywhere;
}

.events-section .table-wrap {
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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
    grid-template-columns: minmax(0, 1fr);
  }

  .hero__photo {
    min-height: 200px;
  }

  .hero__body {
    padding: 1.1rem 1.15rem;
  }

  .events-section :deep(th),
  .events-section :deep(td) {
    padding: 0.75rem 0.85rem;
  }
}
</style>
