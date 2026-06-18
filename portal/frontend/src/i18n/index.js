import { createI18n } from 'vue-i18n';
import en from '../locales/en/index.js';
import de from '../locales/de/index.js';

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'de',
  fallbackLocale: 'en',
  messages: { en, de },
});
