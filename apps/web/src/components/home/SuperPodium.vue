<script setup lang="ts">
import type { HomeSuperPodiumEntry } from '@drift-index/shared';
import PilotAvatar from '../PilotAvatar.vue';

defineProps<{
  items: HomeSuperPodiumEntry[];
}>();

function seriesName(item: HomeSuperPodiumEntry) {
  return item.series.name;
}
</script>

<template>
  <div class="podium-grid">
    <RouterLink
      v-for="item in items"
      :key="item.series.slug"
      :to="`/pilots/${item.pilot.slug}`"
      class="card podium-card"
    >
      <PilotAvatar :pilot="item.pilot" size="xl" />
      <p class="podium-card__series">{{ seriesName(item) }}</p>
      <p class="podium-card__name">{{ item.pilot.lastName }}</p>
      <p class="muted">{{ item.pilot.firstName }}</p>
      <p class="podium-card__points">{{ item.totalPoints }} pts</p>
    </RouterLink>
  </div>
</template>

<style scoped>
.podium-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.podium-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.25rem 1rem;
  transition: border-color 0.15s, transform 0.15s;
}

.podium-card:hover {
  border-color: rgba(255, 77, 26, 0.45);
  transform: translateY(-2px);
}

.podium-card__series {
  margin: 0.85rem 0 0.35rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.podium-card__name {
  margin: 0;
  font-family: Oswald, sans-serif;
  font-size: 1.15rem;
  text-transform: uppercase;
}

.podium-card__points {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: var(--muted);
}
</style>
