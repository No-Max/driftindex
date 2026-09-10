<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const { t, locale } = useI18n();
const route = useRoute();

const isRu = computed(() => locale.value === 'ru');

function setLocale(next: 'en' | 'ru') {
  locale.value = next;
}
</script>

<template>
  <div class="app-shell">
    <header class="header">
      <div class="container header__inner">
        <RouterLink to="/" class="brand">
          <span class="brand__mark">DI</span>
          <span>
            <strong>{{ t('brand') }}</strong>
            <small>{{ t('tagline') }}</small>
          </span>
        </RouterLink>

        <nav class="header__nav">
          <RouterLink to="/">{{ t('nav.home') }}</RouterLink>
          <RouterLink to="/pilots">{{ t('nav.pilots') }}</RouterLink>
          <RouterLink to="/series">{{ t('nav.series') }}</RouterLink>
          <div class="lang-switch">
            <button :class="{ active: !isRu }" type="button" @click="setLocale('en')">{{ t('lang.en') }}</button>
            <button :class="{ active: isRu }" type="button" @click="setLocale('ru')">{{ t('lang.ru') }}</button>
          </div>
        </nav>
      </div>
    </header>

    <main class="container main">
      <RouterView :key="route.fullPath" />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.header {
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(12px);
  background: rgba(11, 13, 16, 0.82);
  border-bottom: 1px solid var(--border);
}

.header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 72px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.brand strong {
  display: block;
  font-family: Oswald, sans-serif;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.brand small {
  color: var(--muted);
  font-size: 0.8rem;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent);
  font-family: Oswald, sans-serif;
  font-weight: 600;
}

.header__nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header__nav a.router-link-active {
  color: var(--accent);
}

.lang-switch {
  display: inline-flex;
  padding: 0.2rem;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.lang-switch button {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
}

.lang-switch button.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.main {
  padding: 2rem 0 4rem;
}
</style>
