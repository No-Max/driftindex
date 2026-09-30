<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import BrandMark from './components/BrandMark.vue';
import { useLocalePath } from './composables/useLocalePath';
import { usePageSeo } from './composables/usePageSeo';
import { stripLocalePrefix } from './i18n/locales';
import { countryFlagSrc } from './lib/countryFlag';

const { t, locale } = useI18n();
const route = useRoute();
const { localePath, switchLocale } = useLocalePath();

usePageSeo();

const menuOpen = ref(false);

const isRu = computed(() => locale.value === 'ru');
const enFlagSrc = countryFlagSrc('GB', 80);
const ruFlagSrc = countryFlagSrc('RU', 80);
const copyrightYear = new Date().getFullYear();

const footerLinks = computed(() => {
  const current = stripLocalePrefix(route.path);
  const links = [
    { path: '/', label: t('nav.home') },
    { path: '/pilots', label: t('nav.pilots') },
    { path: '/series', label: t('nav.series') },
    { path: '/tracks', label: t('nav.tracks') },
    { path: '/votes', label: t('nav.votes') },
  ];
  return links.filter((link) => {
    if (link.path === '/') return current !== '/';
    return current !== link.path && !current.startsWith(`${link.path}/`);
  });
});

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
          <span class="brand__mark">
            <BrandMark :title="t('brand')" />
          </span>
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
          <RouterLink :to="localePath('/votes')">{{ t('nav.votes') }}</RouterLink>
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

    <footer class="footer">
      <div class="container footer__inner">
        <div class="footer__top">
          <RouterLink :to="localePath('/')" class="footer__brand" :aria-label="t('brand')">
            <img
              class="footer__logo"
              src="/brand/di-mark.png"
              :alt="t('brand')"
              width="40"
              height="42"
              decoding="async"
            />
          </RouterLink>

          <nav v-if="footerLinks.length > 0" class="footer__nav" :aria-label="t('nav.footer')">
            <RouterLink
              v-for="link in footerLinks"
              :key="link.path"
              :to="localePath(link.path)"
            >
              {{ link.label }}
            </RouterLink>
          </nav>

          <div class="lang-switch" role="group" :aria-label="t('lang.label')">
            <button
              :class="{ active: !isRu }"
              type="button"
              :aria-label="t('lang.en')"
              :title="t('lang.en')"
              @click="switchLocale('en')"
            >
              <img v-if="enFlagSrc" :src="enFlagSrc" alt="" width="28" height="28" />
            </button>
            <button
              :class="{ active: isRu }"
              type="button"
              :aria-label="t('lang.ru')"
              :title="t('lang.ru')"
              @click="switchLocale('ru')"
            >
              <img v-if="ruFlagSrc" :src="ruFlagSrc" alt="" width="28" height="28" />
            </button>
          </div>
        </div>

        <p class="footer__copy">{{ t('footer.copyright', { year: copyrightYear }) }}</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
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

@media (max-width: 420px) {
  .brand small {
    display: none;
  }
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #000;
  flex-shrink: 0;
  overflow: hidden;
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

.main {
  flex: 1;
  padding: 2.25rem 0 3rem;
  min-width: 0;
  max-width: 100%;
}

.footer {
  margin-top: auto;
  border-top: 1px solid var(--border);
  background: rgba(11, 13, 16, 0.92);
}

.footer__inner {
  display: grid;
  gap: 1rem;
  padding: 1.5rem 0 2rem;
}

.footer__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 1.5rem;
}

.footer__brand {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #000;
  overflow: hidden;
  flex-shrink: 0;
}

.footer__logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.footer__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.1rem;
  font-size: 0.95rem;
}

.footer__nav a {
  color: var(--muted);
  text-decoration: none;
}

.footer__nav a:hover {
  color: var(--accent);
}

.footer__copy {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.lang-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.lang-switch button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  overflow: hidden;
  opacity: 0.55;
  transition: opacity 0.15s, border-color 0.15s;
}

.lang-switch button img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}

.lang-switch button:hover {
  opacity: 0.85;
}

.lang-switch button.active {
  opacity: 1;
  border-color: var(--accent);
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

  .header__nav a:last-child {
    border-bottom: 0;
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

@media (max-width: 720px) {
  .footer__top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
