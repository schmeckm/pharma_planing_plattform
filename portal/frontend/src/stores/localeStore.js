import { defineStore } from 'pinia';
import { i18n } from '../i18n';

export const useLocaleStore = defineStore('portalLocale', {
  state: () => ({
    locale: localStorage.getItem('locale') || 'de',
  }),
  actions: {
    setLocale(locale) {
      this.locale = locale;
      i18n.global.locale.value = locale;
      localStorage.setItem('locale', locale);
    },
  },
});
