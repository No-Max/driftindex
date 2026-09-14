<script setup lang="ts">
import type { HomeCalendarEvent } from '@drift-index/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import SeriesLogo from '../SeriesLogo.vue';

const props = defineProps<{
  year: number;
  events: HomeCalendarEvent[];
}>();

const { locale, t } = useI18n();

const months = computed(() => {
  const grouped = Array.from({ length: 12 }, (_, i) => ({
    month: i,
    label: new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(new Date(props.year, i, 1)),
    events: [] as HomeCalendarEvent[],
  }));

  for (const event of props.events) {
    const date = new Date(event.startsAt);
    grouped[date.getMonth()]!.events.push(event);
  }

  return grouped;
});

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
</script>

<template>
  <div class="calendar">
    <article v-for="month in months" :key="month.month" class="card month-card">
      <h3>{{ month.label }}</h3>
      <ul v-if="month.events.length">
        <li v-for="event in month.events" :key="`${event.seriesSlug}-${event.eventSlug}`">
          <RouterLink :to="event.standingsPath" class="event-row">
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
                  <RouterLink class="track-link" :to="`/tracks/${event.track.slug}`">
                    {{ event.track.name }}
                  </RouterLink>
                </template>
              </span>
            </span>
            <span class="event-row__status" :class="statusClass(event.status)">
              {{ t(`home.eventStatus.${event.status.toLowerCase()}`) }}
            </span>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="muted month-empty">{{ t('home.noEvents') }}</p>
    </article>
  </div>
</template>

<style scoped>
.calendar {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.month-card {
  padding: 1rem;
  min-height: 140px;
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
  background: rgba(34, 197, 94, 0.12);
  color: var(--verified);
}

.event-row__status.upcoming {
  background: var(--accent-soft);
  color: var(--accent);
}

.event-row__status.cancelled {
  background: rgba(139, 151, 171, 0.12);
  color: var(--muted);
}

.month-empty {
  margin: 0;
  font-size: 0.85rem;
}

.track-link {
  color: var(--accent);
}

.track-link:hover {
  text-decoration: underline;
}
</style>
