<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    slug: string;
    name: string;
    logoUrl?: string | null;
    country?: string | null;
    size?: 'sm' | 'md' | 'lg' | 'xl';
  }>(),
  {
    logoUrl: null,
    country: null,
    size: 'md',
  },
);

const fallbackLabel = computed(() => {
  if (props.country && props.country.length <= 3) return props.country;
  return props.slug.slice(0, 2).toUpperCase();
});
</script>

<template>
  <span class="series-logo" :class="`series-logo--${size}`" :title="name">
    <img v-if="logoUrl" :src="logoUrl" :alt="name" loading="lazy" decoding="async" />
    <span v-else class="series-logo__fallback">{{ fallbackLabel }}</span>
  </span>
</template>

<style scoped>
.series-logo {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  overflow: hidden;
}

.series-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.2rem;
}

.series-logo__fallback {
  font-family: Oswald, sans-serif;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.03em;
}

.series-logo--sm {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.series-logo--sm .series-logo__fallback {
  font-size: 0.62rem;
}

.series-logo--md {
  width: 40px;
  height: 40px;
}

.series-logo--md .series-logo__fallback {
  font-size: 0.78rem;
}

.series-logo--lg {
  width: 48px;
  height: 48px;
}

.series-logo--lg .series-logo__fallback {
  font-size: 0.85rem;
}

.series-logo--xl {
  width: 64px;
  height: 64px;
  border-radius: 14px;
}

.series-logo--xl .series-logo__fallback {
  font-size: 1rem;
}
</style>
