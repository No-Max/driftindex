<script setup lang="ts">
import type { HomeChampionshipCard } from '@drift-index/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCardSlider } from '../../composables/useCardSlider';
import { useLocalePath } from '../../composables/useLocalePath';
import { formatPilotName } from '../../lib/formatPilotName';
import PilotAvatar from '../PilotAvatar.vue';
import SeriesLogo from '../SeriesLogo.vue';

const props = defineProps<{
  items: HomeChampionshipCard[];
}>();

const { t } = useI18n();
const { localePath } = useLocalePath();

const itemCount = computed(() => props.items.length);

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
} = useCardSlider(itemCount, (width) => (width > 960 ? 3 : 1));

function seriesName(item: HomeChampionshipCard) {
  return item.series.name;
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
        :aria-label="t('home.championshipsPrev')"
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
            :key="item.series.slug"
            class="card-slider__item card champ-card"
          >
            <RouterLink
              :to="localePath(item.standingsPath)"
              class="champ-card__link"
              @click="onLinkClick"
            >
              <div class="champ-card__head">
                <SeriesLogo
                  :slug="item.series.slug"
                  :name="item.series.name"
                  :logo-url="item.series.logoUrl"
                  :country="item.series.country"
                  size="lg"
                />
                <div>
                  <p class="muted">{{ t('home.seriesSince', { year: item.seriesStartYear }) }}</p>
                  <h3>{{ seriesName(item) }}</h3>
                </div>
              </div>

              <div v-if="item.leader" class="champ-card__leader">
                <PilotAvatar :pilot="item.leader" size="lg" />
                <div>
                  <p class="champ-card__leader-label">{{ t('home.champion') }}</p>
                  <p class="champ-card__leader-name">{{ formatPilotName(item.leader) }}</p>
                  <p v-if="item.leaderPoints != null" class="champ-card__leader-points">
                    {{ item.leaderPoints }} {{ t('home.pointsShort') }}
                  </p>
                </div>
              </div>
              <p v-else class="muted">{{ t('home.noLeader') }}</p>
            </RouterLink>
          </article>
        </div>
      </div>

      <button
        v-if="canNavigate"
        type="button"
        class="card-slider__nav card-slider__nav--next"
        :aria-label="t('home.championshipsNext')"
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
        :aria-label="t('home.championshipsPage', { n: index })"
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
  --slider-gap: 1.25rem;
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

.champ-card__link {
  display: block;
  height: 100%;
  padding: 1.35rem 1.5rem;
  min-height: 190px;
}

.champ-card__head {
  display: flex;
  gap: 0.85rem;
  align-items: center;
  margin-bottom: 1.25rem;
}

.champ-card h3 {
  margin: 0.15rem 0 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  font-size: 1.1rem;
}

.champ-card__leader {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.champ-card__leader-label {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.champ-card__leader-name {
  margin: 0.15rem 0 0;
  font-family: Oswald, sans-serif;
  font-size: 1.25rem;
  text-transform: uppercase;
}

.champ-card__leader-points {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--muted);
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
