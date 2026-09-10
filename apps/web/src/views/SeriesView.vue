<script setup lang="ts">
import type { OverlapContribution, SeriesPrestigeEntry, SeriesPrestigeResponse } from '@drift-index/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchSeriesList, fetchSeriesPrestige, type SeriesListItem } from '../api/client';

const { t, locale } = useI18n();

const prestige = ref<SeriesPrestigeResponse | null>(null);
const seriesList = ref<SeriesListItem[]>([]);
const loading = ref(true);
const error = ref(false);
const expandedSlug = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = false;
  try {
    const year = new Date().getFullYear();
    [prestige.value, seriesList.value] = await Promise.all([
      fetchSeriesPrestige(year),
      fetchSeriesList(),
    ]);
  } catch {
    error.value = true;
    prestige.value = null;
    seriesList.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const displayYear = computed(() => prestige.value?.year ?? new Date().getFullYear());

const sourceLabel = computed(() => {
  if (!prestige.value) return '';
  return t(`seriesPage.source.${prestige.value.source}`);
});

const historyLabel = computed(() => {
  if (!prestige.value?.historyFromYear || !prestige.value.historyToYear) return '';
  return t('seriesPage.historyWindow', {
    from: prestige.value.historyFromYear,
    to: prestige.value.historyToYear,
    years: prestige.value.historyYears,
  });
});

function seriesName(entry: SeriesPrestigeEntry | SeriesListItem) {
  return locale.value === 'ru' ? entry.nameRu : entry.nameEn;
}

function seriesNameBySlug(slug: string) {
  const entry = prestige.value?.entries.find((item) => item.slug === slug);
  if (entry) return seriesName(entry);
  const listed = seriesList.value.find((item) => item.slug === slug);
  return listed ? seriesName(listed) : slug;
}

function formatCoefficient(value: number) {
  return value.toFixed(3);
}

function formatSamples(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function toggleContributions(slug: string) {
  expandedSlug.value = expandedSlug.value === slug ? null : slug;
}

function contributionPilotName(row: OverlapContribution) {
  return `${row.firstName} ${row.lastName}`;
}

function latestSeasonYear(item: SeriesListItem) {
  return item.seasons[0]?.year;
}
</script>

<template>
  <section class="series-page">
    <div class="hero">
      <div>
        <h1 class="page-title">{{ t('seriesPage.title') }}</h1>
        <p class="page-subtitle">{{ t('seriesPage.subtitle', { year: displayYear }) }}</p>
      </div>
    </div>

    <p v-if="loading" class="muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="muted">{{ t('states.error') }}</p>

    <template v-else-if="prestige">
      <div class="meta-row">
        <span class="badge badge--source">{{ sourceLabel }}</span>
        <span v-if="historyLabel" class="meta-chip muted">{{ historyLabel }}</span>
        <span class="meta-chip muted">
          {{ t('seriesPage.overlapGroups', { count: prestige.overlapGroups }) }}
        </span>
      </div>

      <section class="block">
        <h2 class="section-title">{{ t('seriesPage.prestigeTitle') }}</h2>
        <p class="section-lead muted">{{ t('seriesPage.prestigeLead') }}</p>

        <div class="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t('seriesPage.col.rank') }}</th>
                <th>{{ t('seriesPage.col.series') }}</th>
                <th>{{ t('seriesPage.col.coefficient') }}</th>
                <th>{{ t('seriesPage.col.overlapOrder') }}</th>
                <th>{{ t('seriesPage.col.manualOrder') }}</th>
                <th>{{ t('seriesPage.col.hardness') }}</th>
                <th>{{ t('seriesPage.col.samples') }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <template v-for="entry in prestige.entries" :key="entry.slug">
                <tr>
                  <td class="rank">{{ entry.effectiveOrder }}</td>
                  <td>
                    <strong>{{ seriesName(entry) }}</strong>
                    <span class="muted series-code">{{ entry.slug }}</span>
                  </td>
                  <td>
                    <strong class="coef">S = {{ formatCoefficient(entry.coefficient) }}</strong>
                  </td>
                  <td class="muted">{{ entry.overlapOrder ?? '—' }}</td>
                  <td class="muted">{{ entry.manualOrder }}</td>
                  <td class="muted">{{ entry.hardnessScore || '—' }}</td>
                  <td class="muted">{{ entry.overlapSamples ? formatSamples(entry.overlapSamples) : '—' }}</td>
                  <td>
                    <button
                      v-if="entry.contributions.length > 0"
                      type="button"
                      class="expand-btn"
                      @click="toggleContributions(entry.slug)"
                    >
                      {{ expandedSlug === entry.slug ? t('seriesPage.hideOverlap') : t('seriesPage.showOverlap') }}
                    </button>
                  </td>
                </tr>
                <tr v-if="expandedSlug === entry.slug && entry.contributions.length > 0" class="contrib-row">
                  <td colspan="8">
                    <p class="contrib-title">{{ t('seriesPage.overlapExamples') }}</p>
                    <ul class="contrib-list">
                      <li v-for="(row, index) in entry.contributions" :key="index">
                        <RouterLink :to="`/pilots/${row.pilotSlug}`" class="pilot-link">
                          {{ contributionPilotName(row) }}
                        </RouterLink>
                        · {{ row.seasonYear }} ·
                        {{ t('seriesPage.overlapLine', {
                          harder: seriesNameBySlug(row.harderSeriesSlug),
                          easier: seriesNameBySlug(row.easierSeriesSlug),
                          hardPlace: row.placeInHarder,
                          easyPlace: row.placeInEasier,
                          delta: row.delta,
                        }) }}
                      </li>
                    </ul>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <section class="block methodology">
        <h2 class="section-title">{{ t('seriesPage.methodTitle') }}</h2>

        <div class="method-grid">
          <article class="card method-card">
            <h3>{{ t('seriesPage.method.overlap.title') }}</h3>
            <p>{{ t('seriesPage.method.overlap.body') }}</p>
          </article>

          <article class="card method-card">
            <h3>{{ t('seriesPage.method.coefficient.title') }}</h3>
            <p>{{ t('seriesPage.method.coefficient.body', { n: prestige.totalSeries }) }}</p>
            <pre class="formula">S = (N − rank + 1) / N</pre>
          </article>

          <article class="card method-card">
            <h3>{{ t('seriesPage.method.p4p.title') }}</h3>
            <p>{{ t('seriesPage.method.p4p.body') }}</p>
            <pre class="formula">P4P = max(S / P) × 1000</pre>
            <p class="muted method-note">{{ t('seriesPage.method.p4p.note') }}</p>
          </article>

          <article class="card method-card">
            <h3>{{ t('seriesPage.method.history.title') }}</h3>
            <p>{{ t('seriesPage.method.history.body', { years: prestige.historyYears }) }}</p>
            <p class="muted method-note">{{ t('seriesPage.method.history.decay') }}</p>
          </article>

          <article class="card method-card">
            <h3>{{ t('seriesPage.method.fallback.title') }}</h3>
            <p>{{ t('seriesPage.method.fallback.body') }}</p>
          </article>
        </div>
      </section>

      <section v-if="seriesList.length > 0" class="block">
        <h2 class="section-title">{{ t('seriesPage.catalogTitle') }}</h2>
        <p class="section-lead muted">{{ t('seriesPage.catalogLead', { year: displayYear }) }}</p>

        <div class="catalog-grid">
          <article v-for="item in seriesList" :key="item.slug" class="card catalog-card">
            <div class="catalog-card__head">
              <span class="catalog-card__code">{{ item.country ?? 'INT' }}</span>
              <div>
                <h3>{{ seriesName(item) }}</h3>
                <p class="muted">
                  {{ t('seriesPage.seasonCount', { count: item.seasons.length }) }}
                </p>
              </div>
            </div>
            <RouterLink
              v-if="latestSeasonYear(item)"
              :to="`/series/${item.slug}/${latestSeasonYear(item)}`"
              class="catalog-link"
            >
              {{ t('seriesPage.openStandings', { year: latestSeasonYear(item) }) }} →
            </RouterLink>
            <p v-else class="muted catalog-empty">{{ t('seriesPage.noSeason') }}</p>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.series-page {
  display: grid;
  gap: 2rem;
}

.hero .page-subtitle {
  margin-bottom: 0;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}

.badge--source {
  background: var(--accent-soft);
  color: var(--accent);
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.meta-chip {
  font-size: 0.88rem;
}

.block {
  display: grid;
  gap: 0.75rem;
}

.section-title {
  margin: 0;
  font-family: Oswald, sans-serif;
  font-size: 1.35rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.section-lead {
  margin: 0;
  max-width: 70ch;
  line-height: 1.55;
}

.series-code {
  display: block;
  font-size: 0.75rem;
  margin-top: 0.15rem;
}

.coef {
  color: var(--accent);
}

.expand-btn {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  padding: 0.3rem 0.55rem;
  border-radius: 8px;
  font-size: 0.75rem;
  cursor: pointer;
}

.expand-btn:hover {
  color: var(--text);
  border-color: rgba(255, 77, 26, 0.35);
}

.contrib-row td {
  background: var(--surface-2);
  white-space: normal;
}

.contrib-title {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.contrib-list {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.35rem;
  font-size: 0.9rem;
  line-height: 1.45;
}

.method-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.method-card {
  padding: 1.1rem 1.15rem;
}

.method-card h3 {
  margin: 0 0 0.65rem;
  font-size: 1rem;
}

.method-card p {
  margin: 0;
  line-height: 1.55;
  color: var(--muted);
}

.formula {
  margin: 0.75rem 0 0;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border);
  font-family: ui-monospace, monospace;
  font-size: 0.88rem;
  color: var(--text);
  overflow-x: auto;
}

.method-note {
  margin-top: 0.65rem !important;
  font-size: 0.85rem;
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.catalog-card {
  padding: 1rem 1.1rem;
  display: grid;
  gap: 0.85rem;
}

.catalog-card__head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.catalog-card__code {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-family: Oswald, sans-serif;
  font-weight: 600;
  color: var(--accent);
  flex-shrink: 0;
}

.catalog-card h3 {
  margin: 0;
  font-size: 1rem;
}

.catalog-card p {
  margin: 0.15rem 0 0;
  font-size: 0.82rem;
}

.catalog-link {
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 600;
}

.catalog-link:hover {
  text-decoration: underline;
}

.catalog-empty {
  margin: 0;
  font-size: 0.85rem;
}
</style>
