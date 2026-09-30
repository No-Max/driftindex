<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

withDefaults(
  defineProps<{
    title?: string;
  }>(),
  {
    title: 'Drift Index',
  },
);

/** Full GIF length from asset (~76 × 30ms). */
const GIF_MS = 2280;
/** How often to start a play cycle. */
const INTERVAL_MS = 5000;

const playing = ref(false);
const gifKey = ref(0);
const reduceMotion = ref(false);

let mq: MediaQueryList | null = null;
let intervalId = 0;
let hideTimer = 0;

function clearTimers() {
  if (intervalId) {
    window.clearInterval(intervalId);
    intervalId = 0;
  }
  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = 0;
  }
}

function playOnce() {
  if (reduceMotion.value) return;
  gifKey.value += 1;
  playing.value = true;
  if (hideTimer) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    playing.value = false;
    hideTimer = 0;
  }, GIF_MS);
}

function onMotionChange() {
  reduceMotion.value = mq?.matches ?? false;
  if (reduceMotion.value) {
    playing.value = false;
    clearTimers();
  } else if (!intervalId) {
    startLoop();
  }
}

function startLoop() {
  clearTimers();
  if (reduceMotion.value) return;
  // First play shortly after mount, then every INTERVAL_MS
  hideTimer = window.setTimeout(() => {
    playOnce();
    intervalId = window.setInterval(playOnce, INTERVAL_MS);
  }, INTERVAL_MS);
}

onMounted(() => {
  mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduceMotion.value = mq.matches;
  mq.addEventListener('change', onMotionChange);
  startLoop();
});

onUnmounted(() => {
  mq?.removeEventListener('change', onMotionChange);
  clearTimers();
});
</script>

<template>
  <span
    class="brand-mark"
    :class="{ 'brand-mark--playing': playing }"
    :title="title"
    role="img"
    :aria-label="title"
  >
    <img
      class="brand-mark__static"
      src="/brand/di-mark.png"
      alt=""
      width="132"
      height="137"
      decoding="async"
    />
    <img
      v-if="playing"
      class="brand-mark__gif"
      :src="`/brand/di-mark.gif?play=${gifKey}`"
      alt=""
      width="132"
      height="137"
      decoding="async"
    />
  </span>
</template>

<style scoped>
.brand-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  background: #000;
}

.brand-mark__static,
.brand-mark__gif {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
  user-select: none;
}

.brand-mark--playing .brand-mark__static {
  visibility: hidden;
}

.brand-mark__gif {
  position: relative;
  z-index: 1;
}
</style>
