<script setup lang="ts">
import type { SeriesPrestigeEntry, SeriesPrestigeResponse } from '@drift-index/shared';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SeriesLogo from '../SeriesLogo.vue';

const props = defineProps<{
  prestige: SeriesPrestigeResponse;
  year: number;
}>();

const { t } = useI18n();

const topThree = computed(() => props.prestige.entries.slice(0, 3));

function seriesPath(entry: SeriesPrestigeEntry) {
  return `/series/${entry.slug}/${props.year}`;
}

function isLeader(entry: SeriesPrestigeEntry) {
  return entry.effectiveOrder === 1;
}

function formatHardness(value: number | null) {
  return value != null ? String(value) : '—';
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
  <div v-if="topThree.length > 0" class="top-series">
    <ol class="top-series__podium">
      <li
        v-for="entry in topThree"
        :key="entry.slug"
        class="top-series__slot"
        :class="{ 'top-series__slot--leader': isLeader(entry) }"
        :data-rank="entry.effectiveOrder"
      >
        <RouterLink :to="seriesPath(entry)" class="card top-series__card">
          <span class="top-series__rank">#{{ entry.effectiveOrder }}</span>
          <SeriesLogo
            :slug="entry.slug"
            :name="entry.name"
            :logo-url="entry.logoUrl"
            size="xl"
          />
          <h3 class="top-series__name">{{ entry.name }}</h3>
          <p v-if="entry.shortName && entry.shortName !== entry.name" class="top-series__code muted">
            {{ entry.shortName }}
          </p>
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
                    @click.stop.prevent="toggleHardnessHelp(entry.slug)"
                  >
                    ?
                  </button>
                  <div
                    v-if="hardnessHelpSlug === entry.slug"
                    class="top-series__help-popover"
                    role="tooltip"
                    @click.stop
                  >
                    {{ t('seriesPage.colHelp.hardness') }}
                  </div>
                </span>
              </dt>
              <dd>{{ formatHardness(entry.hardnessScore) }}</dd>
            </div>
          </dl>
        </RouterLink>
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
  text-decoration: none;
  transition: border-color 0.15s;
}

.top-series__card:hover {
  border-color: rgba(255, 77, 26, 0.4);
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

.top-series__slot--leader .top-series__name {
  font-size: clamp(1.05rem, 2vw, 1.25rem);
}

.top-series__code {
  margin: 0;
  font-size: 0.78rem;
}

.top-series__meta {
  margin: 0.35rem 0 0;
  display: grid;
  gap: 0.25rem;
}

.top-series__meta div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.top-series__meta dt {
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
  margin: 0;
  font-weight: 700;
  font-size: 1.05rem;
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
