import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { SUPPORTED_LOCALES } from '@/i18n/agent';

const STORAGE_KEY = 'hap_locale';

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) return stored;
  } catch { /* ignore */ }
  return 'de';
}

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref(readStoredLocale());

  const options = SUPPORTED_LOCALES;

  const current = computed(() => options.find((l) => l.code === locale.value) || options[0]);

  function setLocale(code) {
    if (!options.some((l) => l.code === code)) return;
    locale.value = code;
    localStorage.setItem(STORAGE_KEY, code);
    document.documentElement.lang = code;
  }

  document.documentElement.lang = locale.value;

  return { locale, options, current, setLocale };
});
