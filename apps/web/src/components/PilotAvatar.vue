<script setup lang="ts">
import type { PilotSummary } from '@drift-index/shared';
import { computed } from 'vue';
import { formatPilotName } from '../lib/formatPilotName';
import CountryFlagBadge from './CountryFlagBadge.vue';

const props = defineProps<{
  pilot: PilotSummary;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}>();

const initials = computed(() =>
  `${props.pilot.firstName[0] ?? ''}${props.pilot.lastName[0] ?? ''}`.toUpperCase(),
);
</script>

<template>
  <div class="avatar-wrap">
    <div class="avatar" :class="`avatar--${size ?? 'md'}`">
      <img v-if="pilot.photoUrl" :src="pilot.photoUrl" :alt="formatPilotName(pilot)" />
      <span v-else>{{ initials }}</span>
    </div>
    <CountryFlagBadge v-if="pilot.country" :country="pilot.country" :size="size ?? 'md'" />
  </div>
</template>

<style scoped>
.avatar-wrap {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.avatar {
  display: grid;
  place-items: center;
  border-radius: 50%;
  overflow: hidden;
  background: var(--surface-2);
  border: 2px solid var(--border);
  color: var(--accent);
  font-family: Oswald, sans-serif;
  font-weight: 600;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar--sm {
  width: 40px;
  height: 40px;
  font-size: 0.78rem;
}

.avatar--md {
  width: 54px;
  height: 54px;
  font-size: 0.95rem;
}

.avatar--lg {
  width: 84px;
  height: 84px;
  font-size: 1.15rem;
}

.avatar--xl {
  width: 112px;
  height: 112px;
  font-size: 1.45rem;
}

.avatar--2xl {
  width: 136px;
  height: 136px;
  font-size: 1.75rem;
}
</style>
