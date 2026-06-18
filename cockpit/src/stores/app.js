import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { isUsingMock } from '@/api';
import { useLocaleStore } from '@/stores/locale';
import { t } from '@/i18n';

export const useAppStore = defineStore('app', () => {
  const loading = ref(false);
  const error = ref(null);
  const useMockData = ref(isUsingMock());
  const sidebarCollapsed = ref(false);
  const localeStore = useLocaleStore();

  const dataSourceLabel = computed(() =>
    useMockData.value
      ? t(localeStore.locale, 'footer.dataSource.mock')
      : t(localeStore.locale, 'footer.dataSource.live'),
  );

  function setLoading(value) {
    loading.value = value;
  }

  function setError(message) {
    error.value = message;
  }

  function clearError() {
    error.value = null;
  }

  async function withLoading(fn) {
    setLoading(true);
    clearError();
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    useMockData,
    sidebarCollapsed,
    dataSourceLabel,
    setLoading,
    setError,
    clearError,
    withLoading,
  };
});
