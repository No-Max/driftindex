<script setup lang="ts">
import type { HomeP4PEntry } from '@drift-index/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatAvgPlaceRange } from '../../lib/formatAvgPlace';
import PilotAvatar from '../PilotAvatar.vue';
import PilotStatsGrid from '../PilotStatsGrid.vue';

const props = defineProps<{
  items: HomeP4PEntry[];
}>();

const { t } = useI18n();

const leader = computed(() => props.items.find((item) => item.rank === 1));
const rest = computed(() => props.items.filter((item) => item.rank > 1));

function seriesName(item: HomeP4PEntry) {
  return item.bestSeries.name;
}

function isFeatured(rank: number) {
  return rank === 2 || rank === 3;
}

function bestSeriesSummary(item: HomeP4PEntry) {
  const parts = [
    seriesName(item),
    t('home.p4pAvgPlace', { place: formatAvgPlaceRange(item.bestSeries.place) }),
  ];
  if (item.bestSeries.avgQualScore != null) {
    parts.push(t('home.p4pAvgQual', { score: item.bestSeries.avgQualScore.toFixed(1) }));
  }
  return parts.join(' · ');
}
</script>

<template>
  <div v-if="leader" class="p4p">
    <article class="card p4p-leader">
      <span class="p4p-leader__rank">#1</span>
      <RouterLink :to="`/pilots/${leader.pilot.slug}`" class="p4p-leader__link">
        <PilotAvatar :pilot="leader.pilot" size="xl" />
        <div class="p4p-leader__info">
          <p class="p4p-leader__label">{{ t('home.p4pLeader') }}</p>
          <p class="p4p-leader__name">{{ leader.pilot.lastName }}</p>
          <p class="muted">{{ leader.pilot.firstName }}</p>
          <p class="p4p-leader__score">{{ leader.score }} {{ t('home.p4pScore') }}</p>
          <p class="p4p-leader__series">
            {{ bestSeriesSummary(leader) }}
            <span class="muted">· hardness {{ leader.bestSeries.weight }}</span>
          </p>
          <PilotStatsGrid
            v-if="leader.pilot.stats"
            :stats="leader.pilot.stats"
            compact
            class="p4p-leader__stats"
          />
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
          <PilotAvatar :pilot="item.pilot" :size="isFeatured(item.rank) ? 'lg' : 'sm'" />
          <div class="p4p-list__body">
            <p class="p4p-list__name">{{ item.pilot.lastName }}</p>
            <p v-if="isFeatured(item.rank)" class="muted">{{ item.pilot.firstName }}</p>
            <p class="p4p-list__series">
              {{ bestSeriesSummary(item) }}
            </p>
            <p v-if="item.pilot.stats && isFeatured(item.rank)" class="p4p-list__meta">
              <span v-if="item.pilot.stats.tandemBattles > 0">
                {{ item.pilot.stats.tandemBattles }}/{{ item.pilot.stats.tandemWins }}
                ({{ item.pilot.stats.tandemWinPct }}%) {{ t('pilot.stats.duelsShort') }}
              </span>
              <span v-else>— {{ t('pilot.stats.duelsShort') }}</span>
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
  grid-template-columns: minmax(260px, 340px) 1fr;
  gap: 1rem;
  align-items: start;
}

.p4p-leader {
  position: relative;
  padding: 1.5rem;
  min-height: 100%;
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
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
  min-height: 420px;
  justify-content: center;
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
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
}

.p4p-leader__stats {
  width: 100%;
  margin-top: 1rem;
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
  gap: 0.65rem;
  padding: 0.55rem 0.85rem;
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
    min-height: auto;
    padding: 0.5rem 0;
  }
}
</style>
