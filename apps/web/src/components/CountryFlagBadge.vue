<script setup lang="ts">
import { computed, ref } from 'vue';
import { countryFlagEmoji, countryFlagSrc } from '../lib/countryFlag';

const props = defineProps<{
  country: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}>();

const imageFailed = ref(false);

const flagSrc = computed(() => countryFlagSrc(props.country, 80));
const flagEmoji = computed(() => countryFlagEmoji(props.country));
const showImage = computed(() => flagSrc.value && !imageFailed.value);
</script>

<template>
  <span
    v-if="flagEmoji || flagSrc"
    class="flag-badge"
    :class="`flag-badge--${size ?? 'md'}`"
    :title="country"
    :aria-label="country"
  >
    <img
      v-if="showImage"
      :src="flagSrc!"
      :alt="country"
      @error="imageFailed = true"
    />
    <span v-else class="flag-badge__emoji">{{ flagEmoji }}</span>
  </span>
</template>

<style scoped>
.flag-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  overflow: hidden;
  background: var(--surface-1, #fff);
  border: 2px solid var(--border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  z-index: 2;
  pointer-events: none;
}

.flag-badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.flag-badge__emoji {
  line-height: 1;
}

.flag-badge--sm {
  width: 14px;
  height: 14px;
  font-size: 0.55rem;
}

.flag-badge--md {
  width: 16px;
  height: 16px;
  font-size: 0.6rem;
}

.flag-badge--lg {
  width: 20px;
  height: 20px;
  font-size: 0.72rem;
}

.flag-badge--xl {
  width: 24px;
  height: 24px;
  font-size: 0.85rem;
}
</style>
