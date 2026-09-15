<script setup lang="ts">
import type { HomeCalendarEvent } from '@drift-index/shared';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useCardSlider } from '../../composables/useCardSlider';
import SeriesLogo from '../SeriesLogo.vue';

const props = defineProps<{
  year: number;
  events: HomeCalendarEvent[];
}>();

const { locale, t } = useI18n();

const WINDOW_RADIUS = 4;

function monthIndexFromIso(iso: string) {
  return Number(iso.slice(5, 7)) - 1;
}

const months = computed(() => {
  const grouped = Array.from({ length: 12 }, (_, i) => ({
    month: i,
    label: new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(new Date(props.year, i, 1)),
    events: [] as HomeCalendarEvent[],
  }));

  for (const event of props.events) {
    const monthIndex = monthIndexFromIso(event.startsAt);
    if (monthIndex >= 0 && monthIndex <= 11) {
      grouped[monthIndex]!.events.push(event);
    }
  }

  for (const month of grouped) {
    month.events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  return grouped;
});

function resolveCenterMonth() {
  const now = new Date();
  if (props.year === now.getFullYear()) return now.getMonth();
  if (props.year < now.getFullYear()) return 11;
  return 0;
}

const visibleMonths = computed(() => {
  const center = resolveCenterMonth();
  const start = Math.max(0, center - WINDOW_RADIUS);
  const end = Math.min(11, center + WINDOW_RADIUS);

  return months.value
    .slice(start, end + 1)
    .filter((month) => month.events.length > 0)
    .sort((a, b) => b.month - a.month);
});

const itemCount = computed(() => visibleMonths.value.length);

function resolveVisibleCount(width: number) {
  return width > 960 ? 3 : 1;
}

function resolveInitialIndex(visibleCount: number) {
  const center = resolveCenterMonth();
  const items = visibleMonths.value;
  if (!items.length) return 0;

  let centerIdx = items.findIndex((month) => month.month === center);
  if (centerIdx === -1) {
    centerIdx = items.reduce((best, month, index) => {
      if (best === -1) return index;
      return Math.abs(month.month - center) < Math.abs(items[best]!.month - center) ? index : best;
    }, -1);
  }

  const centerOffset = Math.floor(visibleCount / 2);
  const maxIndex = Math.max(0, items.length - visibleCount);
  return Math.max(0, Math.min(centerIdx - centerOffset, maxIndex));
}

const {
  viewportRef,
  slideIndex,
  centerItemIndex,
  canNavigate,
  canGoPrev,
  canGoNext,
  positionCount,
  viewportStyle,
  trackStyle,
  dragging,
  goTo,
  next,
  prev,
  onPointerDown,
  onPointerMove,
  finishDrag,
  onLinkClick,
} = useCardSlider(itemCount, resolveVisibleCount, 0, resolveInitialIndex, false);

function eventName(event: HomeCalendarEvent) {
  return event.name;
}

function seriesName(event: HomeCalendarEvent) {
  return event.seriesName;
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric' }).format(new Date(iso));
}

function statusClass(status: HomeCalendarEvent['status']) {
  return status === 'FINISHED' ? 'done' : status === 'CANCELLED' ? 'cancelled' : 'upcoming';
}

function isEventClickable(status: HomeCalendarEvent['status']) {
  return status === 'FINISHED';
}

function isCurrentMonth(monthIndex: number) {
  const now = new Date();
  return props.year === now.getFullYear() && monthIndex === now.getMonth();
}
</script>

<template>
  <p v-if="!visibleMonths.length" class="muted calendar-empty">{{ t('home.noEvents') }}</p>

  <div v-else class="card-slider calendar-slider">
    <div class="card-slider__frame">
      <button
        v-if="canNavigate"
        type="button"
        class="card-slider__nav card-slider__nav--prev"
        :aria-label="t('home.calendarPrev')"
        :disabled="!canGoPrev"
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
            v-for="(month, index) in visibleMonths"
            :key="month.month"
            class="card-slider__item card month-card"
            :class="{
              'month-card--current': isCurrentMonth(month.month),
              'month-card--center': index === centerItemIndex,
            }"
          >
            <h3>{{ month.label }}</h3>
            <ul>
              <li v-for="event in month.events" :key="`${event.seriesSlug}-${event.eventSlug}`">
                <component
                  :is="isEventClickable(event.status) ? RouterLink : 'div'"
                  :to="isEventClickable(event.status) ? event.standingsPath : undefined"
                  class="event-row"
                  :class="{ 'event-row--static': !isEventClickable(event.status) }"
                  @click="isEventClickable(event.status) && onLinkClick($event)"
                >
                  <span class="event-row__day">{{ formatDay(event.startsAt) }}</span>
                  <span class="event-row__body">
                    <span class="event-row__title">
                      <SeriesLogo
                        :slug="event.seriesSlug"
                        :name="event.seriesName"
                        :logo-url="event.logoUrl"
                        size="sm"
                      />
                      <strong>{{ eventName(event) }}</strong>
                    </span>
                    <span class="muted">
                      {{ seriesName(event) }} · R{{ event.roundNumber }}
                      <template v-if="event.track">
                        ·
                        <RouterLink
                          v-if="isEventClickable(event.status)"
                          class="track-link"
                          :to="`/tracks/${event.track.slug}`"
                          @click="onLinkClick"
                        >
                          {{ event.track.name }}
                        </RouterLink>
                        <span v-else>{{ event.track.name }}</span>
                      </template>
                    </span>
                  </span>
                  <span class="event-row__status" :class="statusClass(event.status)">
                    {{ t(`home.eventStatus.${event.status.toLowerCase()}`) }}
                  </span>
                </component>
              </li>
            </ul>
          </article>
        </div>
      </div>

      <button
        v-if="canNavigate"
        type="button"
        class="card-slider__nav card-slider__nav--next"
        :aria-label="t('home.calendarNext')"
        :disabled="!canGoNext"
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
        :aria-label="t('home.calendarPage', { n: index })"
        @click="goTo(index - 1)"
      />
    </div>
  </div>
</template>

<style scoped>
.card-slider__frame {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: stretch;
  gap: 0.75rem;
}

.card-slider__viewport {
  container-type: inline-size;
  --slider-gap: 3.5rem;
  overflow: hidden;
  padding-block: 4.65rem;
  touch-action: pan-y;
  cursor: grab;
  user-select: none;
}

.card-slider__viewport--dragging {
  cursor: grabbing;
}

.card-slider__track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: calc((100cqw - (var(--visible-count) - 1) * var(--slider-gap)) / var(--visible-count));
  align-items: stretch;
  width: max-content;
  gap: var(--slider-gap);
  transition: transform 0.5s ease;
}

.card-slider__track--dragging {
  transition: none;
}

.card-slider__item {
  min-width: 0;
  height: 100%;
}

.month-card--center {
  transform: scale(1.2);
  transform-origin: center center;
  transition: transform 0.5s ease;
  z-index: 1;
  position: relative;
}

.card-slider__track--dragging .month-card--center {
  transition: none;
}

.card-slider__nav {
  flex-shrink: 0;
  align-self: center;
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

.card-slider__nav:hover:not(:disabled) {
  border-color: rgba(255, 77, 26, 0.45);
  color: var(--accent);
  background: var(--surface);
}

.card-slider__nav:disabled {
  opacity: 0.35;
  cursor: default;
}

.month-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 180px;
  padding: 1rem;
}

.month-card--current {
  border-color: rgba(255, 77, 26, 0.35);
  box-shadow: 0 0 0 1px rgba(255, 77, 26, 0.12);
}

.month-card h3 {
  margin: 0 0 0.75rem;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  font-size: 0.95rem;
  color: var(--accent);
}

.month-card ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.event-row__title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.event-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.65rem;
  align-items: center;
  padding: 0.45rem 0;
  border-top: 1px solid var(--border);
}

.event-row--static {
  cursor: default;
}

.event-row__day {
  font-family: Oswald, sans-serif;
  font-size: 1.1rem;
  color: var(--accent);
  min-width: 1.5rem;
}

.event-row__body {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.event-row__body strong {
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-row__status {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  white-space: nowrap;
}

.event-row__status.done {
  background: rgba(139, 151, 171, 0.12);
  color: var(--muted);
}

.event-row__status.upcoming {
  background: rgba(34, 197, 94, 0.12);
  color: var(--verified);
}

.event-row__status.cancelled {
  background: rgba(139, 151, 171, 0.12);
  color: var(--muted);
}

.calendar-empty {
  margin: 0;
  font-size: 0.9rem;
}

.track-link {
  color: var(--accent);
}

.track-link:hover {
  text-decoration: underline;
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
