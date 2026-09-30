<script setup lang="ts">
import type { PollDetail, PollOptionView } from '@drift-index/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { castPollVote } from '../../api/client';
import { useAuth } from '../../composables/useAuth';
import { useClickOutside } from '../../composables/useClickOutside';
import { useLocalePath } from '../../composables/useLocalePath';
import { pollDescription, pollTitle } from '../../lib/pollCopy';
import SeriesLogo from '../SeriesLogo.vue';

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

function seriesSlug(option: PollOptionView): string | null {
  const raw = option.meta?.seriesSlug;
  return typeof raw === 'string' ? raw : null;
}

function seriesCountry(option: PollOptionView): string | null {
  const raw = option.meta?.country;
  return typeof raw === 'string' ? raw : null;
}

function metaCount(option: PollOptionView, key: 'eventsCount' | 'tracksCount'): number | null {
  const raw = option.meta?.[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function seriesPath(option: PollOptionView) {
  const slug = seriesSlug(option);
  if (!slug) return null;
  const year = props.poll.year;
  return year ? `/series/${slug}/${year}` : `/series/${slug}`;
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
</script>

<template>
  <div ref="rootEl" class="best-series">
    <div class="best-series__head">
      <div class="best-series__intro">
        <p class="best-series__eyebrow">{{ title }}</p>
        <p class="best-series__sub">{{ description }}</p>
        <p class="best-series__total">
          {{ t('home.fanVote.totalVotes', { count: poll.totalVotes }) }}
        </p>
      </div>
      <div v-if="poll.options.length > 0" class="best-series__actions">
        <button
          type="button"
          class="best-series__submit"
          :disabled="!canSubmit"
          @click="submitVote"
        >
          {{ submitLabel }}
        </button>
        <p v-if="voteError" class="best-series__error">{{ voteError }}</p>
      </div>
    </div>

    <p v-if="poll.options.length === 0" class="muted">
      {{ t('home.fanVote.emptyBallot') }}
    </p>

    <template v-else>
      <div
        class="best-series__grid"
        role="listbox"
        :aria-label="title"
        :class="{ 'best-series__grid--locked': hasVoted }"
      >
        <div
          v-for="option in poll.options"
          :key="option.id"
          role="option"
          :tabindex="hasVoted ? -1 : 0"
          class="best-series__card"
          :class="{
            'best-series__card--selected': selectedOptionId === option.id,
            'best-series__card--mine': poll.myOptionId === option.id,
          }"
          :aria-selected="selectedOptionId === option.id"
          :aria-disabled="hasVoted"
          @click="selectOption(option.id)"
          @keydown.enter.prevent="selectOption(option.id)"
          @keydown.space.prevent="selectOption(option.id)"
        >
          <span
            class="best-series__bar"
            :style="{ width: `${percent(option.voteCount)}%` }"
            aria-hidden="true"
          />
          <div class="best-series__body">
            <div class="best-series__info">
              <span class="best-series__name">{{ option.label }}</span>
              <span
                v-if="metaCount(option, 'eventsCount') != null || metaCount(option, 'tracksCount') != null"
                class="best-series__meta"
              >
                <template v-if="metaCount(option, 'eventsCount') != null">
                  {{ metaCount(option, 'eventsCount') }}
                  {{ t('home.fanVote.eventsShort') }}
                </template>
                <template
                  v-if="metaCount(option, 'eventsCount') != null && metaCount(option, 'tracksCount') != null"
                >
                  ·
                </template>
                <template v-if="metaCount(option, 'tracksCount') != null">
                  {{ metaCount(option, 'tracksCount') }}
                  {{ t('home.fanVote.tracksShort') }}
                </template>
              </span>
              <span class="best-series__count">
                <strong>{{ percent(option.voteCount) }}%</strong>
                <small>{{ option.voteCount }}</small>
              </span>
            </div>
            <SeriesLogo
              :slug="seriesSlug(option) || option.id"
              :name="option.label"
              :logo-url="option.photoUrl"
              :country="seriesCountry(option)"
              size="xl"
              class="best-series__logo"
            />
          </div>
          <RouterLink
            v-if="seriesPath(option)"
            class="best-series__profile"
            :to="localePath(seriesPath(option)!)"
            @click.stop
          >
            {{ t('home.fanVote.seriesPage') }}
          </RouterLink>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.best-series {
  display: grid;
  gap: 1.15rem;
}

.best-series__head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 0.75rem;
}

.best-series__intro {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.best-series__actions {
  display: grid;
  gap: 0.45rem;
  justify-items: end;
  min-width: 10rem;
  margin-left: auto;
}

.best-series__eyebrow {
  margin: 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 1.55rem;
}

.best-series__sub,
.best-series__total,
.muted {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.best-series__total {
  font-variant-numeric: tabular-nums;
}

.best-series__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 0.75rem;
  width: 100%;
}

.best-series__grid--locked .best-series__card {
  cursor: default;
}

.best-series__grid--locked .best-series__card:hover {
  border-color: var(--border);
}

.best-series__grid--locked .best-series__card--mine:hover {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.best-series__card {
  position: relative;
  display: grid;
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

.best-series__card:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}

.best-series__card--selected {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.best-series__card--mine:not(.best-series__card--selected) {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.best-series__bar {
  position: absolute;
  inset: auto 0 0;
  height: 3px;
  background: var(--accent);
  opacity: 0.75;
  pointer-events: none;
}

.best-series__body {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
}

.best-series__logo :deep(.series-logo--xl) {
  width: 88px;
  height: 88px;
  border-radius: 16px;
}

.best-series__logo :deep(.series-logo__fallback) {
  font-size: 1.2rem;
}

.best-series__info {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.best-series__name {
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 0.95rem;
  line-height: 1.2;
}

.best-series__meta {
  color: var(--muted);
  font-size: 0.72rem;
  white-space: nowrap;
}

.best-series__count {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-variant-numeric: tabular-nums;
}

.best-series__count strong {
  font-size: 1rem;
}

.best-series__count small {
  color: var(--muted);
  font-size: 0.72rem;
}

.best-series__profile {
  position: absolute;
  left: 0.85rem;
  bottom: 0.45rem;
  z-index: 1;
  color: var(--muted);
  font-size: 0.72rem;
  text-decoration: none;
}

.best-series__profile:hover {
  color: var(--accent);
}

.best-series__submit {
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

.best-series__submit:hover:not(:disabled) {
  filter: brightness(1.05);
}

.best-series__submit:disabled {
  opacity: 0.45;
  cursor: default;
}

.best-series__error {
  margin: 0;
  color: #d45d5d;
  font-size: 0.85rem;
  text-align: right;
}

@media (max-width: 640px) {
  .best-series__grid {
    grid-template-columns: 1fr;
  }

  .best-series__actions {
    margin-left: auto;
  }

  .best-series__card {
    padding-bottom: 0.85rem;
  }

  .best-series__profile {
    display: none;
  }
}
</style>
