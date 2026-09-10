<script setup lang="ts">
import type { HomeQualWinner } from '@drift-index/shared';
import { useI18n } from 'vue-i18n';
import PilotAvatar from '../PilotAvatar.vue';

defineProps<{
  items: HomeQualWinner[];
}>();

const { locale, t } = useI18n();

function seriesName(item: HomeQualWinner) {
  return locale.value === 'ru' ? item.series.nameRu : item.series.nameEn;
}

function eventName(item: HomeQualWinner) {
  return locale.value === 'ru' ? item.event.nameRu : item.event.nameEn;
}
</script>

<template>
  <div class="qual-grid">
    <article v-for="item in items" :key="`${item.series.slug}-${item.event.slug}`" class="card qual-card">
      <RouterLink :to="`/pilots/${item.pilot.slug}`" class="qual-card__pilot">
        <PilotAvatar :pilot="item.pilot" size="lg" />
        <div>
          <p class="qual-card__pole">{{ t('home.pole') }}</p>
          <p class="qual-card__name">{{ item.pilot.lastName }}</p>
          <p class="muted">{{ item.pilot.firstName }}</p>
        </div>
      </RouterLink>

      <div class="qual-card__meta">
        <p class="qual-card__series">{{ seriesName(item) }}</p>
        <p class="muted">{{ eventName(item) }} · R{{ item.event.roundNumber }}</p>
        <div v-if="item.qualScore != null" class="qual-card__stats">
          <span>{{ item.qualScore.toFixed(1) }} {{ t('home.qualScore') }}</span>
          <span v-if="item.gapToSecond != null" class="muted">
            +{{ item.gapToSecond }} {{ t('home.gap') }}
          </span>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.qual-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.qual-card {
  padding: 1rem 1.15rem;
}

.qual-card__pilot {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 0.85rem;
}

.qual-card__pole {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.qual-card__name {
  margin: 0.15rem 0 0;
  font-family: Oswald, sans-serif;
  font-size: 1.15rem;
  text-transform: uppercase;
}

.qual-card__series {
  margin: 0 0 0.2rem;
  font-weight: 600;
}

.qual-card__stats {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}
</style>
