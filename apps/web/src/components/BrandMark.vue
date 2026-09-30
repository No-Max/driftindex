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
const gifSrc = ref('/brand/di-mark.gif');
const gifReady = ref(false);
const reduceMotion = ref(false);

let mq: MediaQueryList | null = null;
let intervalId = 0;
let hideTimer = 0;
let playKey = 0;

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

function restartGif() {
  playKey += 1;
  gifReady.value = false;
  gifSrc.value = `/brand/di-mark.gif?play=${playKey}`;
}

function onGifLoad() {
  if (reduceMotion.value) return;
  // Ignore stale loads from a previous cycle.
  if (!gifSrc.value.includes(`play=${playKey}`)) return;
  gifReady.value = true;
  playing.value = true;
  if (hideTimer) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    playing.value = false;
    hideTimer = 0;
  }, GIF_MS);
}

function playOnce() {
  if (reduceMotion.value) return;
  restartGif();
}

function onMotionChange() {
  reduceMotion.value = mq?.matches ?? false;
  if (reduceMotion.value) {
    playing.value = false;
    gifReady.value = false;
    clearTimers();
  } else if (!intervalId) {
    startLoop();
  }
}

function startLoop() {
  clearTimers();
  if (reduceMotion.value) return;
  hideTimer = window.setTimeout(() => {
    playOnce();
    intervalId = window.setInterval(playOnce, INTERVAL_MS);
  }, INTERVAL_MS);
}

onMounted(() => {
  mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduceMotion.value = mq.matches;
  mq.addEventListener('change', onMotionChange);
  // Warm the GIF into browser cache so the first opacity swap is clean.
  const warm = new Image();
  warm.src = '/brand/di-mark.gif';
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
      class="brand-mark__gif"
      :class="{ 'brand-mark__gif--ready': gifReady }"
      :src="gifSrc"
      alt=""
      width="132"
      height="137"
      decoding="async"
      @load="onGifLoad"
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

.brand-mark__static {
  position: relative;
  z-index: 1;
  opacity: 1;
}

.brand-mark__gif {
  position: relative;
  z-index: 0;
  opacity: 0;
}

.brand-mark--playing .brand-mark__static {
  opacity: 0;
}

.brand-mark--playing .brand-mark__gif--ready {
  z-index: 2;
  opacity: 1;
}
</style>
