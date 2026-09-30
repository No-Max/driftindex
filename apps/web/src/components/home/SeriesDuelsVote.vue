<script setup lang="ts">
import type { PilotSummary, PollDetail, PollOptionView } from '@drift-index/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { castPollVote } from '../../api/client';
import { useAuth } from '../../composables/useAuth';
import { useClickOutside } from '../../composables/useClickOutside';
import { useLocalePath } from '../../composables/useLocalePath';
import {
  pollDescription,
  pollTitle,
} from '../../lib/pollCopy';
import PilotAvatar from '../PilotAvatar.vue';
import SeriesLogo from '../SeriesLogo.vue';
import TrophyCountsIcons, { type TrophyCounts } from '../TrophyCountsIcons.vue';

type SeriesMeta = {
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
};

const props = withDefaults(
  defineProps<{
    poll: PollDetail;
    /** Inside a shared duels block — hide section title/description. */
    embedded?: boolean;
  }>(),
  { embedded: false },
);

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

const seriesPair = computed(() => {
  const a = optionSeries(props.poll.options[0]);
  const b = optionSeries(props.poll.options[1]);
  if (!a || !b) return null;
  return {
    a: a.shortName || a.name,
    b: b.shortName || b.name,
  };
});

const title = computed(() => pollTitle(props.poll, t, seriesPair.value));
const description = computed(() => pollDescription(props.poll, t));

const pairLabel = computed(() => {
  if (seriesPair.value) {
    return t('home.fanVote.seriesDuelTitle', seriesPair.value);
  }
  const rankA =
    typeof props.poll.options[0]?.meta?.rank === 'number'
      ? props.poll.options[0].meta.rank
      : 1;
  const rankB =
    typeof props.poll.options[1]?.meta?.rank === 'number'
      ? props.poll.options[1].meta.rank
      : 2;
  return t('home.fanVote.duelPair', { a: rankA, b: rankB });
});

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

function optionSeries(option: PollOptionView | undefined): SeriesMeta | null {
  const raw = option?.meta?.series;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.slug !== 'string' || typeof row.name !== 'string') return null;
  return {
    slug: row.slug,
    name: row.name,
    shortName: typeof row.shortName === 'string' ? row.shortName : null,
    logoUrl: typeof row.logoUrl === 'string' ? row.logoUrl : null,
  };
}

function optionRank(option: PollOptionView) {
  const rank = option.meta?.rank;
  return typeof rank === 'number' ? rank : null;
}

function optionScore(option: PollOptionView) {
  const score = option.meta?.score;
  return typeof score === 'number' ? score : null;
}

function optionTrophies(option: PollOptionView): TrophyCounts | null {
  const raw = option.meta?.trophies;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const gold = typeof row.gold === 'number' ? row.gold : 0;
  const silver = typeof row.silver === 'number' ? row.silver : 0;
  const bronze = typeof row.bronze === 'number' ? row.bronze : 0;
  const qual = typeof row.qual === 'number' ? row.qual : 0;
  if (gold + silver + bronze + qual <= 0) return null;
  return { gold, silver, bronze, qual };
}

function optionStats(option: PollOptionView): {
  eventsCount: number;
  avgQualScore: number | null;
} | null {
  const raw = option.meta?.stats;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const eventsCount = typeof row.eventsCount === 'number' ? row.eventsCount : null;
  if (eventsCount == null) return null;
  return {
    eventsCount,
    avgQualScore: typeof row.avgQualScore === 'number' ? row.avgQualScore : null,
  };
}

function selectOption(optionId: string) {
  if (hasVoted.value) return;
  selectedOptionId.value = optionId;
  voteError.value = '';
}

function percent(count: number) {
  if (props.poll.totalVotes <= 0) return 0;
  return Math.round((count / props.poll.totalVotes) * 100);
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
</script>

<template>
  <div ref="rootEl" class="duels" :class="{ 'duels--embedded': embedded }">
    <div v-if="!embedded" class="duels__head">
      <div>
        <p class="duels__eyebrow">{{ title }}</p>
        <p class="duels__sub">{{ description }}</p>
      </div>
    </div>

    <p v-if="poll.options.length === 0" class="muted">
      {{ t('home.fanVote.emptyBallot') }}
    </p>

    <article v-else class="duel">
      <div class="duel__head">
        <div class="duel__intro">
          <p class="duel__pair-label">{{ pairLabel }}</p>
          <p class="duels__total">
            {{ t('home.fanVote.totalVotes', { count: poll.totalVotes }) }}
          </p>
        </div>
        <div class="duels__actions">
          <button
            type="button"
            class="duel__submit"
            :disabled="!canSubmit"
            @click="submitVote"
          >
            {{ submitLabel }}
          </button>
          <p v-if="voteError" class="duel__error">{{ voteError }}</p>
        </div>
      </div>

      <div
        class="duel__pair"
        role="listbox"
        :aria-label="pairLabel"
        :class="{ 'duel__pair--locked': hasVoted }"
      >
        <div
          v-for="(option, index) in poll.options"
          :key="option.id"
          class="duel__side"
        >
          <div
            role="option"
            :tabindex="hasVoted ? -1 : 0"
            class="duel__card"
            :class="{
              'duel__card--selected': selectedOptionId === option.id,
              'duel__card--mine': poll.myOptionId === option.id,
            }"
            :aria-selected="selectedOptionId === option.id"
            :aria-disabled="hasVoted"
            @click="selectOption(option.id)"
            @keydown.enter.prevent="selectOption(option.id)"
            @keydown.space.prevent="selectOption(option.id)"
          >
            <span
              class="duel__bar"
              :style="{ width: `${percent(option.voteCount)}%` }"
              aria-hidden="true"
            />
            <div class="duel__body">
              <div class="duel__info">
                <span v-if="optionSeries(option)" class="duel__series">
                  <SeriesLogo
                    :slug="optionSeries(option)!.slug"
                    :name="optionSeries(option)!.shortName || optionSeries(option)!.name"
                    :logo-url="optionSeries(option)!.logoUrl"
                    size="sm"
                  />
                  <span>#1 {{ optionSeries(option)!.shortName || optionSeries(option)!.name }}</span>
                </span>
                <span v-else-if="optionRank(option) != null" class="duel__rank">
                  #{{ optionRank(option) }}
                  <template v-if="optionScore(option) != null">
                    · {{ optionScore(option) }} {{ t('home.p4pScore') }}
                  </template>
                </span>
                <RouterLink
                  v-if="option.pilotSlug"
                  class="duel__name"
                  :to="localePath(`/pilots/${option.pilotSlug}`)"
                  @click.stop
                >
                  {{ option.label }}
                </RouterLink>
                <span v-else class="duel__name">{{ option.label }}</span>
                <TrophyCountsIcons
                  v-if="optionTrophies(option)"
                  :counts="optionTrophies(option)!"
                  size="md"
                />
                <span v-if="optionStats(option)" class="duel__stats">
                  <span>
                    {{ optionStats(option)!.eventsCount }}
                    {{ t('pilot.stats.eventsShort') }}
                  </span>
                  <span v-if="optionStats(option)!.avgQualScore != null">
                    {{ optionStats(option)!.avgQualScore!.toFixed(1) }}
                    {{ t('pilot.stats.qualShort') }}
                  </span>
                </span>
                <span class="duel__count">
                  <strong>{{ percent(option.voteCount) }}%</strong>
                  <small>{{ option.voteCount }}</small>
                </span>
              </div>
              <PilotAvatar :pilot="optionPilot(option)" size="lg" />
            </div>
          </div>
          <p v-if="index === 0" class="duel__vs" aria-hidden="true">VS</p>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.duels {
  display: grid;
  gap: 1.15rem;
}

.duels__head {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: space-between;
  gap: 0.75rem;
}

.duels__actions {
  display: grid;
  gap: 0.45rem;
  justify-items: end;
  min-width: 10rem;
  margin-left: auto;
}

.duels__eyebrow {
  margin: 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 1.55rem;
}

.duels__sub,
.duels__total,
.muted {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.duels__total {
  font-variant-numeric: tabular-nums;
}

.duel {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.duels--embedded {
  gap: 0;
}

.duel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 0.65rem;
}

.duel__intro {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.duel__pair-label {
  margin: 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.duel__total {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.duel__pair {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.65rem;
  align-items: stretch;
}

.duel__pair--locked .duel__card {
  cursor: default;
}

.duel__pair--locked .duel__card:hover {
  border-color: var(--border);
}

.duel__pair--locked .duel__card--mine:hover {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.duel__side {
  display: contents;
}

.duel__vs {
  margin: 0;
  align-self: center;
  font-family: Oswald, sans-serif;
  letter-spacing: 0.08em;
  color: var(--accent);
  font-size: 1.1rem;
}

.duel__card {
  position: relative;
  display: grid;
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-2);
  cursor: pointer;
  overflow: hidden;
  min-width: 0;
}

.duel__card:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}

.duel__card--selected {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.duel__card--mine:not(.duel__card--selected) {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.duel__bar {
  position: absolute;
  inset: auto 0 0;
  height: 3px;
  background: var(--accent);
  opacity: 0.75;
  pointer-events: none;
}

.duel__body {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  min-width: 0;
}

.duel__info {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}

.duel__rank {
  color: var(--muted);
  font-size: 0.8rem;
}

.duel__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.75rem;
  color: var(--muted);
  font-size: 0.72rem;
}

.duel__series {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--muted);
  font-size: 0.78rem;
}

.duel__name {
  color: inherit;
  text-decoration: none;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 0.95rem;
  line-height: 1.2;
}

.duel__name:hover {
  color: var(--accent);
}

.duel__count {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-variant-numeric: tabular-nums;
}

.duel__count strong {
  font-size: 1rem;
}

.duel__count small {
  color: var(--muted);
  font-size: 0.72rem;
}

.duel__body :deep(.avatar--lg) {
  width: 94px;
  height: 94px;
  flex-shrink: 0;
}

.duel__submit {
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
  cursor: pointer;
}

.duel__submit:hover:not(:disabled) {
  filter: brightness(1.05);
}

.duel__submit:disabled {
  opacity: 0.45;
  cursor: default;
}

.duel__error {
  margin: 0;
  color: #d45d5d;
  font-size: 0.85rem;
  text-align: right;
}

@media (max-width: 720px) {
  .duels__actions {
    margin-left: auto;
  }

  .duel__pair {
    grid-template-columns: 1fr;
  }

  .duel__side {
    display: grid;
    gap: 0.55rem;
  }

  .duel__vs {
    justify-self: center;
  }

  .duel__body :deep(.avatar--lg) {
    width: 84px;
    height: 84px;
  }
}
</style>
