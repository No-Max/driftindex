<script setup lang="ts">
import type {
  PilotListEntry,
  PilotListSeriesParticipation,
  PilotsListResponse,
  PilotsListSeriesFilter,
} from '@drift-index/shared';
import { computed, onBeforeUnmount, shallowRef, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchPilots } from '../api/client';
import DebouncedSearchInput from '../components/DebouncedSearchInput.vue';
import PilotAvatar from '../components/PilotAvatar.vue';
import PilotSeasonTrophies from '../components/PilotSeasonTrophies.vue';
import SeriesLogo from '../components/SeriesLogo.vue';
import { useLocalePath } from '../composables/useLocalePath';
import { formatAvgPlaceRange } from '../lib/formatAvgPlace';
import { formatPilotName } from '../lib/formatPilotName';

const { t } = useI18n();
const { localePath } = useLocalePath();

const PAGE_SIZE = 50;

const data = shallowRef<PilotsListResponse | null>(null);
const loading = ref(true);
const error = ref(false);
/** Debounced search term — updates only after DebouncedSearchInput settles. */
const query = ref('');
const seriesSlug = ref('');
const seriesFilters = shallowRef<PilotsListSeriesFilter[]>([]);
const page = ref(1);

let abortController: AbortController | null = null;
let requestSeq = 0;

async function load() {
  abortController?.abort();
  const controller = new AbortController();
  abortController = controller;
  const seq = ++requestSeq;

  loading.value = true;
  error.value = false;
  try {
    const next = await fetchPilots({
      page: page.value,
      pageSize: PAGE_SIZE,
      q: query.value,
      series: seriesSlug.value,
      signal: controller.signal,
    });
    if (seq !== requestSeq) return;
    data.value = next;
    if (page.value !== next.page) page.value = next.page;
    seriesFilters.value = next.seriesFilters;
  } catch {
    if (controller.signal.aborted) return;
    error.value = true;
    data.value = null;
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
}

watch(query, () => {
  if (page.value !== 1) page.value = 1;
});

watch(seriesSlug, () => {
  if (page.value !== 1) page.value = 1;
});

watch([page, query, seriesSlug], () => {
  void load();
}, { immediate: true });

onBeforeUnmount(() => {
  abortController?.abort();
});

const pageCount = computed(() => data.value?.pageCount ?? 1);
const skeletonRows = Array.from({ length: 8 }, (_, i) => i);

function goToPage(next: number) {
  page.value = Math.max(1, Math.min(next, pageCount.value));
}

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
      <div class="hero__filters">
        <label class="search">
          <span class="sr-only">{{ t('pilots.search') }}</span>
          <DebouncedSearchInput
            v-model="query"
            :placeholder="t('pilots.search')"
            :debounce-ms="300"
            :min-length="3"
          />
        </label>
        <label class="series-filter">
          <span class="sr-only">{{ t('pilots.filterSeries') }}</span>
          <select v-model="seriesSlug" :disabled="seriesFilters.length === 0">
            <option value="">{{ t('pilots.filterAllSeries') }}</option>
            <option
              v-for="series in seriesFilters"
              :key="series.slug"
              :value="series.slug"
            >
              {{ series.shortName ?? series.name }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <p v-if="data && !error" class="pilots-summary muted">
      {{ t('pilots.summary', { pilotCount: data.pilotCount, seriesCount: data.seriesCount }) }}
    </p>

    <p v-if="error && !loading" class="muted">{{ t('states.error') }}</p>

    <ol
      v-else-if="loading"
      class="pilots-list card pilots-list--skeleton"
      aria-busy="true"
      aria-label="Loading"
    >
      <li v-for="row in skeletonRows" :key="row" class="pilots-list__item">
        <div class="pilots-list__link pilots-list__link--skeleton">
          <span class="skel skel--avatar" />
          <div class="pilots-list__body">
            <span class="skel skel--name" />
            <span class="skel skel--meta" />
          </div>
          <div class="pilots-list__tail">
            <span class="skel skel--rank" />
            <span class="skel skel--score" />
          </div>
        </div>
      </li>
    </ol>

    <template v-else-if="data">
      <p v-if="query || seriesSlug" class="results-meta muted">
        {{ t('pilots.resultsCount', { count: data.total }) }}
      </p>

      <ol v-if="data.pilots.length > 0" class="pilots-list card">
        <li
          v-for="entry in data.pilots"
          :key="entry.pilot.slug"
          class="pilots-list__item"
          :class="{ 'pilots-list__item--unranked': entry.rank == null }"
        >
          <RouterLink :to="localePath(`/pilots/${entry.pilot.slug}`)" class="pilots-list__link">
            <PilotAvatar :pilot="entry.pilot" size="md" class="pilots-list__avatar" />
            <div class="pilots-list__body">
              <p class="pilots-list__name">
                {{ pilotName(entry) }}
              </p>
              <p v-if="entry.pilot.stats" class="pilots-list__meta">
                <span>{{ entry.pilot.stats.eventsCount }} {{ t('pilot.stats.eventsShort') }}</span>
                <span>{{ entry.pilot.stats.seasonsCount }} {{ t('pilot.stats.seasonsShort') }}</span>
              </p>
            </div>
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
                <PilotSeasonTrophies
                  :events="entry.seasonEvents"
                  :series-slug="series.slug"
                />
              </span>
            </p>
            <p v-else class="pilots-list__series muted">{{ t('pilots.unranked') }}</p>
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

      <nav v-if="data.total > 0 && data.pageCount > 1" class="pilots-pagination" aria-label="Pagination">
        <button
          type="button"
          class="pilots-pagination__btn"
          :disabled="data.page <= 1"
          @click="goToPage(data.page - 1)"
        >
          {{ t('pilots.pagePrev') }}
        </button>
        <span class="pilots-pagination__status muted">
          {{ t('pilots.pageStatus', { page: data.page, pages: data.pageCount }) }}
        </span>
        <button
          type="button"
          class="pilots-pagination__btn"
          :disabled="data.page >= data.pageCount"
          @click="goToPage(data.page + 1)"
        >
          {{ t('pilots.pageNext') }}
        </button>
      </nav>

      <p v-if="data.total === 0" class="muted">{{ t('pilots.noResults') }}</p>
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

.hero__filters {
  display: flex;
  flex: 1 1 320px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  min-width: 0;
}

.search {
  flex: 1 1 200px;
  max-width: 320px;
  min-width: 0;
}

.series-filter {
  position: relative;
  flex: 1 1 160px;
  max-width: 220px;
  min-width: 0;
  display: block;
}

.series-filter::after {
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

.search input {
  width: 100%;
  padding: 0.65rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.series-filter select {
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

.series-filter select:hover:not(:disabled) {
  border-color: rgba(255, 77, 26, 0.35);
  background-color: var(--surface);
}

.series-filter select:disabled {
  opacity: 0.55;
  cursor: default;
}

.search input:focus,
.series-filter select:focus {
  outline: 2px solid var(--accent-soft);
  outline-offset: 0;
  border-color: rgba(255, 77, 26, 0.45);
}

.series-filter select:focus {
  background-color: var(--surface);
}

.series-filter select option {
  background: var(--surface-2);
  color: var(--text);
}

.results-meta {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
}

.pilots-list__link--skeleton {
  pointer-events: none;
}

.skel {
  display: block;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--surface-2) 0%,
    rgba(255, 255, 255, 0.06) 45%,
    var(--surface-2) 90%
  );
  background-size: 200% 100%;
  animation: skel-shimmer 1.15s ease-in-out infinite;
}

.skel--avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skel--name {
  width: min(42%, 14rem);
  height: 0.95rem;
  margin-bottom: 0.55rem;
}

.skel--meta {
  width: min(68%, 22rem);
  height: 0.7rem;
  opacity: 0.85;
}

.skel--rank {
  width: 1.6rem;
  height: 1.05rem;
}

.skel--score {
  width: 2.4rem;
  height: 0.75rem;
}

@keyframes skel-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.pilots-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-top: 1rem;
}

.pilots-pagination__btn {
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.pilots-pagination__btn:hover:not(:disabled) {
  border-color: rgba(255, 77, 26, 0.45);
  color: var(--accent);
  background: var(--surface);
}

.pilots-pagination__btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.pilots-pagination__status {
  font-size: 0.88rem;
  font-variant-numeric: tabular-nums;
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
  grid-template-areas:
    'avatar body tail'
    'avatar series tail';
  align-items: center;
  column-gap: 0.85rem;
  row-gap: 0.15rem;
  padding: 0.75rem 1rem;
}

.pilots-list__avatar {
  grid-area: avatar;
  align-self: center;
}

.pilots-list__link :deep(.avatar--md) {
  width: 72px;
  height: 72px;
  font-size: 1.05rem;
}

.pilots-list__tail {
  grid-area: tail;
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
  font-size: 1.15rem;
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
  grid-area: body;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-self: center;
  min-width: 0;
}

.pilots-list__name {
  margin: 0;
  font-weight: 600;
}

.pilots-list__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
  color: var(--muted);
}

.pilots-list__series {
  grid-area: series;
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

.pilots-list__series-item :deep(.season-trophies) {
  margin-left: 0.1rem;
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

@media (max-width: 768px) {
  .pilots-list__link {
    grid-template-areas:
      'avatar body tail'
      'series series series';
    align-items: start;
    column-gap: 0.65rem;
    row-gap: 0.45rem;
    padding: 0.65rem 0.75rem;
  }

  .pilots-list__avatar {
    align-self: start;
  }

  .pilots-list__link :deep(.avatar--md) {
    width: 60px;
    height: 60px;
    font-size: 0.95rem;
  }

  .pilots-list__series {
    margin-top: 0;
    flex-direction: column;
    align-items: flex-start;
    flex-wrap: nowrap;
    row-gap: 0.35rem;
  }

  .pilots-list__series-item:not(:last-child)::after {
    display: none;
  }

  .pilots-list__rank {
    font-size: 1.05rem;
  }

  .skel--avatar {
    width: 60px;
    height: 60px;
  }
}

@media (max-width: 500px) {
  .pilots-list__tail {
    min-width: 0;
  }
}

@media (max-width: 400px) {
  .pilots-list__score {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skel {
    animation: none;
  }
}
</style>
