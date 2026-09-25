import { createI18n } from 'vue-i18n';
import { DEFAULT_LOCALE } from './locales';
import en from './locales/en.json';
import ru from './locales/ru.json';

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, ru },
});
