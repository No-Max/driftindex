<script setup lang="ts">
import type { HomeP4PEntry, HomeP4PSeriesParticipation } from '@drift-index/shared';
import { seriesEventPath } from '@drift-index/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatAvgPlaceRange } from '../../lib/formatAvgPlace';
import { formatPilotName } from '../../lib/formatPilotName';
import { formatQualCell } from '../../lib/formatQualCell';
import PilotAvatar from '../PilotAvatar.vue';
import PilotStatsGrid from '../PilotStatsGrid.vue';
import SeriesLogo from '../SeriesLogo.vue';

const props = defineProps<{
  items: HomeP4PEntry[];
  year: number;
}>();

const { t, locale } = useI18n();

const leader = computed(() => props.items.find((item) => item.rank === 1));
const rest = computed(() => props.items.filter((item) => item.rank > 1));

function seriesName(item: HomeP4PEntry) {
  return item.bestSeries.name;
}

function seriesPath(slug: string) {
  return `/series/${slug}/${props.year}`;
}

function isFeatured(rank: number) {
  return rank === 2 || rank === 3;
}

function seriesMeta(series: HomeP4PSeriesParticipation) {
  const parts = [
    t('home.p4pAvgPlace', { place: formatAvgPlaceRange(series.place) }),
  ];
  if (series.avgQualScore != null) {
    parts.push(t('home.p4pAvgQual', { score: series.avgQualScore.toFixed(1) }));
  }
  return parts.join(' · ');
}

function bestSeriesMeta(item: HomeP4PEntry) {
  return seriesMeta(item.bestSeries);
}

function formatQual(
  score: number | null,
  place: number | null,
) {
  return formatQualCell(score, place, locale.value);
}

function seriesLabel(event: HomeP4PEntry['seasonEvents'][number]) {
  return event.seriesShortName ?? event.seriesName;
}

function eventPath(event: HomeP4PEntry['seasonEvents'][number]) {
  return seriesEventPath(event.seriesSlug, props.year, event.eventSlug);
}

</script>

<template>
  <div v-if="leader" class="p4p">
    <article class="card p4p-leader">
      <span class="p4p-leader__rank">1</span>
      <div class="p4p-leader__body">
        <RouterLink :to="`/pilots/${leader.pilot.slug}`" class="p4p-leader__pilot-link">
          <PilotAvatar :pilot="leader.pilot" size="2xl" />
        </RouterLink>
        <div class="p4p-leader__info">
          <p class="p4p-leader__label">{{ t('home.p4pLeader') }}</p>
          <RouterLink :to="`/pilots/${leader.pilot.slug}`" class="p4p-leader__name-link">
            <p class="p4p-leader__name">{{ formatPilotName(leader.pilot) }}</p>
          </RouterLink>
          <p class="p4p-leader__score">{{ leader.score }} {{ t('home.p4pScore') }}</p>
          <div class="p4p-leader__series-block">
            <div class="p4p-leader__series-item p4p-leader__series-item--primary">
              <SeriesLogo
                :slug="leader.bestSeries.slug"
                :name="leader.bestSeries.name"
                :logo-url="leader.bestSeries.logoUrl"
                size="sm"
              />
              <RouterLink :to="seriesPath(leader.bestSeries.slug)" class="p4p-series-link">
                {{ seriesName(leader) }}
              </RouterLink>
              <span> · {{ bestSeriesMeta(leader) }}</span>
              <span class="muted">· {{ t('pilots.hardnessShort') }} {{ leader.bestSeries.weight }}</span>
            </div>
          </div>
          <div v-if="leader.otherSeries.length > 0" class="p4p-leader__other-series">
            <p class="p4p-leader__other-series-title">{{ t('home.p4pOtherSeries') }}</p>
            <ul class="p4p-leader__other-series-list">
              <li
                v-for="series in leader.otherSeries"
                :key="series.slug"
                class="p4p-leader__series-item"
              >
                <SeriesLogo
                  :slug="series.slug"
                  :name="series.name"
                  :logo-url="series.logoUrl"
                  size="sm"
                />
                <RouterLink :to="seriesPath(series.slug)" class="p4p-series-link">
                  {{ series.name }}
                </RouterLink>
                <span> · {{ seriesMeta(series) }}</span>
                <span class="muted">· {{ t('pilots.hardnessShort') }} {{ series.weight }}</span>
              </li>
            </ul>
          </div>
          <PilotStatsGrid
            v-if="leader.pilot.stats"
            :stats="leader.pilot.stats"
            compact
            class="p4p-leader__stats"
          />
          <div v-if="leader.seasonEvents.length > 0" class="p4p-leader__events">
            <p class="p4p-leader__events-title">{{ t('home.p4pSeasonEvents') }}</p>
            <div class="p4p-leader__events-table">
              <table>
                <thead>
                  <tr>
                    <th>{{ t('home.p4pColSeries') }}</th>
                    <th>{{ t('home.p4pColRound') }}</th>
                    <th>{{ t('pilot.place') }}</th>
                    <th>{{ t('pilot.qual') }}</th>
                    <th>{{ t('pilot.points') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="event in leader.seasonEvents"
                    :key="`${event.seriesSlug}-${event.eventSlug}`"
                  >
                    <td class="p4p-leader__events-series">
                      <RouterLink :to="seriesPath(event.seriesSlug)" class="p4p-series-link">
                        {{ seriesLabel(event) }}
                      </RouterLink>
                    </td>
                    <td class="muted">
                      <RouterLink :to="eventPath(event)" class="p4p-series-link">
                        {{ t('standings.round', { n: event.roundNumber }) }}
                      </RouterLink>
                    </td>
                    <td><strong>{{ event.eventPlace ?? '—' }}</strong></td>
                    <td class="muted">{{ formatQual(event.qualScore100, event.qualPosition) }}</td>
                    <td><strong>{{ event.points }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </article>

    <ol class="p4p-list">
      <li
        v-for="item in rest"
        :key="item.pilot.slug"
        class="p4p-list__item"
        :class="isFeatured(item.rank) ? 'p4p-list__item--featured' : 'p4p-list__item--compact'"
      >
        <div class="p4p-list__link">
          <RouterLink :to="`/pilots/${item.pilot.slug}`" class="p4p-list__rank">
            {{ item.rank }}
          </RouterLink>
          <RouterLink :to="`/pilots/${item.pilot.slug}`" class="p4p-list__avatar-link">
            <PilotAvatar :pilot="item.pilot" :size="isFeatured(item.rank) ? 'xl' : 'md'" />
          </RouterLink>
          <div class="p4p-list__body">
            <RouterLink :to="`/pilots/${item.pilot.slug}`" class="p4p-list__name-link">
              <p class="p4p-list__name">{{ formatPilotName(item.pilot) }}</p>
            </RouterLink>
            <p class="p4p-list__series">
              <SeriesLogo
                :slug="item.bestSeries.slug"
                :name="item.bestSeries.name"
                :logo-url="item.bestSeries.logoUrl"
                size="sm"
              />
              <RouterLink :to="seriesPath(item.bestSeries.slug)" class="p4p-series-link">
                {{ seriesName(item) }}
              </RouterLink>
              <span> · {{ bestSeriesMeta(item) }}</span>
            </p>
            <p class="p4p-list__meta">
              <RouterLink :to="`/pilots/${item.pilot.slug}`" class="p4p-list__score">
                {{ item.score }} {{ t('home.p4pScore') }}
              </RouterLink>
              <template v-if="item.pilot.stats && isFeatured(item.rank)">
                <span>{{ item.pilot.stats.eventsCount }} {{ t('pilot.stats.eventsShort') }}</span>
                <span v-if="item.pilot.stats.avgQualScore != null">
                  {{ item.pilot.stats.avgQualScore.toFixed(1) }} {{ t('pilot.stats.qualShort') }}
                </span>
              </template>
            </p>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.p4p {
  display: grid;
  grid-template-columns: minmax(360px, 480px) 1fr;
  gap: 1.25rem;
  align-items: stretch;
}

.p4p-leader {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 1.25rem;
  overflow: hidden;
  border-color: rgba(255, 77, 26, 0.35);
  background: linear-gradient(160deg, rgba(255, 77, 26, 0.1), var(--surface));
}

.p4p-leader__rank {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  font-size: 3.25rem;
  font-style: normal;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--accent);
  opacity: 0.9;
}

.p4p-leader__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
  width: 100%;
  min-height: 0;
  padding: 0;
}

.p4p-leader__pilot-link,
.p4p-leader__name-link {
  color: inherit;
  text-decoration: none;
}

.p4p-leader__pilot-link:hover,
.p4p-leader__name-link:hover {
  color: var(--accent);
}

.p4p-leader__name-link {
  display: inline-block;
}

.p4p-leader__info {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}

.p4p-leader__label {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
}

.p4p-leader__name {
  margin: 0.35rem 0 0;
  font-family: Oswald, sans-serif;
  font-size: clamp(1.6rem, 3vw, 2rem);
  text-transform: uppercase;
  line-height: 1.1;
}

.p4p-leader__score {
  margin: 0.75rem 0 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--accent);
}

.p4p-leader__series-block {
  width: 100%;
  margin-top: 0.85rem;
  text-align: left;
}

.p4p-leader__other-series {
  width: 100%;
  margin-top: 0.85rem;
  text-align: left;
}

.p4p-leader__other-series-title {
  margin: 0 0 0.45rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.p4p-leader__other-series-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
}

.p4p-leader__series-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.12);
  font-size: 0.85rem;
}

.p4p-leader__series-item--primary {
  border-color: rgba(255, 77, 26, 0.45);
  box-shadow: 0 0 0 1px rgba(255, 77, 26, 0.12);
}

.p4p-series-link {
  color: inherit;
  text-decoration: none;
}

.p4p-series-link:hover {
  color: var(--accent);
}

.p4p-leader__stats {
  width: 100%;
  margin-top: 1rem;
}

.p4p-leader__events {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  margin-top: 1rem;
  text-align: left;
}

.p4p-leader__events-title {
  margin: 0 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.p4p-leader__events-table {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.15);
  overflow: auto;
}

.p4p-leader__events-table th,
.p4p-leader__events-table td {
  padding: 0.45rem 0.55rem;
  font-size: 0.82rem;
}

.p4p-leader__events-series {
  max-width: 5.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p4p-leader__events-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-2);
}

.p4p-leader__events-table tbody tr:last-child td {
  border-bottom: 0;
}

.p4p-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
  height: 100%;
  align-content: start;
}

.p4p-list__item {
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  overflow: hidden;
  transition: border-color 0.15s;
  min-width: 0;
}

.p4p-list__item:hover {
  border-color: rgba(255, 77, 26, 0.35);
}

.p4p-list__item--featured {
  background: var(--surface-2);
}

.p4p-list__link {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  min-width: 0;
}

.p4p-list__item--compact .p4p-list__link {
  gap: 0.75rem;
  padding: 0.65rem 0.9rem;
}

.p4p-list__item--compact .p4p-list__rank {
  top: 0.65rem;
  right: 0.9rem;
}

.p4p-list__rank,
.p4p-list__avatar-link,
.p4p-list__name-link,
.p4p-list__score {
  color: inherit;
  text-decoration: none;
}

.p4p-list__rank {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 1;
  font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  font-size: 1.4rem;
  font-weight: 700;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--accent);
  opacity: 0.9;
}

.p4p-list__avatar-link,
.p4p-list__name-link:hover,
.p4p-list__score:hover {
  color: var(--accent);
}

.p4p-list__item--featured .p4p-list__rank {
  font-size: 1.85rem;
}

.p4p-list__item--featured :deep(.avatar--xl) {
  width: 90px;
  height: 90px;
  font-size: 1.17rem;
}

.p4p-list__body {
  min-width: 0;
  max-width: 100%;
  padding-right: 2rem;
  overflow: hidden;
}

.p4p-list__item--featured .p4p-list__body {
  padding-right: 2.5rem;
}

.p4p-list__name-link {
  display: block;
  min-width: 0;
  max-width: 100%;
}

.p4p-list__name {
  margin: 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p4p-list__item--featured .p4p-list__name {
  font-size: 1.15rem;
}

.p4p-list__item--compact .p4p-list__name {
  font-size: 0.92rem;
}

.p4p-list__series {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  color: var(--muted);
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.p4p-list__series .p4p-series-link,
.p4p-list__series > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p4p-list__series .p4p-series-link {
  flex-shrink: 1;
}

.p4p-list__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: var(--muted);
  max-width: 100%;
  min-width: 0;
}

.p4p-list__meta > span,
.p4p-list__meta .p4p-list__score {
  min-width: 0;
  max-width: 100%;
}

.p4p-list__item--compact .p4p-list__series {
  font-size: 0.72rem;
}

.p4p-list__meta .p4p-list__score {
  font-weight: 700;
  color: var(--accent);
  font-size: 0.72rem;
}

.p4p-list__item--featured .p4p-list__meta .p4p-list__score {
  font-size: 0.78rem;
}

@media (max-width: 1023px) {
  .p4p-leader__events {
    display: none;
  }
}

@media (max-width: 1200px) {
  .p4p {
    grid-template-columns: 1fr;
  }

  .p4p-leader__body {
    flex-direction: row;
    align-items: flex-start;
    text-align: left;
    gap: 1rem;
    padding: 0;
  }

  .p4p-leader__pilot-link {
    flex-shrink: 0;
  }

  .p4p-leader__info {
    flex: 1;
    min-width: 0;
  }

}

@media (max-width: 768px) {
  .p4p-leader {
    padding: 1.25rem;
  }

  .p4p-leader__body {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.85rem;
    padding: 0;
  }

  .p4p-leader__info {
    width: 100%;
  }

  .p4p-leader__events-table {
    max-height: 220px;
  }

  .p4p-list__link {
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.65rem 0.75rem;
  }

  .p4p-list__item--compact .p4p-list__link {
    padding: 0.55rem 0.75rem;
  }

  .p4p-list__rank {
    top: 0.65rem;
    right: 0.75rem;
  }

  .p4p-list__item--compact .p4p-list__rank {
    top: 0.55rem;
    right: 0.75rem;
  }

  .p4p-list__body {
    padding-right: 2.25rem;
    overflow: visible;
  }

  .p4p-list__item--featured .p4p-list__body {
    padding-right: 2.75rem;
  }

  .p4p-list__name {
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    overflow-wrap: anywhere;
  }

  .p4p-list__series {
    flex-wrap: wrap;
    row-gap: 0.2rem;
    overflow: visible;
  }

  .p4p-list__series .p4p-series-link,
  .p4p-list__series > span {
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    overflow-wrap: anywhere;
  }

  .p4p-list__meta > span,
  .p4p-list__meta .p4p-list__score {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .p4p-list__item--featured :deep(.avatar--xl) {
    width: 72px;
    height: 72px;
    font-size: 1rem;
  }
}
</style>
