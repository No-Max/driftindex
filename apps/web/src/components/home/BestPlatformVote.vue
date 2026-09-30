<script setup lang="ts">
import type { PollDetail, PollOptionView } from '@drift-index/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { castPollVote } from '../../api/client';
import { useAuth } from '../../composables/useAuth';
import { useClickOutside } from '../../composables/useClickOutside';
import { pollDescription, pollTitle } from '../../lib/pollCopy';

const props = defineProps<{
  poll: PollDetail;
}>();

const emit = defineEmits<{
  update: [poll: PollDetail];
}>();

const { t, te } = useI18n();
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

function platformSlug(option: PollOptionView): string | null {
  const raw = option.meta?.platformSlug;
  return typeof raw === 'string' ? raw : null;
}

function platformCode(option: PollOptionView): string {
  const raw = option.meta?.code;
  if (typeof raw === 'string' && raw.trim()) return raw;
  const slug = platformSlug(option);
  return slug ? slug.slice(0, 2).toUpperCase() : option.label.slice(0, 2).toUpperCase();
}

function platformModels(option: PollOptionView): string | null {
  const slug = platformSlug(option);
  if (slug && te(`home.fanVote.platforms.${slug}.models`)) {
    return t(`home.fanVote.platforms.${slug}.models`);
  }
  const raw = option.meta?.models;
  return typeof raw === 'string' ? raw : null;
}

function platformWhy(option: PollOptionView): string | null {
  const slug = platformSlug(option);
  if (slug && te(`home.fanVote.platforms.${slug}.why`)) {
    return t(`home.fanVote.platforms.${slug}.why`);
  }
  const raw = option.meta?.why;
  return typeof raw === 'string' ? raw : null;
}

function optionLabel(option: PollOptionView): string {
  const slug = platformSlug(option);
  if (slug && te(`home.fanVote.platforms.${slug}.name`)) {
    return t(`home.fanVote.platforms.${slug}.name`);
  }
  return option.label;
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
  <div ref="rootEl" class="best-platform">
    <div class="best-platform__head">
      <div class="best-platform__intro">
        <p class="best-platform__eyebrow">{{ title }}</p>
        <p class="best-platform__sub">{{ description }}</p>
        <p class="best-platform__total">
          {{ t('home.fanVote.totalVotes', { count: poll.totalVotes }) }}
        </p>
      </div>
      <div v-if="poll.options.length > 0" class="best-platform__actions">
        <button
          type="button"
          class="best-platform__submit"
          :disabled="!canSubmit"
          @click="submitVote"
        >
          {{ submitLabel }}
        </button>
        <p v-if="voteError" class="best-platform__error">{{ voteError }}</p>
      </div>
    </div>

    <p v-if="poll.options.length === 0" class="muted">
      {{ t('home.fanVote.emptyBallot') }}
    </p>

    <template v-else>
      <div
        class="best-platform__grid"
        role="listbox"
        :aria-label="title"
        :class="{ 'best-platform__grid--locked': hasVoted }"
      >
        <div
          v-for="option in poll.options"
          :key="option.id"
          role="option"
          :tabindex="hasVoted ? -1 : 0"
          class="best-platform__card"
          :class="{
            'best-platform__card--selected': selectedOptionId === option.id,
            'best-platform__card--mine': poll.myOptionId === option.id,
          }"
          :aria-selected="selectedOptionId === option.id"
          :aria-disabled="hasVoted"
          @click="selectOption(option.id)"
          @keydown.enter.prevent="selectOption(option.id)"
          @keydown.space.prevent="selectOption(option.id)"
        >
          <span
            class="best-platform__bar"
            :style="{ width: `${percent(option.voteCount)}%` }"
            aria-hidden="true"
          />
          <div class="best-platform__body">
            <div class="best-platform__info">
              <span class="best-platform__name">{{ optionLabel(option) }}</span>
              <span v-if="platformModels(option)" class="best-platform__models">
                {{ platformModels(option) }}
              </span>
              <span v-if="platformWhy(option)" class="best-platform__why">
                {{ platformWhy(option) }}
              </span>
              <span class="best-platform__count">
                <strong>{{ percent(option.voteCount) }}%</strong>
                <small>{{ option.voteCount }}</small>
              </span>
            </div>
            <span class="best-platform__badge" aria-hidden="true">
              {{ platformCode(option) }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.best-platform {
  display: grid;
  gap: 1.15rem;
}

.best-platform__head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 0.75rem;
}

.best-platform__intro {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.best-platform__actions {
  display: grid;
  gap: 0.45rem;
  justify-items: end;
  min-width: 10rem;
  margin-left: auto;
}

.best-platform__eyebrow {
  margin: 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 1.55rem;
}

.best-platform__sub,
.best-platform__total,
.muted {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.best-platform__total {
  font-variant-numeric: tabular-nums;
}

.best-platform__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 0.75rem;
  width: 100%;
}

.best-platform__grid--locked .best-platform__card {
  cursor: default;
}

.best-platform__grid--locked .best-platform__card:hover {
  border-color: var(--border);
}

.best-platform__grid--locked .best-platform__card--mine:hover {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.best-platform__card {
  position: relative;
  display: grid;
  box-sizing: border-box;
  width: auto;
  min-width: 0;
  max-width: none;
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}

.best-platform__card:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}

.best-platform__card--selected {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.best-platform__card--mine:not(.best-platform__card--selected) {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.best-platform__bar {
  position: absolute;
  inset: auto 0 0;
  height: 3px;
  background: var(--accent);
  opacity: 0.75;
  pointer-events: none;
}

.best-platform__body {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
}

.best-platform__info {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.best-platform__name {
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 0.95rem;
  line-height: 1.2;
}

.best-platform__models,
.best-platform__why {
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.best-platform__count {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-variant-numeric: tabular-nums;
}

.best-platform__count strong {
  font-size: 1rem;
}

.best-platform__count small {
  color: var(--muted);
  font-size: 0.72rem;
}

.best-platform__badge {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--accent);
  font-family: Oswald, sans-serif;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.best-platform__submit {
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

.best-platform__submit:hover:not(:disabled) {
  filter: brightness(1.05);
}

.best-platform__submit:disabled {
  opacity: 0.45;
  cursor: default;
}

.best-platform__error {
  margin: 0;
  color: #d45d5d;
  font-size: 0.85rem;
  text-align: right;
}

@media (max-width: 640px) {
  .best-platform__grid {
    grid-template-columns: 1fr;
  }

  .best-platform__actions {
    margin-left: auto;
  }
}
</style>
