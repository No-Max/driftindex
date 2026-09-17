<script setup lang="ts">
import type { OverlapContribution, SeriesPrestigeEntry, SeriesPrestigeResponse } from '@drift-index/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchSeriesPrestige } from '../api/client';
import SeriesLogo from '../components/SeriesLogo.vue';
import { formatPilotName } from '../lib/formatPilotName';

const { t } = useI18n();

const prestige = ref<SeriesPrestigeResponse | null>(null);
const loading = ref(true);
const error = ref(false);
const expandedSlug = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = false;
  try {
    const year = new Date().getFullYear();
    prestige.value = await fetchSeriesPrestige(year);
  } catch {
    error.value = true;
    prestige.value = null;
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

function seriesLongName(entry: SeriesPrestigeEntry) {
  return entry.name;
}

function seriesShortName(entry: SeriesPrestigeEntry) {
  return entry.shortName ?? entry.name;
}

function seriesLogoUrl(entry: SeriesPrestigeEntry) {
  return entry.logoUrl ?? null;
}

function seriesBySlug(slug: string): SeriesPrestigeEntry | undefined {
  return prestige.value?.entries.find((item) => item.slug === slug);
}

function seriesShortNameBySlug(slug: string) {
  const entry = seriesBySlug(slug);
  return entry ? seriesShortName(entry) : slug;
}

function formatSamples(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function toggleContributions(slug: string) {
  expandedSlug.value = expandedSlug.value === slug ? null : slug;
}

function contributionPilotName(row: Pick<OverlapContribution, 'firstName' | 'lastName'>) {
  return formatPilotName(row);
}

function overlapPlaceDelta(row: OverlapContribution) {
  return Math.round((row.avgPlaceTarget - row.avgPlaceOther) * 10) / 10;
}

function formatPlace(value: number) {
  return value.toFixed(1);
}

interface GroupedOverlapContribution {
  pilotSlug: string;
  firstName: string;
  lastName: string;
  rows: OverlapContribution[];
}

function groupContributions(contributions: OverlapContribution[]): GroupedOverlapContribution[] {
  const byPilot = new Map<string, GroupedOverlapContribution>();

  for (const row of contributions) {
    const existing = byPilot.get(row.pilotSlug);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    byPilot.set(row.pilotSlug, {
      pilotSlug: row.pilotSlug,
      firstName: row.firstName,
      lastName: row.lastName,
      rows: [row],
    });
  }

  return [...byPilot.values()]
    .sort((a, b) => contributionPilotName(a).localeCompare(contributionPilotName(b), undefined, { sensitivity: 'base' }))
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) =>
        seriesShortNameBySlug(a.otherSeriesSlug).localeCompare(seriesShortNameBySlug(b.otherSeriesSlug), undefined, {
          sensitivity: 'base',
        }),
      ),
    }));
}

const prestigeColumnKeys = ['rank', 'series', 'hardness', 'samples'] as const;
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
                    <RouterLink :to="`/series/${entry.slug}`" class="series-cell-link">
                      <div class="series-cell">
                        <SeriesLogo
                          :slug="entry.slug"
                          :name="seriesLongName(entry)"
                          :logo-url="seriesLogoUrl(entry)"
                          size="md"
                        />
                        <div>
                          <strong>{{ seriesLongName(entry) }}</strong>
                          <span class="muted series-code">{{ seriesShortName(entry) }}</span>
                        </div>
                      </div>
                    </RouterLink>
                  </td>
                  <td class="muted">
                    <strong v-if="entry.hardnessScore != null">{{ entry.hardnessScore }}</strong>
                    <template v-else>—</template>
                  </td>
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
                  <td colspan="5">
                    <p class="contrib-title">{{ t('seriesPage.overlapExamples') }}</p>
                    <ul class="contrib-list">
                      <li v-for="group in groupContributions(entry.contributions)" :key="group.pilotSlug" class="contrib-group">
                        <RouterLink :to="`/pilots/${group.pilotSlug}`" class="pilot-link">
                          {{ contributionPilotName(group) }}
                        </RouterLink>
                        <ul class="contrib-sublist">
                          <li v-for="(row, index) in group.rows" :key="index" class="contrib-line">
                            {{ seriesShortNameBySlug(row.targetSeriesSlug) }}
                            <span class="contrib-num">{{ formatPlace(row.avgPlaceTarget) }}</span>
                            -
                            {{ seriesShortNameBySlug(row.otherSeriesSlug) }}
                            <span class="contrib-num">{{ formatPlace(row.avgPlaceOther) }}</span>
                            =
                            <span class="contrib-num">{{ formatPlace(overlapPlaceDelta(row)) }}</span>
                          </li>
                        </ul>
                      </li>
                    </ul>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>

          <dl class="column-legend muted">
            <div v-for="key in prestigeColumnKeys" :key="key" class="column-legend__row">
              <dt>{{ t(`seriesPage.col.${key}`) }}</dt>
              <dd>{{ t(`seriesPage.colHelp.${key}`) }}</dd>
            </div>
          </dl>
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
            <h3>{{ t('seriesPage.method.p4p.title') }}</h3>
            <p>{{ t('seriesPage.method.p4p.body') }}</p>
          </article>

          <article class="card method-card">
            <h3>{{ t('seriesPage.method.indexPoints.title') }}</h3>
            <p>{{ t('seriesPage.method.indexPoints.body') }}</p>
          </article>

          <article class="card method-card">
            <h3>{{ t('seriesPage.method.noData.title') }}</h3>
            <p>{{ t('seriesPage.method.noData.body') }}</p>
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
}

.section-lead {
  margin: 0;
  max-width: 75ch;
  line-height: 1.55;
  font-size: 1.05rem;
}

.series-cell-link {
  display: block;
  text-decoration: none;
  color: inherit;
  border-radius: 10px;
  margin: -0.25rem;
  padding: 0.25rem;
}

.series-cell-link:hover strong {
  color: var(--accent);
}

.series-cell-link:focus-visible {
  outline: 2px solid rgba(255, 77, 26, 0.45);
  outline-offset: 2px;
}

.series-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.series-code {
  display: block;
  font-size: 0.75rem;
  margin-top: 0.15rem;
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
  padding-right: 0.15rem;
  display: grid;
  gap: 0.65rem;
  font-size: 0.9rem;
  line-height: 1.45;
  max-height: 500px;
  overflow-y: auto;
  overscroll-behavior-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 77, 26, 0.45) var(--surface-2);
}

.contrib-list::-webkit-scrollbar {
  width: 6px;
}

.contrib-list::-webkit-scrollbar-track {
  margin-block: 2px;
  border-radius: 999px;
  background: var(--surface-2);
}

.contrib-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 77, 26, 0.35);
  border: 1px solid transparent;
  background-clip: padding-box;
}

.contrib-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 77, 26, 0.55);
  background-clip: padding-box;
}

.contrib-group {
  display: grid;
  gap: 0.2rem;
}

.contrib-sublist {
  margin: 0;
  padding-left: 1rem;
  display: grid;
  gap: 0.15rem;
  list-style: none;
  color: var(--muted);
}

.contrib-line {
  font-variant-numeric: tabular-nums;
}

.contrib-num {
  color: var(--accent);
  font-weight: 600;
}

.column-legend {
  margin: 0;
  padding: 1rem 1.15rem 0.2rem;
  border-top: 1px solid var(--border);
  display: grid;
  gap: 0.55rem;
}

.column-legend__row {
  display: grid;
  grid-template-columns: minmax(7rem, 11rem) 1fr;
  gap: 0.75rem 1rem;
  align-items: start;
}

.column-legend dt {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
}

.column-legend dd {
  margin: 0;
  font-size: 0.85rem;
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

</style>
