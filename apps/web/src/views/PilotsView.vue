<script setup lang="ts">
import type { PilotListEntry, PilotListSeriesParticipation, PilotsListResponse } from '@drift-index/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchPilots } from '../api/client';
import PilotAvatar from '../components/PilotAvatar.vue';
import SeriesLogo from '../components/SeriesLogo.vue';
import { formatAvgPlaceRange } from '../lib/formatAvgPlace';
import { formatPilotName } from '../lib/formatPilotName';

const { t } = useI18n();

const data = ref<PilotsListResponse | null>(null);
const loading = ref(true);
const error = ref(false);
const query = ref('');

async function load() {
  loading.value = true;
  error.value = false;
  try {
    data.value = await fetchPilots();
  } catch {
    error.value = true;
    data.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const filtered = computed(() => {
  if (!data.value) return [];
  const q = query.value.trim().toLowerCase();
  if (!q) return data.value.pilots;

  return data.value.pilots.filter((entry) => {
    const pilot = entry.pilot;
    const haystack = [
      pilot.firstName,
      pilot.lastName,
      pilot.number?.toString(),
      pilot.country,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
});

const rankedCount = computed(
  () => filtered.value.filter((entry) => entry.rank != null).length,
);

function pilotName(entry: PilotListEntry) {
  return formatPilotName(entry.pilot);
}

function seriesMeta(series: PilotListSeriesParticipation) {
  const parts = [
    t('home.p4pAvgPlace', { place: formatAvgPlaceRange(series.place) }),
  ];
  if (series.avgQualScore != null) {
    parts.push(t('home.p4pAvgQual', { score: series.avgQualScore.toFixed(1) }));
  }
  return parts.join(' · ');
}
</script>

<template>
  <section>
    <div class="hero">
      <div>
        <h1 class="page-title">{{ t('pilots.title') }}</h1>
        <p class="page-subtitle">{{ t('pilots.subtitle', { year: data?.year ?? '…' }) }}</p>
      </div>
      <label class="search">
        <span class="sr-only">{{ t('pilots.search') }}</span>
        <input v-model="query" type="search" :placeholder="t('pilots.search')" />
      </label>
    </div>

    <p v-if="data && !loading && !error" class="pilots-summary muted">
      {{ t('pilots.summary', { pilotCount: data.pilotCount, seriesCount: data.seriesCount }) }}
    </p>

    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <template v-else-if="data">
      <p v-if="query" class="results-meta muted">
        {{ t('pilots.resultsCount', { count: filtered.length }) }}
      </p>

      <ol class="pilots-list card">
        <li
          v-for="entry in filtered"
          :key="entry.pilot.slug"
          class="pilots-list__item"
          :class="{ 'pilots-list__item--unranked': entry.rank == null }"
        >
          <RouterLink :to="`/pilots/${entry.pilot.slug}`" class="pilots-list__link">
            <PilotAvatar :pilot="entry.pilot" size="md" />
            <div class="pilots-list__body">
              <p class="pilots-list__name">
                <span v-if="entry.pilot.number" class="muted">#{{ entry.pilot.number }} · </span>
                {{ pilotName(entry) }}
              </p>
              <p
                v-if="entry.seriesParticipations.length > 0"
                class="pilots-list__series"
              >
                <span
                  v-for="series in entry.seriesParticipations"
                  :key="series.slug"
                  class="pilots-list__series-item"
                >
                  <SeriesLogo
                    :slug="series.slug"
                    :name="series.name"
                    :logo-url="series.logoUrl"
                    size="sm"
                  />
                  <span>{{ seriesMeta(series) }}</span>
                  <span class="muted">· {{ t('pilots.hardnessShort') }} {{ series.weight }}</span>
                </span>
              </p>
              <p v-else class="pilots-list__series muted">{{ t('pilots.unranked') }}</p>
            </div>
            <div class="pilots-list__tail">
              <span class="pilots-list__rank">
                {{ entry.rank ?? '—' }}
              </span>
              <span class="pilots-list__score">
                {{ entry.score ?? '—' }}
              </span>
            </div>
          </RouterLink>
        </li>
      </ol>

      <p v-if="filtered.length === 0" class="muted">{{ t('pilots.noResults') }}</p>
      <p v-else-if="!query && rankedCount > 0" class="footer-meta muted">
        {{ t('pilots.rankedCount', { count: rankedCount }) }}
      </p>
    </template>
  </section>
</template>

<style scoped>
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

.pilots-summary {
  margin: 0.85rem 0 0;
  font-size: 0.95rem;
}

.search {
  flex: 1 1 240px;
  max-width: 320px;
}

.search input {
  width: 100%;
  padding: 0.65rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}

.search input:focus {
  outline: 2px solid var(--accent-soft);
  border-color: rgba(255, 77, 26, 0.45);
}

.results-meta,
.footer-meta {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
}

.pilots-list {
  list-style: none;
  margin: 1.5rem 0 0;
  padding: 0.35rem 0;
}

.pilots-list__item {
  border-bottom: 1px solid var(--border);
}

.pilots-list__item:last-child {
  border-bottom: 0;
}

.pilots-list__item:hover {
  background: rgba(255, 255, 255, 0.02);
}

.pilots-list__item--unranked {
  opacity: 0.72;
}

.pilots-list__link {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 1rem;
}

.pilots-list__link :deep(.avatar--md) {
  width: 64px;
  height: 64px;
  font-size: 1.02rem;
}

.pilots-list__tail {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  align-self: stretch;
  justify-content: space-between;
  gap: 0.35rem;
  height: 100%;
  min-width: 3rem;
  flex-shrink: 0;
}

.pilots-list__rank {
  font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  font-size: 1.25rem;
  font-weight: 700;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--accent);
  opacity: 0.9;
}

.pilots-list__item--unranked .pilots-list__rank {
  color: var(--muted);
}

.pilots-list__body {
  min-width: 0;
}

.pilots-list__name {
  margin: 0;
  font-weight: 600;
}

.pilots-list__series {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0;
  margin: 0.15rem 0 0;
  font-size: 0.82rem;
}

.pilots-list__series-item {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.pilots-list__series-item :deep(.series-logo) {
  width: 28px;
  height: 28px;
}

.pilots-list__series-item:not(:last-child)::after {
  content: '';
  display: inline-block;
  width: 1px;
  height: 1.05rem;
  margin: 0 0.55rem;
  background: var(--border);
  vertical-align: middle;
}

.pilots-list__score {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  min-width: 3rem;
  text-align: right;
}

.pilots-list__item--unranked .pilots-list__score {
  color: var(--muted);
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

@media (max-width: 640px) {
  .pilots-list__link {
    align-items: center;
    gap: 0.65rem;
    padding: 0.65rem 0.75rem;
  }

  .pilots-list__rank {
    font-size: 1.05rem;
  }
}
</style>
