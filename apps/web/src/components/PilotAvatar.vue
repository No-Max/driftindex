<script setup lang="ts">
import type { PilotSummary } from '@drift-index/shared';
import { computed } from 'vue';

const props = defineProps<{
  pilot: PilotSummary;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}>();

const initials = computed(() =>
  `${props.pilot.firstName[0] ?? ''}${props.pilot.lastName[0] ?? ''}`.toUpperCase(),
);
</script>

<template>
  <div class="avatar" :class="`avatar--${size ?? 'md'}`">
    <img v-if="pilot.photoUrl" :src="pilot.photoUrl" :alt="pilot.lastName" />
    <span v-else>{{ initials }}</span>
  </div>
</template>

<style scoped>
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
  width: 36px;
  height: 36px;
  font-size: 0.75rem;
}

.avatar--md {
  width: 48px;
  height: 48px;
  font-size: 0.9rem;
}

.avatar--lg {
  width: 72px;
  height: 72px;
  font-size: 1.1rem;
}

.avatar--xl {
  width: 96px;
  height: 96px;
  font-size: 1.4rem;
}
</style>
