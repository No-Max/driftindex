<script setup lang="ts">
import type { TrackPhoto } from '@drift-index/shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  photos: TrackPhoto[];
  alt: string;
}>();

const { t } = useI18n();
const index = ref(0);

const current = computed(() => props.photos[index.value] ?? null);
const hasMultiple = computed(() => props.photos.length > 1);

function go(delta: number) {
  const n = props.photos.length;
  if (n <= 1) return;
  index.value = (index.value + delta + n) % n;
}

function goTo(i: number) {
  index.value = i;
}
</script>

<template>
  <div class="slider">
    <template v-if="current">
      <img :src="current.photoUrl" :alt="alt" class="slider__img" />
      <template v-if="hasMultiple">
        <button type="button" class="slider__nav slider__nav--prev" :aria-label="t('tracks.photoPrev')" @click="go(-1)">
          ‹
        </button>
        <button type="button" class="slider__nav slider__nav--next" :aria-label="t('tracks.photoNext')" @click="go(1)">
          ›
        </button>
        <div class="slider__dots" role="tablist" :aria-label="t('tracks.photoGallery')">
          <button
            v-for="(_, i) in photos"
            :key="i"
            type="button"
            class="slider__dot"
            :class="{ 'slider__dot--active': i === index }"
            :aria-label="t('tracks.photoGoTo', { n: i + 1 })"
            :aria-selected="i === index"
            role="tab"
            @click="goTo(i)"
          />
        </div>
      </template>
    </template>
    <p v-else class="slider__empty muted">{{ t('tracks.noPhoto') }}</p>
  </div>
</template>

<style scoped>
.slider {
  position: relative;
  min-height: 260px;
  background: var(--surface-2);
  overflow: hidden;
}

.slider__img {
  width: 100%;
  height: 100%;
  min-height: 260px;
  object-fit: cover;
  display: block;
}

.slider__empty {
  display: grid;
  place-items: center;
  min-height: 260px;
  margin: 0;
}

.slider__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.45);
  color: #fff;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.slider__nav:hover {
  background: rgb(0 0 0 / 0.65);
}

.slider__nav--prev {
  left: 0.5rem;
}

.slider__nav--next {
  right: 0.5rem;
}

.slider__dots {
  position: absolute;
  bottom: 0.65rem;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 0.35rem;
}

.slider__dot {
  width: 0.5rem;
  height: 0.5rem;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.45);
  cursor: pointer;
}

.slider__dot--active {
  background: #fff;
}
</style>
