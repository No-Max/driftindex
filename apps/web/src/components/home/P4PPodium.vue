<script setup lang="ts">
import type { HomeP4PEntry, HomeP4PSeriesParticipation } from '@drift-index/shared';
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
}>();

const { t, locale } = useI18n();

const leader = computed(() => props.items.find((item) => item.rank === 1));
const rest = computed(() => props.items.filter((item) => item.rank > 1));

function seriesName(item: HomeP4PEntry) {
  return item.bestSeries.name;
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

</script>

<template>
  <div v-if="leader" class="p4p">
    <article class="card p4p-leader">
      <span class="p4p-leader__rank">#1</span>
      <RouterLink :to="`/pilots/${leader.pilot.slug}`" class="p4p-leader__link">
        <PilotAvatar :pilot="leader.pilot" size="2xl" />
        <div class="p4p-leader__info">
          <p class="p4p-leader__label">{{ t('home.p4pLeader') }}</p>
          <p class="p4p-leader__name">{{ formatPilotName(leader.pilot) }}</p>
          <p class="p4p-leader__score">{{ leader.score }} {{ t('home.p4pScore') }}</p>
          <p class="p4p-leader__series">
            <SeriesLogo
              :slug="leader.bestSeries.slug"
              :name="leader.bestSeries.name"
              :logo-url="leader.bestSeries.logoUrl"
              size="sm"
            />
            <span>{{ seriesName(leader) }} · {{ bestSeriesMeta(leader) }}</span>
            <span class="muted">· hardness {{ leader.bestSeries.weight }}</span>
          </p>
          <div v-if="leader.otherSeries.length > 0" class="p4p-leader__other-series">
            <p class="p4p-leader__other-series-title">{{ t('home.p4pOtherSeries') }}</p>
            <ul class="p4p-leader__other-series-list">
              <li
                v-for="series in leader.otherSeries"
                :key="series.slug"
                class="p4p-leader__other-series-item"
              >
                <SeriesLogo
                  :slug="series.slug"
                  :name="series.name"
                  :logo-url="series.logoUrl"
                  size="sm"
                />
                <span>{{ series.name }} · {{ seriesMeta(series) }}</span>
                <span class="muted">· hardness {{ series.weight }}</span>
              </li>
            </ul>
          </div>
          <PilotStatsGrid
            v-if="leader.pilot.stats"
            :stats="leader.pilot.stats"
            compact
            class="p4p-leader__stats"
          />
          <div v-if="leader.bestSeriesEvents.length > 0" class="p4p-leader__events">
            <p class="p4p-leader__events-title">{{ t('home.p4pSeasonEvents') }}</p>
            <div class="p4p-leader__events-table">
              <table>
                <thead>
                  <tr>
                    <th>{{ t('home.p4pColRound') }}</th>
                    <th>{{ t('pilot.place') }}</th>
                    <th>{{ t('pilot.qual') }}</th>
                    <th>{{ t('pilot.points') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="event in leader.bestSeriesEvents" :key="event.roundNumber">
                    <td class="muted">{{ t('standings.round', { n: event.roundNumber }) }}</td>
                    <td><strong>{{ event.eventPlace ?? '—' }}</strong></td>
                    <td class="muted">{{ formatQual(event.qualScore100, event.qualPosition) }}</td>
                    <td><strong>{{ event.points }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </RouterLink>
    </article>

    <ol class="p4p-list">
      <li
        v-for="item in rest"
        :key="item.pilot.slug"
        class="p4p-list__item"
        :class="isFeatured(item.rank) ? 'p4p-list__item--featured' : 'p4p-list__item--compact'"
      >
        <RouterLink :to="`/pilots/${item.pilot.slug}`" class="p4p-list__link">
          <span class="p4p-list__rank">{{ item.rank }}</span>
          <PilotAvatar :pilot="item.pilot" :size="isFeatured(item.rank) ? 'xl' : 'md'" />
          <div class="p4p-list__body">
            <p class="p4p-list__name">{{ formatPilotName(item.pilot) }}</p>
            <p class="p4p-list__series">
              <SeriesLogo
                :slug="item.bestSeries.slug"
                :name="item.bestSeries.name"
                :logo-url="item.bestSeries.logoUrl"
                size="sm"
              />
              <span>{{ seriesName(item) }} · {{ bestSeriesMeta(item) }}</span>
            </p>
            <p v-if="item.pilot.stats && isFeatured(item.rank)" class="p4p-list__meta">
              <span>{{ item.pilot.stats.eventsCount }} {{ t('pilot.stats.eventsShort') }}</span>
              <span v-if="item.pilot.stats.avgQualScore != null">
                {{ item.pilot.stats.avgQualScore.toFixed(1) }} {{ t('pilot.stats.qualShort') }}
              </span>
            </p>
          </div>
          <span class="p4p-list__score">{{ item.score }}</span>
        </RouterLink>
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
  padding: 1.75rem 2rem;
  overflow: visible;
  border-color: rgba(255, 77, 26, 0.35);
  background: linear-gradient(160deg, rgba(255, 77, 26, 0.1), var(--surface));
}

.p4p-leader__rank {
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-family: Oswald, sans-serif;
  font-size: 2.5rem;
  line-height: 1;
  color: var(--accent);
  opacity: 0.9;
}

.p4p-leader__link {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
  width: 100%;
  min-height: 100%;
  padding-top: 0.5rem;
}

.p4p-leader__info {
  width: 100%;
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

.p4p-leader__series {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
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

.p4p-leader__other-series-item {
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

.p4p-leader__stats {
  width: 100%;
  margin-top: 1rem;
}

.p4p-leader__events {
  width: 100%;
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
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.15);
  overflow-x: auto;
}

.p4p-leader__events-table th,
.p4p-leader__events-table td {
  padding: 0.45rem 0.55rem;
  font-size: 0.82rem;
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
  align-content: start;
}

.p4p-list__item {
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  overflow: hidden;
  transition: border-color 0.15s;
}

.p4p-list__item:hover {
  border-color: rgba(255, 77, 26, 0.35);
}

.p4p-list__item--featured {
  background: var(--surface-2);
}

.p4p-list__link {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
}

.p4p-list__item--compact .p4p-list__link {
  gap: 0.75rem;
  padding: 0.65rem 0.9rem;
}

.p4p-list__rank {
  font-family: Oswald, sans-serif;
  font-size: 1.1rem;
  color: var(--accent);
  min-width: 1.5rem;
  text-align: center;
}

.p4p-list__item--featured .p4p-list__rank {
  font-size: 1.35rem;
}

.p4p-list__body {
  min-width: 0;
}

.p4p-list__name {
  margin: 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  font-size: 1rem;
}

.p4p-list__item--featured .p4p-list__name {
  font-size: 1.15rem;
}

.p4p-list__item--compact .p4p-list__name {
  font-size: 0.92rem;
}

.p4p-list__series {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p4p-list__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: var(--muted);
}

.p4p-list__item--compact .p4p-list__series {
  font-size: 0.72rem;
}

.p4p-list__score {
  font-weight: 700;
  color: var(--accent);
  font-size: 0.95rem;
}

.p4p-list__item--featured .p4p-list__score {
  font-size: 1.05rem;
}

@media (max-width: 860px) {
  .p4p {
    grid-template-columns: 1fr;
  }

  .p4p-leader__link {
    padding: 0.5rem 0;
  }
}
</style>
