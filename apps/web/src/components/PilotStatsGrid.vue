<script setup lang="ts">
import type { PilotStats } from '@drift-index/shared';
import { useI18n } from 'vue-i18n';

defineProps<{
  stats: PilotStats;
  compact?: boolean;
}>();

const { t } = useI18n();

function formatQual(value: number | null) {
  if (value == null) return '—';
  return value.toFixed(1);
}
</script>

<template>
  <dl class="stats" :class="{ 'stats--compact': compact }">
    <div class="stats__item">
      <dt>{{ t('pilot.stats.events') }}</dt>
      <dd>{{ stats.eventsCount }}</dd>
    </div>
    <div class="stats__item">
      <dt>{{ t('pilot.stats.seasons') }}</dt>
      <dd>{{ stats.seasonsCount }}</dd>
    </div>
    <div class="stats__item">
      <dt>{{ t('pilot.stats.avgQual') }}</dt>
      <dd>{{ formatQual(stats.avgQualScore) }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0;
  min-width: 0;
}

.stats__item {
  min-width: 0;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.stats__item dt {
  margin: 0;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats__item dd {
  margin: 0.35rem 0 0;
  font-family: Oswald, sans-serif;
  font-size: 1.25rem;
  color: var(--accent);
}

.stats--compact .stats__item dd {
  font-size: 1rem;
}

.stats--compact .stats__item {
  padding: 0.55rem 0.45rem;
}

.stats--compact .stats__item dt {
  font-size: 0.62rem;
  letter-spacing: 0.04em;
}
</style>
