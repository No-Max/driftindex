<script setup lang="ts">
import type { TrackListEntry } from '@drift-index/shared';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchTracks } from '../api/client';

const { t } = useI18n();

const tracks = ref<TrackListEntry[]>([]);
const loading = ref(true);
const error = ref(false);

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
</script>

<template>
  <section class="tracks-page">
    <div class="hero">
      <h1 class="page-title">{{ t('tracks.title') }}</h1>
      <p class="page-subtitle">{{ t('tracks.subtitle') }}</p>
    </div>

    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <div v-else class="tracks-grid">
      <RouterLink
        v-for="track in tracks"
        :key="track.slug"
        class="card track-card"
        :to="`/tracks/${track.slug}`"
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

.hero .page-subtitle {
  margin-bottom: 0;
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
</style>
