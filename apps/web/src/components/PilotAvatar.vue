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
      <div class="avatar__inner">
        <img v-if="pilot.photoUrl" :src="pilot.photoUrl" :alt="formatPilotName(pilot)" />
        <span v-else>{{ initials }}</span>
      </div>
      <CountryFlagBadge v-if="pilot.country" :country="pilot.country" :size="size ?? 'md'" />
    </div>
  </div>
</template>

<style scoped>
.avatar-wrap {
  display: inline-flex;
  flex-shrink: 0;
  align-self: flex-start;
  width: fit-content;
  height: fit-content;
}

.avatar {
  position: relative;
  box-sizing: border-box;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: visible;
  background: var(--surface-2);
  border: 2px solid var(--border);
  color: var(--accent);
  font-family: Oswald, sans-serif;
  font-weight: 600;
}

.avatar__inner {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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
