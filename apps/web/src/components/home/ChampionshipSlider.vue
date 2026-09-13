<script setup lang="ts">
import type { HomeChampionshipCard } from '@drift-index/shared';
import { useI18n } from 'vue-i18n';
import PilotAvatar from '../PilotAvatar.vue';

defineProps<{
  items: HomeChampionshipCard[];
}>();

const { t } = useI18n();

function seriesName(item: HomeChampionshipCard) {
  return item.series.name;
}
</script>

<template>
  <div class="slider">
    <article v-for="item in items" :key="item.series.slug" class="card champ-card">
      <RouterLink :to="item.standingsPath" class="champ-card__link">
        <div class="champ-card__head">
          <div class="champ-card__logo">{{ item.series.country ?? 'INT' }}</div>
          <div>
            <p class="muted">{{ item.seasonYear }}</p>
            <h3>{{ seriesName(item) }}</h3>
          </div>
        </div>

        <div v-if="item.leader" class="champ-card__leader">
          <PilotAvatar :pilot="item.leader" size="lg" />
          <div>
            <p class="champ-card__leader-label">{{ t('home.champion') }}</p>
            <p class="champ-card__leader-name">{{ item.leader.lastName }}</p>
            <p class="muted">{{ item.leader.firstName }}</p>
          </div>
        </div>
        <p v-else class="muted">{{ t('home.noLeader') }}</p>
      </RouterLink>
    </article>
  </div>
</template>

<style scoped>
.slider {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(280px, 1fr);
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  scroll-snap-type: x mandatory;
}

.champ-card__link {
  display: block;
  padding: 1.25rem;
  min-height: 180px;
}

.champ-card__head {
  display: flex;
  gap: 0.85rem;
  align-items: center;
  margin-bottom: 1.25rem;
}

.champ-card__logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-family: Oswald, sans-serif;
  font-weight: 600;
  color: var(--accent);
}

.champ-card h3 {
  margin: 0.15rem 0 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  font-size: 1.05rem;
}

.champ-card__leader {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.champ-card__leader-label {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.champ-card__leader-name {
  margin: 0.15rem 0 0;
  font-family: Oswald, sans-serif;
  font-size: 1.25rem;
  text-transform: uppercase;
}
</style>
