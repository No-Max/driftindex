<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="votes">
    <article class="card vote-card">
      <p class="vote-card__label">{{ t('home.fanVote.pilot') }}</p>
      <p class="vote-card__status">{{ t('home.fanVote.comingSoon') }}</p>
    </article>
    <article class="card vote-card">
      <p class="vote-card__label">{{ t('home.fanVote.car') }}</p>
      <p class="vote-card__status">{{ t('home.fanVote.comingSoon') }}</p>
    </article>
  </div>
</template>

<style scoped>
.votes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.vote-card {
  padding: 1.25rem;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.vote-card__label {
  margin: 0;
  font-family: Oswald, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.vote-card__status {
  margin: 0.5rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
