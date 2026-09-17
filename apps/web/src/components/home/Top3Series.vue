<script setup lang="ts">
import type {
  HomeChampionshipCard,
  PilotSummary,
  SeriesPrestigeEntry,
  SeriesPrestigeResponse,
} from '@drift-index/shared';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatPilotName } from '../../lib/formatPilotName';
import SeriesLogo from '../SeriesLogo.vue';

const props = defineProps<{
  prestige: SeriesPrestigeResponse;
  championships: HomeChampionshipCard[];
  year: number;
}>();

const { t } = useI18n();

const topThreeCards = computed(() => {
  const bySlug = new Map(props.championships.map((item) => [item.series.slug, item]));
  return props.prestige.entries.slice(0, 3).map((entry) => ({
    entry,
    standingsTop: bySlug.get(entry.slug)?.topThree ?? [],
  }));
});

function seriesPath(entry: SeriesPrestigeEntry) {
  return `/series/${entry.slug}/${props.year}`;
}

function pilotPath(pilot: PilotSummary) {
  return `/pilots/${pilot.slug}`;
}

function isLeader(entry: SeriesPrestigeEntry) {
  return entry.effectiveOrder === 1;
}

function formatHardness(value: number | null) {
  return value != null ? String(value) : '—';
}

function pilotInitials(pilot: PilotSummary) {
  return `${pilot.firstName[0] ?? ''}${pilot.lastName[0] ?? ''}`.toUpperCase();
}

const hardnessHelpSlug = ref<string | null>(null);

function toggleHardnessHelp(slug: string) {
  hardnessHelpSlug.value = hardnessHelpSlug.value === slug ? null : slug;
}

function closeHardnessHelp() {
  hardnessHelpSlug.value = null;
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!hardnessHelpSlug.value) return;
  const target = event.target;
  if (target instanceof Element && target.closest('.top-series__help-wrap')) return;
  closeHardnessHelp();
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeHardnessHelp();
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeydown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeydown);
});
</script>

<template>
  <div v-if="topThreeCards.length > 0" class="top-series">
    <ol class="top-series__podium">
      <li
        v-for="{ entry, standingsTop } in topThreeCards"
        :key="entry.slug"
        class="top-series__slot"
        :class="{ 'top-series__slot--leader': isLeader(entry) }"
        :data-rank="entry.effectiveOrder"
      >
        <article class="card top-series__card">
          <span class="top-series__rank">#{{ entry.effectiveOrder }}</span>
          <div class="top-series__logo-row">
            <RouterLink :to="seriesPath(entry)" class="top-series__series-link">
              <SeriesLogo
                :slug="entry.slug"
                :name="entry.name"
                :logo-url="entry.logoUrl"
                size="xl"
              />
            </RouterLink>
            <div v-if="standingsTop.length > 0" class="top-series__pilot-badges">
              <RouterLink
                v-for="(row, placeIndex) in standingsTop"
                :key="row.pilot.slug"
                :to="pilotPath(row.pilot)"
                class="top-series__pilot-link"
                :title="`${placeIndex + 1}. ${formatPilotName(row.pilot)}`"
              >
                <span
                  class="top-series__pilot-badge"
                  :class="`top-series__pilot-badge--place-${placeIndex + 1}`"
                >
                  <img
                    v-if="row.pilot.photoUrl"
                    :src="row.pilot.photoUrl"
                    :alt="formatPilotName(row.pilot)"
                    loading="lazy"
                    decoding="async"
                  />
                  <span v-else class="top-series__pilot-badge-fallback">{{ pilotInitials(row.pilot) }}</span>
                </span>
              </RouterLink>
            </div>
          </div>
          <h3 class="top-series__name">
            <RouterLink :to="seriesPath(entry)" class="top-series__series-name-link">
              {{ entry.name }}
            </RouterLink>
          </h3>
          <p v-if="standingsTop.length === 0" class="top-series__no-leader muted">{{ t('home.noLeader') }}</p>
          <dl class="top-series__meta">
            <div>
              <dt class="muted top-series__hardness-label">
                <span>{{ t('seriesPage.col.hardness') }}</span>
                <span class="top-series__help-wrap">
                  <button
                    type="button"
                    class="top-series__help-btn"
                    :aria-label="t('home.hardnessHelpAria')"
                    :aria-expanded="hardnessHelpSlug === entry.slug"
                    @click.prevent="toggleHardnessHelp(entry.slug)"
                  >
                    ?
                  </button>
                  <div
                    v-if="hardnessHelpSlug === entry.slug"
                    class="top-series__help-popover"
                    role="tooltip"
                  >
                    {{ t('seriesPage.colHelp.hardness') }}
                  </div>
                </span>
              </dt>
              <dd>{{ formatHardness(entry.hardnessScore) }}</dd>
            </div>
          </dl>
        </article>
      </li>
    </ol>
    <p class="top-series__footer muted">
      <RouterLink to="/series" class="top-series__all-link">
        {{ t('home.topSeriesAll') }}
      </RouterLink>
    </p>
  </div>
</template>

<style scoped>
.top-series {
  display: grid;
  gap: 1rem;
}

.top-series__podium {
  --podium-step: clamp(7rem, 18vw, 11rem);
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: row;
  gap: 1rem;
  align-items: flex-start;
}

.top-series__slot {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
}

.top-series__slot[data-rank='1'] {
  order: 2;
  margin-top: 0;
}

.top-series__slot[data-rank='2'] {
  order: 1;
  margin-top: calc(var(--podium-step) * 0.3);
}

.top-series__slot[data-rank='3'] {
  order: 3;
  margin-top: calc(var(--podium-step) * 0.4);
}

.top-series__card {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.65rem;
  padding: 1.25rem 1rem 1.35rem;
  overflow: visible;
  color: inherit;
}

.top-series__series-link,
.top-series__series-name-link,
.top-series__pilot-link {
  position: relative;
  color: inherit;
  text-decoration: none;
  transition: color 0.15s, border-color 0.15s;
}

.top-series__series-link:hover,
.top-series__series-name-link:hover,
.top-series__pilot-link:hover {
  color: var(--accent);
}

.top-series__series-link:hover :deep(.series-logo) {
  border-color: rgba(255, 77, 26, 0.45);
}

.top-series__pilot-link:hover .top-series__pilot-badge {
  border-color: var(--accent);
}

.top-series__slot--leader .top-series__card {
  padding-top: 1.65rem;
  padding-bottom: 1.65rem;
  border-color: rgba(255, 77, 26, 0.35);
  background: linear-gradient(165deg, rgba(255, 77, 26, 0.1), var(--surface));
}

.top-series__card :deep(.series-logo) {
  box-sizing: border-box;
  width: 112px;
  height: 112px;
  padding: 0.65rem;
  border-radius: 16px;
}

.top-series__slot--leader .top-series__card :deep(.series-logo) {
  width: 140px;
  height: 140px;
  padding: 0.75rem;
  border-radius: 18px;
}

.top-series__card :deep(.series-logo img) {
  padding: 0;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

.top-series__card :deep(.series-logo__fallback) {
  font-size: 1.3rem;
}

.top-series__slot--leader .top-series__card :deep(.series-logo__fallback) {
  font-size: 1.55rem;
}

.top-series__logo-row {
  display: inline-flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.45rem;
}

.top-series__pilot-badges {
  display: inline-flex;
  align-items: flex-end;
}

.top-series__pilot-link:not(:first-child) {
  margin-left: -14px;
}

.top-series__pilot-link:nth-child(1) {
  z-index: 3;
}

.top-series__pilot-link:nth-child(2) {
  z-index: 2;
}

.top-series__pilot-link:nth-child(3) {
  z-index: 1;
}

.top-series__pilot-badge {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  overflow: hidden;
  background: var(--surface-2);
  border: 2px solid var(--border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
  color: var(--accent);
  font-family: Oswald, sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
}

.top-series__pilot-badge--place-1 {
  width: 3.1rem;
  height: 3.1rem;
  font-size: 0.92rem;
  border-color: #d4af37;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(212, 175, 55, 0.35);
}

.top-series__pilot-badge--place-2 {
  width: 2.8rem;
  height: 2.8rem;
  font-size: 0.85rem;
  border-color: #b8bcc6;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(184, 188, 198, 0.35);
}

.top-series__pilot-badge--place-3 {
  width: 2.5rem;
  height: 2.5rem;
  font-size: 0.78rem;
  border-color: #b87333;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(184, 115, 51, 0.35);
}

.top-series__pilot-badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.top-series__pilot-badge-fallback {
  line-height: 1;
}

.top-series__rank {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  font-family: Oswald, sans-serif;
  font-size: 1.35rem;
  line-height: 1;
  color: var(--accent);
}

.top-series__slot--leader .top-series__rank {
  font-size: 1.75rem;
}

.top-series__name {
  margin: 0.15rem 0 0;
  font-family: Oswald, sans-serif;
  font-size: 1rem;
  text-transform: uppercase;
  line-height: 1.15;
}

.top-series__series-name-link {
  display: inline-block;
}

.top-series__slot--leader .top-series__name {
  font-size: clamp(1.05rem, 2vw, 1.25rem);
}

.top-series__no-leader {
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
}

.top-series__meta {
  margin: 0.35rem 0 0;
  display: grid;
  gap: 0.25rem;
}

.top-series__meta div {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.top-series__meta dt {
  margin: 0;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.top-series__hardness-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.top-series__help-btn {
  display: inline-grid;
  place-items: center;
  width: 1.05rem;
  height: 1.05rem;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.top-series__help-btn:hover,
.top-series__help-btn[aria-expanded='true'] {
  border-color: rgba(255, 77, 26, 0.55);
  color: var(--accent);
}

.top-series__help-wrap {
  position: relative;
  display: inline-flex;
}

.top-series__help-popover {
  position: absolute;
  z-index: 30;
  left: 50%;
  bottom: calc(100% + 0.4rem);
  transform: translateX(-50%);
  width: min(16rem, calc(100vw - 2rem));
  padding: 0.45rem 0.55rem;
  font-size: 0.62rem;
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

.top-series__help-popover::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--border);
}

.top-series__meta dd {
  order: -1;
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1;
  color: var(--accent);
}

.top-series__footer {
  margin: 0;
  font-size: 0.9rem;
  text-align: right;
}

.top-series__all-link {
  color: var(--accent);
  text-decoration: none;
}

.top-series__all-link:hover {
  text-decoration: underline;
}

@media (max-width: 720px) {
  .top-series__podium {
    flex-direction: column;
    align-items: stretch;
  }

  .top-series__slot[data-rank='1'],
  .top-series__slot[data-rank='2'],
  .top-series__slot[data-rank='3'] {
    order: unset;
    margin-top: 0;
  }
}
</style>
