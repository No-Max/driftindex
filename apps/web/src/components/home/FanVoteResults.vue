<script setup lang="ts">
import type { PilotSummary, PollDetail, PollOptionView } from '@drift-index/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLocalePath } from '../../composables/useLocalePath';
import { pollTitle } from '../../lib/pollCopy';
import PilotAvatar from '../PilotAvatar.vue';
import SeriesLogo from '../SeriesLogo.vue';

const props = defineProps<{
  pilotsPoll: PollDetail | null;
  seriesPoll: PollDetail | null;
}>();

const { t } = useI18n();
const { localePath } = useLocalePath();

const visible = computed(() => Boolean(props.pilotsPoll || props.seriesPoll));

function sortedOptions(poll: PollDetail): PollOptionView[] {
  return [...poll.options]
    .sort((a, b) => {
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      return a.sortOrder - b.sortOrder;
    })
    .slice(0, 3);
}

function percent(poll: PollDetail, count: number) {
  if (poll.totalVotes <= 0) return 0;
  return Math.round((count / poll.totalVotes) * 100);
}

function optionPilot(option: PollOptionView): PilotSummary {
  const meta = option.meta ?? {};
  const firstName =
    typeof meta.firstName === 'string'
      ? meta.firstName
      : option.label.split(/\s+/)[0] ?? option.label;
  const lastName =
    typeof meta.lastName === 'string'
      ? meta.lastName
      : option.label.split(/\s+/).slice(1).join(' ') || option.label;
  return {
    slug: option.pilotSlug ?? option.id,
    firstName,
    lastName,
    country: typeof meta.country === 'string' ? meta.country : null,
    number: typeof meta.number === 'number' ? meta.number : null,
    photoUrl: option.photoUrl,
  };
}

function seriesSlug(option: PollOptionView): string {
  const raw = option.meta?.seriesSlug;
  return typeof raw === 'string' ? raw : option.id;
}

function seriesCountry(option: PollOptionView): string | null {
  const raw = option.meta?.country;
  return typeof raw === 'string' ? raw : null;
}

function seriesHref(poll: PollDetail, option: PollOptionView) {
  const slug = option.meta?.seriesSlug;
  if (typeof slug !== 'string') return null;
  return poll.year ? `/series/${slug}/${poll.year}` : `/series/${slug}`;
}
</script>

<template>
  <div v-if="visible" class="fan-results">
    <div class="fan-results__cols">
      <article v-if="pilotsPoll" class="fan-results__panel">
        <header class="fan-results__head">
          <h3 class="fan-results__title">{{ pollTitle(pilotsPoll, t) }}</h3>
          <p class="fan-results__total">
            {{ t('home.fanVote.totalVotes', { count: pilotsPoll.totalVotes }) }}
          </p>
        </header>
        <ol class="fan-results__list">
          <li
            v-for="(option, index) in sortedOptions(pilotsPoll)"
            :key="option.id"
            class="fan-results__row"
          >
            <span class="fan-results__rank">{{ index + 1 }}</span>
            <RouterLink
              v-if="option.pilotSlug"
              class="fan-results__entity"
              :to="localePath(`/pilots/${option.pilotSlug}`)"
            >
              <PilotAvatar :pilot="optionPilot(option)" size="sm" />
              <span class="fan-results__name">{{ option.label }}</span>
            </RouterLink>
            <div v-else class="fan-results__entity">
              <PilotAvatar :pilot="optionPilot(option)" size="sm" />
              <span class="fan-results__name">{{ option.label }}</span>
            </div>
            <div class="fan-results__score">
              <span class="fan-results__pct">{{ percent(pilotsPoll, option.voteCount) }}%</span>
              <span class="fan-results__count">{{ option.voteCount }}</span>
            </div>
            <span
              class="fan-results__bar"
              :style="{ width: `${percent(pilotsPoll, option.voteCount)}%` }"
              aria-hidden="true"
            />
          </li>
        </ol>
      </article>

      <article v-if="seriesPoll" class="fan-results__panel">
        <header class="fan-results__head">
          <h3 class="fan-results__title">{{ pollTitle(seriesPoll, t) }}</h3>
          <p class="fan-results__total">
            {{ t('home.fanVote.totalVotes', { count: seriesPoll.totalVotes }) }}
          </p>
        </header>
        <ol class="fan-results__list">
          <li
            v-for="(option, index) in sortedOptions(seriesPoll)"
            :key="option.id"
            class="fan-results__row"
          >
            <span class="fan-results__rank">{{ index + 1 }}</span>
            <RouterLink
              v-if="seriesHref(seriesPoll, option)"
              class="fan-results__entity"
              :to="localePath(seriesHref(seriesPoll, option)!)"
            >
              <SeriesLogo
                :slug="seriesSlug(option)"
                :name="option.label"
                :logo-url="option.photoUrl"
                :country="seriesCountry(option)"
                size="sm"
              />
              <span class="fan-results__name">{{ option.label }}</span>
            </RouterLink>
            <div v-else class="fan-results__entity">
              <SeriesLogo
                :slug="seriesSlug(option)"
                :name="option.label"
                :logo-url="option.photoUrl"
                :country="seriesCountry(option)"
                size="sm"
              />
              <span class="fan-results__name">{{ option.label }}</span>
            </div>
            <div class="fan-results__score">
              <span class="fan-results__pct">{{ percent(seriesPoll, option.voteCount) }}%</span>
              <span class="fan-results__count">{{ option.voteCount }}</span>
            </div>
            <span
              class="fan-results__bar"
              :style="{ width: `${percent(seriesPoll, option.voteCount)}%` }"
              aria-hidden="true"
            />
          </li>
        </ol>
      </article>
    </div>

    <p class="fan-results__cta">
      <RouterLink :to="localePath('/votes')">{{ t('home.fanVotesCta') }}</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.fan-results {
  display: grid;
  gap: 1rem;
}

.fan-results__cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.fan-results__panel {
  min-width: 0;
  padding: 1rem 1.05rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.fan-results__head {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 0.85rem;
}

.fan-results__title {
  margin: 0;
  font-family: Oswald, sans-serif;
  font-size: 1.2rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.fan-results__total {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.fan-results__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.fan-results__row {
  position: relative;
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.5rem 0.55rem;
  border-radius: 10px;
  background: var(--surface-2);
  overflow: hidden;
}

.fan-results__rank {
  font-family: Oswald, sans-serif;
  font-size: 0.85rem;
  color: var(--muted);
  text-align: center;
}

.fan-results__entity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.fan-results__entity:hover .fan-results__name {
  color: var(--accent);
}

.fan-results__name {
  min-width: 0;
  font-family: Oswald, sans-serif;
  font-size: 0.88rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fan-results__score {
  display: grid;
  justify-items: end;
  gap: 0.05rem;
  font-variant-numeric: tabular-nums;
  z-index: 1;
}

.fan-results__pct {
  font-family: Oswald, sans-serif;
  font-size: 0.95rem;
  color: var(--accent);
}

.fan-results__count {
  font-size: 0.68rem;
  color: var(--muted);
}

.fan-results__bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  background: var(--accent);
  opacity: 0.7;
  pointer-events: none;
}

.fan-results__cta {
  margin: 0;
  text-align: right;
}

.fan-results__cta a {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.95rem;
}

.fan-results__cta a:hover {
  text-decoration: underline;
}

@media (max-width: 820px) {
  .fan-results__cols {
    grid-template-columns: 1fr;
  }
}
</style>
