<script setup lang="ts">
import type { PollDetail } from '@drift-index/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchPolls } from '../api/client';
import BestPilotVote from '../components/home/BestPilotVote.vue';
import BestPlatformVote from '../components/home/BestPlatformVote.vue';
import BestSeriesVote from '../components/home/BestSeriesVote.vue';
import SeriesDuelsVote from '../components/home/SeriesDuelsVote.vue';
import TelegramLoginButton from '../components/TelegramLoginButton.vue';
import { useAuth } from '../composables/useAuth';

const { t } = useI18n();
const { user, ready, isAuthenticated, loginTelegram, logout } = useAuth();
const loginError = ref('');
const loading = ref(true);
const error = ref(false);
const polls = ref<PollDetail[]>([]);

const botUsername = computed(
  () => import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim() || '',
);

const displayName = computed(() => {
  if (!user.value) return '';
  if (user.value.username) return `@${user.value.username}`;
  const name = [user.value.firstName, user.value.lastName].filter(Boolean).join(' ');
  return name || t('home.fanVote.signedIn');
});

const pilotsPoll = computed(
  () => polls.value.find((poll) => poll.type === 'PILOTS') ?? null,
);
const seriesPoll = computed(
  () => polls.value.find((poll) => poll.type === 'SERIES') ?? null,
);
const platformPoll = computed(
  () => polls.value.find((poll) => poll.type === 'CARS') ?? null,
);
const duelPolls = computed(() =>
  polls.value.filter((poll) => poll.type === 'DUEL'),
);
const duelYear = computed(() => duelPolls.value[0]?.year ?? null);
const duelBlockTitle = computed(() => {
  const base = t('home.fanVote.duelTitle');
  return duelYear.value != null ? `${base} · ${duelYear.value}` : base;
});

async function loadPolls() {
  loading.value = true;
  error.value = false;
  try {
    const payload = await fetchPolls();
    polls.value = payload.polls;
  } catch {
    error.value = true;
    polls.value = [];
  } finally {
    loading.value = false;
  }
}

function onPollUpdate(next: PollDetail) {
  const index = polls.value.findIndex((poll) => poll.id === next.id);
  if (index >= 0) {
    polls.value[index] = next;
  } else {
    polls.value.push(next);
  }
}

async function onTelegramAuth(payload: Parameters<typeof loginTelegram>[0]) {
  loginError.value = '';
  try {
    await loginTelegram(payload);
  } catch {
    loginError.value = t('home.fanVote.loginFailed');
  }
}

onMounted(loadPolls);
watch(isAuthenticated, () => {
  void loadPolls();
});
</script>

<template>
  <div class="votes-page">
    <header class="votes-page__hero">
      <h1 class="page-title">{{ t('votes.title') }}</h1>
      <p class="page-subtitle">{{ t('votes.subtitle') }}</p>
    </header>

    <section class="votes-page__auth">
      <template v-if="!ready">
        <p class="votes-page__muted">{{ t('home.fanVote.checking') }}</p>
      </template>
      <template v-else-if="isAuthenticated">
        <div class="votes-page__user">
          <img
            v-if="user?.photoUrl"
            class="votes-page__user-avatar"
            :src="user.photoUrl"
            :alt="displayName"
            width="28"
            height="28"
          />
          <span>{{ displayName }}</span>
          <button type="button" class="votes-page__logout" @click="logout">
            {{ t('home.fanVote.logout') }}
          </button>
        </div>
      </template>
      <template v-else-if="botUsername">
        <p class="votes-page__muted">{{ t('home.fanVote.loginToVote') }}</p>
        <TelegramLoginButton
          :bot-username="botUsername"
          @auth="onTelegramAuth"
          @error="loginError = $event"
        />
        <p v-if="loginError" class="votes-page__error">{{ loginError }}</p>
      </template>
    </section>

    <p v-if="loading" class="votes-page__muted">{{ t('states.loading') }}</p>
    <p v-else-if="error" class="votes-page__muted">{{ t('states.error') }}</p>

    <template v-else>
      <section v-if="pilotsPoll" class="votes-page__section">
        <BestPilotVote :poll="pilotsPoll" @update="onPollUpdate" />
      </section>

      <section v-if="seriesPoll" class="votes-page__section">
        <BestSeriesVote :poll="seriesPoll" @update="onPollUpdate" />
      </section>

      <section v-if="platformPoll" class="votes-page__section">
        <BestPlatformVote :poll="platformPoll" @update="onPollUpdate" />
      </section>

      <section v-if="duelPolls.length > 0" class="votes-page__section">
        <div class="duels-block">
          <header class="duels-block__head">
            <p class="duels-block__eyebrow">{{ duelBlockTitle }}</p>
            <p class="duels-block__sub">{{ t('home.fanVote.duelBlockSub') }}</p>
          </header>
          <div class="duels-block__list">
            <SeriesDuelsVote
              v-for="duelPoll in duelPolls"
              :key="duelPoll.id"
              :poll="duelPoll"
              embedded
              @update="onPollUpdate"
            />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.votes-page {
  display: grid;
  gap: 2rem;
}

.votes-page__hero {
  margin: 0;
}

.votes-page__auth {
  display: grid;
  gap: 0.5rem;
  justify-items: start;
}

.votes-page__muted {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.votes-page__user {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.votes-page__user-avatar {
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border);
}

.votes-page__logout {
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.votes-page__logout:hover {
  color: var(--text);
}

.votes-page__error {
  margin: 0;
  color: #d45d5d;
  font-size: 0.85rem;
}

.votes-page__section {
  display: grid;
  gap: 1rem;
}

.duels-block {
  display: grid;
  gap: 1.15rem;
}

.duels-block__head {
  margin: 0;
}

.duels-block__eyebrow {
  margin: 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 1.55rem;
}

.duels-block__sub {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.duels-block__list {
  display: grid;
  gap: 1.25rem;
}
</style>
