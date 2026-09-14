<script setup lang="ts">
import type { HomeQualWinner } from '@drift-index/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCardSlider } from '../../composables/useCardSlider';
import { formatPilotName } from '../../lib/formatPilotName';
import PilotAvatar from '../PilotAvatar.vue';
import SeriesLogo from '../SeriesLogo.vue';

const props = defineProps<{
  items: HomeQualWinner[];
}>();

const { t } = useI18n();

const itemCount = computed(() => props.items.length);

function resolveVisibleCount(width: number) {
  if (width > 1100) return 4;
  if (width > 960) return 2;
  return 1;
}

const {
  viewportRef,
  slideIndex,
  canNavigate,
  positionCount,
  viewportStyle,
  trackStyle,
  dragging,
  paused,
  goTo,
  next,
  prev,
  onPointerDown,
  onPointerMove,
  finishDrag,
  onLinkClick,
} = useCardSlider(itemCount, resolveVisibleCount, 8000);

function seriesName(item: HomeQualWinner) {
  return item.series.name;
}

function eventName(item: HomeQualWinner) {
  return item.event.name;
}
</script>

<template>
  <div
    class="card-slider"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
  >
    <div class="card-slider__frame">
      <button
        v-if="canNavigate"
        type="button"
        class="card-slider__nav card-slider__nav--prev"
        :aria-label="t('home.qualWinnersPrev')"
        @click="prev"
      >
        ‹
      </button>

      <div
        ref="viewportRef"
        class="card-slider__viewport"
        :class="{ 'card-slider__viewport--dragging': dragging }"
        :style="viewportStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="finishDrag"
        @pointercancel="finishDrag"
      >
        <div
          class="card-slider__track"
          :class="{ 'card-slider__track--dragging': dragging }"
          :style="trackStyle"
        >
          <article
            v-for="item in items"
            :key="`${item.series.slug}-${item.event.slug}`"
            class="card-slider__item card qual-card"
          >
            <RouterLink
              :to="`/pilots/${item.pilot.slug}`"
              class="qual-card__pilot"
              @click="onLinkClick"
            >
              <PilotAvatar :pilot="item.pilot" size="lg" />
              <div>
                <p class="qual-card__pole">{{ t('home.pole') }}</p>
                <p class="qual-card__name">{{ formatPilotName(item.pilot) }}</p>
              </div>
            </RouterLink>

            <div class="qual-card__meta">
              <p class="qual-card__series">
                <SeriesLogo
                  :slug="item.series.slug"
                  :name="item.series.name"
                  :logo-url="item.series.logoUrl"
                  :country="item.series.country"
                  size="sm"
                />
                <span>{{ seriesName(item) }}</span>
              </p>
              <p class="muted">
                {{ eventName(item) }} · R{{ item.event.roundNumber }}
                <template v-if="item.event.track">
                  ·
                  <RouterLink
                    class="track-link"
                    :to="`/tracks/${item.event.track.slug}`"
                    @click="onLinkClick"
                  >
                    {{ item.event.track.name }}
                  </RouterLink>
                </template>
              </p>
              <div v-if="item.qualScore != null" class="qual-card__stats">
                <span>{{ item.qualScore.toFixed(1) }} {{ t('home.qualScore') }}</span>
                <span v-if="item.gapToSecond != null" class="muted">
                  +{{ item.gapToSecond }} {{ t('home.gap') }}
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>

      <button
        v-if="canNavigate"
        type="button"
        class="card-slider__nav card-slider__nav--next"
        :aria-label="t('home.qualWinnersNext')"
        @click="next"
      >
        ›
      </button>
    </div>

    <div v-if="canNavigate" class="card-slider__dots">
      <button
        v-for="index in positionCount"
        :key="index - 1"
        type="button"
        class="card-slider__dot"
        :class="{ 'card-slider__dot--active': index - 1 === slideIndex }"
        :aria-label="t('home.qualWinnersPage', { n: index })"
        @click="goTo(index - 1)"
      />
    </div>
  </div>
</template>

<style scoped>
.card-slider__frame {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
}

.card-slider__viewport {
  container-type: inline-size;
  --slider-gap: 1rem;
  overflow: hidden;
  touch-action: pan-y;
  cursor: grab;
  user-select: none;
}

.card-slider__viewport--dragging {
  cursor: grabbing;
}

.card-slider__track {
  display: flex;
  gap: var(--slider-gap);
  transition: transform 0.5s ease;
}

.card-slider__track--dragging {
  transition: none;
}

.card-slider__item {
  flex: 0 0 calc((100cqw - (var(--visible-count) - 1) * var(--slider-gap)) / var(--visible-count));
  min-width: 0;
}

.card-slider__nav {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.card-slider__nav:hover {
  border-color: rgba(255, 77, 26, 0.45);
  color: var(--accent);
  background: var(--surface);
}

.qual-card {
  padding: 1rem 1.15rem;
}

.qual-card__pilot {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 0.85rem;
}

.qual-card__pole {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.qual-card__name {
  margin: 0.15rem 0 0;
  font-family: Oswald, sans-serif;
  font-size: 1.15rem;
  text-transform: uppercase;
}

.qual-card__series {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.2rem;
  font-weight: 600;
}

.qual-card__stats {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.card-slider__dots {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.card-slider__dot {
  width: 0.55rem;
  height: 0.55rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--border);
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.card-slider__dot--active {
  background: var(--accent);
  transform: scale(1.15);
}

.track-link {
  color: var(--accent);
}

.track-link:hover {
  text-decoration: underline;
}

@media (max-width: 960px) {
  .card-slider__frame {
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }

  .card-slider__nav {
    display: none;
  }
}
</style>
