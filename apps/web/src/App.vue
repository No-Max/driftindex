<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useLocalePath } from './composables/useLocalePath';
import { usePageSeo } from './composables/usePageSeo';

const { t, locale } = useI18n();
const route = useRoute();
const { localePath, switchLocale } = useLocalePath();

usePageSeo();

const menuOpen = ref(false);

const isRu = computed(() => locale.value === 'ru');

function closeMenu() {
  menuOpen.value = false;
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

watch(
  () => route.fullPath,
  () => {
    closeMenu();
  },
);

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu();
}

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onDocumentKeydown);
});
</script>

<template>
  <div class="app-shell">
    <header class="header">
      <div class="container header__inner">
        <RouterLink :to="localePath('/')" class="brand">
          <span class="brand__mark">DI</span>
          <span>
            <strong>{{ t('brand') }}</strong>
            <small>{{ t('tagline') }}</small>
          </span>
        </RouterLink>

        <button
          type="button"
          class="header__menu-btn"
          :aria-label="menuOpen ? t('nav.closeMenu') : t('nav.openMenu')"
          :aria-expanded="menuOpen"
          aria-controls="site-nav"
          @click="toggleMenu"
        >
          <span class="header__menu-icon" :class="{ 'header__menu-icon--open': menuOpen }">
            <span />
            <span />
            <span />
          </span>
        </button>

        <nav
          id="site-nav"
          class="header__nav"
          :class="{ 'header__nav--open': menuOpen }"
        >
          <RouterLink :to="localePath('/')">{{ t('nav.home') }}</RouterLink>
          <RouterLink :to="localePath('/pilots')">{{ t('nav.pilots') }}</RouterLink>
          <RouterLink :to="localePath('/series')">{{ t('nav.series') }}</RouterLink>
          <RouterLink :to="localePath('/tracks')">{{ t('nav.tracks') }}</RouterLink>
          <div class="lang-switch">
            <button :class="{ active: !isRu }" type="button" @click="switchLocale('en')">{{ t('lang.en') }}</button>
            <button :class="{ active: isRu }" type="button" @click="switchLocale('ru')">{{ t('lang.ru') }}</button>
          </div>
        </nav>
      </div>

      <button
        v-if="menuOpen"
        type="button"
        class="header__backdrop"
        :aria-label="t('nav.closeMenu')"
        @click="closeMenu"
      />
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
  z-index: 20;
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
  min-width: 0;
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
  flex-shrink: 0;
}

.header__menu-btn {
  display: none;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}

.header__menu-icon {
  display: grid;
  gap: 5px;
  width: 18px;
}

.header__menu-icon span {
  display: block;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  transition: transform 0.2s, opacity 0.2s;
}

.header__menu-icon--open span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.header__menu-icon--open span:nth-child(2) {
  opacity: 0;
}

.header__menu-icon--open span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

.header__nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.05rem;
}

.header__nav a.router-link-exact-active {
  color: var(--accent);
}

.header__backdrop {
  display: none;
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
  padding: 2.25rem 0 4.5rem;
}

@media (max-width: 1024px) {
  .header__menu-btn {
    display: grid;
    flex-shrink: 0;
  }

  .header__nav {
    position: fixed;
    top: 72px;
    left: 0;
    right: 0;
    z-index: 22;
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding: 0.5rem 1.25rem 1.25rem;
    background: rgba(11, 13, 16, 0.98);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  }

  .header__nav--open {
    display: flex;
  }

  .header__nav a {
    padding: 0.85rem 0;
    border-bottom: 1px solid var(--border);
  }

  .header__nav a:last-of-type {
    border-bottom: 0;
  }

  .lang-switch {
    align-self: flex-start;
    margin-top: 0.85rem;
  }

  .header__backdrop {
    display: block;
    position: fixed;
    inset: 72px 0 0;
    z-index: 21;
    border: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.45);
    cursor: pointer;
  }
}
</style>
