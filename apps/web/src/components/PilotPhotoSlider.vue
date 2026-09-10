<script setup lang="ts">
import type { PilotSeriesPhoto, PilotSummary } from '@drift-index/shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  pilot: PilotSummary;
  photos: PilotSeriesPhoto[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
}>();

const { locale } = useI18n();
const index = ref(0);

const initials = computed(() =>
  `${props.pilot.firstName[0] ?? ''}${props.pilot.lastName[0] ?? ''}`.toUpperCase(),
);

const current = computed(() => props.photos[index.value] ?? null);

const seriesLabel = computed(() => {
  if (!current.value) return '';
  return locale.value === 'ru' ? current.value.seriesNameRu : current.value.seriesNameEn;
});

function prev() {
  if (props.photos.length <= 1) return;
  index.value = (index.value - 1 + props.photos.length) % props.photos.length;
}

function next() {
  if (props.photos.length <= 1) return;
  index.value = (index.value + 1) % props.photos.length;
}
</script>

<template>
  <div class="photo-slider" :class="[`photo-slider--${size ?? 'xl'}`, { 'photo-slider--multi': photos.length > 1 }]">
    <div class="photo-slider__frame">
      <img
        v-if="current"
        :key="current.photoUrl"
        :src="current.photoUrl"
        :alt="`${pilot.firstName} ${pilot.lastName}`"
      />
      <span v-else class="photo-slider__initials">{{ initials }}</span>

      <button
        v-if="photos.length > 1"
        type="button"
        class="photo-slider__nav photo-slider__nav--prev"
        :aria-label="$t('pilot.photoPrev')"
        @click="prev"
      >
        ‹
      </button>
      <button
        v-if="photos.length > 1"
        type="button"
        class="photo-slider__nav photo-slider__nav--next"
        :aria-label="$t('pilot.photoNext')"
        @click="next"
      >
        ›
      </button>
    </div>

    <p v-if="current && photos.length > 1" class="photo-slider__caption">{{ seriesLabel }}</p>

    <div v-if="photos.length > 1" class="photo-slider__dots">
      <button
        v-for="(photo, dotIndex) in photos"
        :key="photo.seriesSlug"
        type="button"
        class="photo-slider__dot"
        :class="{ 'photo-slider__dot--active': dotIndex === index }"
        :aria-label="locale === 'ru' ? photo.seriesNameRu : photo.seriesNameEn"
        @click="index = dotIndex"
      />
    </div>
  </div>
</template>

<style scoped>
.photo-slider {
  flex-shrink: 0;
}

.photo-slider__frame {
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  background: var(--surface-2);
  border: 2px solid var(--border);
}

.photo-slider__frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-slider__initials {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: var(--accent);
  font-family: Oswald, sans-serif;
  font-weight: 600;
}

.photo-slider--xl .photo-slider__frame {
  width: 160px;
  height: 160px;
}

.photo-slider--xl .photo-slider__initials {
  font-size: 2rem;
}

.photo-slider--lg .photo-slider__frame {
  width: 120px;
  height: 120px;
}

.photo-slider--md .photo-slider__frame {
  width: 96px;
  height: 96px;
}

.photo-slider__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.photo-slider--multi:hover .photo-slider__nav,
.photo-slider--multi:focus-within .photo-slider__nav {
  opacity: 1;
}

.photo-slider__nav--prev {
  left: 0.35rem;
}

.photo-slider__nav--next {
  right: 0.35rem;
}

.photo-slider__caption {
  margin: 0.5rem 0 0;
  text-align: center;
  font-size: 0.75rem;
  color: var(--muted);
  max-width: 160px;
}

.photo-slider__dots {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.photo-slider__dot {
  width: 0.45rem;
  height: 0.45rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--border);
  cursor: pointer;
}

.photo-slider__dot--active {
  background: var(--accent);
}
</style>
