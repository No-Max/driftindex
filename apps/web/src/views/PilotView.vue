<script setup lang="ts">
import type { PilotProfileResponse } from '@drift-index/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { fetchPilot } from '../api/client';
import PilotAvatar from '../components/PilotAvatar.vue';
import PilotStatsGrid from '../components/PilotStatsGrid.vue';

const route = useRoute();
const { t, locale } = useI18n();

const pilot = ref<PilotProfileResponse | null>(null);
const loading = ref(true);
const error = ref(false);

const slug = computed(() => String(route.params.slug));

const displayName = computed(() => {
  if (!pilot.value) return '';
  if (locale.value === 'ru' && pilot.value.nameRu) return pilot.value.nameRu;
  return `${pilot.value.firstName} ${pilot.value.lastName}`;
});

async function load() {
  loading.value = true;
  error.value = false;
  try {
    pilot.value = await fetchPilot(slug.value);
  } catch {
    error.value = true;
    pilot.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => route.fullPath, load);

function seriesName(result: PilotProfileResponse['results'][0]) {
  return locale.value === 'ru' ? result.seriesNameRu : result.seriesNameEn;
}

function eventName(result: PilotProfileResponse['results'][0]) {
  return locale.value === 'ru' ? result.eventNameRu : result.eventNameEn;
}
</script>

<template>
  <section>
    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <template v-else-if="pilot">
      <div class="pilot-header">
        <PilotAvatar :pilot="pilot" size="xl" />
        <div>
          <h1 class="page-title">{{ displayName }}</h1>
          <p class="page-subtitle">
            <span v-if="pilot.number">#{{ pilot.number }} · </span>
            <span v-if="pilot.country">{{ pilot.country }}</span>
          </p>
        </div>
      </div>

      <h2 class="section-title">{{ t('pilot.stats.title') }}</h2>
      <PilotStatsGrid :stats="pilot.stats" />

      <h2 class="section-title">{{ t('pilot.results') }}</h2>
      <div class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('pilot.series') }}</th>
              <th>{{ t('pilot.event') }}</th>
              <th>{{ t('pilot.qual') }}</th>
              <th>{{ t('pilot.tandem') }}</th>
              <th>{{ t('pilot.points') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(result, index) in pilot.results" :key="index">
              <td>
                <RouterLink :to="`/series/${result.seriesSlug}/${result.seasonYear}`">
                  {{ seriesName(result) }} {{ result.seasonYear }}
                </RouterLink>
              </td>
              <td>{{ eventName(result) }}</td>
              <td class="muted">{{ result.qualPosition ?? '—' }}</td>
              <td class="muted">{{ result.tandemPosition ?? '—' }}</td>
              <td><strong>{{ result.points }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.pilot-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.pilot-header .page-title {
  margin-bottom: 0.25rem;
}

.pilot-header .page-subtitle {
  margin: 0;
}

.section-title {
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 2rem 0 1rem;
}
</style>
