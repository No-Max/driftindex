<script setup lang="ts">
import type { PilotSummary, PollDetail, PollOptionView } from '@drift-index/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { castPollVote } from '../../api/client';
import { useAuth } from '../../composables/useAuth';
import { useClickOutside } from '../../composables/useClickOutside';
import { useLocalePath } from '../../composables/useLocalePath';
import { pollDescription, pollTitle } from '../../lib/pollCopy';
import PilotAvatar from '../PilotAvatar.vue';
import SeriesLogo from '../SeriesLogo.vue';

type SeriesBadge = {
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  rank: number;
};

const props = defineProps<{
  poll: PollDetail;
}>();

const emit = defineEmits<{
  update: [poll: PollDetail];
}>();

const { t } = useI18n();
const { localePath } = useLocalePath();
const { isAuthenticated } = useAuth();

const rootEl = ref<HTMLElement | null>(null);
const selectedOptionId = ref<string | null>(props.poll.myOptionId);
const submitting = ref(false);
const voteError = ref('');

watch(
  () => props.poll.myOptionId,
  (value) => {
    selectedOptionId.value = value;
  },
);

useClickOutside(rootEl, () => {
  if (props.poll.myOptionId) {
    selectedOptionId.value = props.poll.myOptionId;
    voteError.value = '';
    return;
  }
  if (selectedOptionId.value == null) return;
  selectedOptionId.value = null;
  voteError.value = '';
});

const hasVoted = computed(() => Boolean(props.poll.myOptionId));

const canSubmit = computed(() => {
  if (hasVoted.value || submitting.value) return false;
  return Boolean(selectedOptionId.value);
});

const submitLabel = computed(() =>
  hasVoted.value ? t('home.fanVote.voted') : t('home.fanVote.vote'),
);

const title = computed(() => pollTitle(props.poll, t));
const description = computed(() => pollDescription(props.poll, t));

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

function optionSeries(option: PollOptionView): SeriesBadge[] {
  const raw = option.meta?.series;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (typeof row.slug !== 'string' || typeof row.name !== 'string') return null;
      return {
        slug: row.slug,
        name: row.name,
        shortName: typeof row.shortName === 'string' ? row.shortName : null,
        logoUrl: typeof row.logoUrl === 'string' ? row.logoUrl : null,
        rank: typeof row.rank === 'number' ? row.rank : 0,
      };
    })
    .filter((row): row is SeriesBadge => row != null);
}

function selectOption(optionId: string) {
  if (hasVoted.value) return;
  selectedOptionId.value = optionId;
  voteError.value = '';
}

async function submitVote() {
  if (!selectedOptionId.value) return;
  if (!isAuthenticated.value) {
    voteError.value = t('home.fanVote.loginToVote');
    return;
  }
  if (!canSubmit.value) return;

  voteError.value = '';
  submitting.value = true;
  try {
    const next = await castPollVote(props.poll.slug, selectedOptionId.value);
    selectedOptionId.value = next.myOptionId;
    emit('update', next);
  } catch {
    voteError.value = t('home.fanVote.voteFailed');
  } finally {
    submitting.value = false;
  }
}

function percent(count: number) {
  const total = props.poll.totalVotes;
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function seriesLabel(rank: number, shortName: string | null, name: string) {
  return t('home.fanVote.seriesRank', {
    rank,
    series: shortName || name,
  });
}
</script>

<template>
  <div ref="rootEl" class="best-pilot">
    <div class="best-pilot__head">
      <div class="best-pilot__intro">
        <p class="best-pilot__eyebrow">{{ title }}</p>
        <p class="best-pilot__sub">{{ description }}</p>
        <p class="best-pilot__total">
          {{ t('home.fanVote.totalVotes', { count: poll.totalVotes }) }}
        </p>
      </div>
      <div v-if="poll.options.length > 0" class="best-pilot__actions">
        <button
          type="button"
          class="best-pilot__submit"
          :disabled="!canSubmit"
          @click="submitVote"
        >
          {{ submitLabel }}
        </button>
        <p v-if="voteError" class="best-pilot__error">{{ voteError }}</p>
      </div>
    </div>

    <p v-if="poll.options.length === 0" class="muted">
      {{ t('home.fanVote.emptyBallot') }}
    </p>

    <template v-else>
      <div
        class="best-pilot__grid"
        role="listbox"
        :aria-label="title"
        :class="{ 'best-pilot__grid--locked': hasVoted }"
      >
        <div
          v-for="option in poll.options"
          :key="option.id"
          role="option"
          :tabindex="hasVoted ? -1 : 0"
          class="best-pilot__card"
          :class="{
            'best-pilot__card--selected': selectedOptionId === option.id,
            'best-pilot__card--mine': poll.myOptionId === option.id,
          }"
          :aria-selected="selectedOptionId === option.id"
          :aria-disabled="hasVoted"
          @click="selectOption(option.id)"
          @keydown.enter.prevent="selectOption(option.id)"
          @keydown.space.prevent="selectOption(option.id)"
        >
          <span
            class="best-pilot__bar"
            :style="{ width: `${percent(option.voteCount)}%` }"
            aria-hidden="true"
          />
          <div class="best-pilot__body">
            <div class="best-pilot__info">
              <span class="best-pilot__name">{{ option.label }}</span>
              <span class="best-pilot__series">
                <span
                  v-for="item in optionSeries(option)"
                  :key="item.slug"
                  class="best-pilot__series-item"
                  :title="seriesLabel(item.rank, item.shortName, item.name)"
                >
                  <SeriesLogo
                    :slug="item.slug"
                    :name="item.shortName || item.name"
                    :logo-url="item.logoUrl"
                    size="sm"
                  />
                  <span>#{{ item.rank }}</span>
                </span>
              </span>
              <span class="best-pilot__count">
                <strong>{{ percent(option.voteCount) }}%</strong>
                <small>{{ option.voteCount }}</small>
              </span>
            </div>
            <PilotAvatar :pilot="optionPilot(option)" size="lg" />
          </div>
          <RouterLink
            v-if="option.pilotSlug"
            class="best-pilot__profile"
            :to="localePath(`/pilots/${option.pilotSlug}`)"
            @click.stop
          >
            {{ t('home.fanVote.profile') }}
          </RouterLink>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.best-pilot {
  display: grid;
  gap: 1.15rem;
}

.best-pilot__head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 0.75rem;
}

.best-pilot__intro {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.best-pilot__actions {
  display: grid;
  gap: 0.45rem;
  justify-items: end;
  min-width: 10rem;
  margin-left: auto;
}

.best-pilot__eyebrow {
  margin: 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 1.55rem;
}

.best-pilot__sub,
.best-pilot__total,
.muted {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.best-pilot__total {
  font-variant-numeric: tabular-nums;
}

.best-pilot__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 0.75rem;
  width: 100%;
}

.best-pilot__grid--locked .best-pilot__card {
  cursor: default;
}

.best-pilot__grid--locked .best-pilot__card:hover {
  border-color: var(--border);
}

.best-pilot__grid--locked .best-pilot__card--mine:hover {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.best-pilot__card {
  position: relative;
  display: grid;
  gap: 0;
  box-sizing: border-box;
  width: auto;
  min-width: 0;
  max-width: none;
  padding: 0.85rem 0.85rem 1.55rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}

.best-pilot__card:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}

.best-pilot__card--selected {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.best-pilot__card--mine:not(.best-pilot__card--selected) {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.best-pilot__bar {
  position: absolute;
  inset: auto 0 0;
  height: 3px;
  background: var(--accent);
  opacity: 0.75;
  pointer-events: none;
}

.best-pilot__body {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  min-width: 0;
}

.best-pilot__body :deep(.avatar--lg) {
  width: 94px;
  height: 94px;
}

.best-pilot__info {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
  align-content: start;
}

.best-pilot__name {
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 0.92rem;
  line-height: 1.2;
}

.best-pilot__series {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: var(--muted);
  font-size: 0.72rem;
}

.best-pilot__series-item {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.best-pilot__count {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-variant-numeric: tabular-nums;
}

.best-pilot__count strong {
  font-size: 1rem;
}

.best-pilot__count small {
  color: var(--muted);
  font-size: 0.72rem;
}

.best-pilot__profile {
  position: absolute;
  left: 0.85rem;
  bottom: 0.45rem;
  z-index: 1;
  color: var(--muted);
  font-size: 0.72rem;
  text-decoration: none;
}

.best-pilot__profile:hover {
  color: var(--accent);
}

.best-pilot__submit {
  width: 100%;
  min-width: 10rem;
  padding: 0.65rem 1.15rem;
  border: 1px solid var(--accent);
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 1rem;
  cursor: pointer;
}

.best-pilot__submit:hover:not(:disabled) {
  filter: brightness(1.05);
}

.best-pilot__submit:disabled {
  opacity: 0.45;
  cursor: default;
}

.best-pilot__error {
  margin: 0;
  color: #d45d5d;
  font-size: 0.85rem;
  text-align: right;
}

@media (max-width: 640px) {
  .best-pilot__grid {
    grid-template-columns: 1fr;
  }

  .best-pilot__actions {
    margin-left: auto;
  }

  .best-pilot__card {
    padding-bottom: 0.85rem;
  }

  .best-pilot__profile {
    display: none;
  }

  .best-pilot__body :deep(.avatar--lg) {
    width: 84px;
    height: 84px;
  }
}
</style>
