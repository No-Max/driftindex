<script setup lang="ts">
import type { HomeChampionshipCard } from '@drift-index/shared';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatPilotName } from '../../lib/formatPilotName';
import PilotAvatar from '../PilotAvatar.vue';
import SeriesLogo from '../SeriesLogo.vue';

const props = defineProps<{
  items: HomeChampionshipCard[];
}>();

const { t } = useI18n();

const pageIndex = ref(0);
const paused = ref(false);
const cardsPerPage = 3;
const autoplayMs = 9000;

const pages = computed(() => {
  const result: HomeChampionshipCard[][] = [];
  for (let i = 0; i < props.items.length; i += cardsPerPage) {
    result.push(props.items.slice(i, i + cardsPerPage));
  }
  return result;
});

const pageCount = computed(() => pages.value.length);

let timer: ReturnType<typeof setInterval> | null = null;

function seriesName(item: HomeChampionshipCard) {
  return item.series.name;
}

function goToPage(index: number) {
  if (pageCount.value <= 0) return;
  pageIndex.value = ((index % pageCount.value) + pageCount.value) % pageCount.value;
}

function nextPage() {
  goToPage(pageIndex.value + 1);
}

function startAutoplay() {
  stopAutoplay();
  if (pageCount.value <= 1) return;
  timer = setInterval(() => {
    if (!paused.value) nextPage();
  }, autoplayMs);
}

function stopAutoplay() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(pageCount, () => {
  pageIndex.value = 0;
  startAutoplay();
});

onMounted(startAutoplay);
onUnmounted(stopAutoplay);
</script>

<template>
  <div
    class="champ-slider"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
  >
    <div class="champ-slider__viewport">
      <div
        class="champ-slider__track"
        :style="{ transform: `translateX(-${pageIndex * 100}%)` }"
      >
        <div
          v-for="(page, pageNumber) in pages"
          :key="pageNumber"
          class="champ-slider__page"
        >
          <article
            v-for="item in page"
            :key="item.series.slug"
            class="card champ-card"
          >
            <RouterLink :to="item.standingsPath" class="champ-card__link">
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
    </div>

    <div v-if="pageCount > 1" class="champ-slider__dots">
      <button
        v-for="(_, index) in pageCount"
        :key="index"
        type="button"
        class="champ-slider__dot"
        :class="{ 'champ-slider__dot--active': index === pageIndex }"
        :aria-label="t('home.championshipsPage', { n: index + 1 })"
        @click="goToPage(index)"
      />
    </div>
  </div>
</template>

<style scoped>
.champ-slider__viewport {
  overflow: hidden;
}

.champ-slider__track {
  display: flex;
  transition: transform 0.5s ease;
}

.champ-slider__page {
  flex: 0 0 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
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

.champ-slider__dots {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.champ-slider__dot {
  width: 0.55rem;
  height: 0.55rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--border);
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.champ-slider__dot--active {
  background: var(--accent);
  transform: scale(1.15);
}

@media (max-width: 960px) {
  .champ-slider__page {
    grid-template-columns: 1fr;
  }
}
</style>
