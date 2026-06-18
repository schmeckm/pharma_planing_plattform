import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useLocaleStore } from '@/stores/locale';
import { t as translate, getNavSections, getRouteTitle } from '@/i18n';

export function useI18n() {
  const localeStore = useLocaleStore();
  const { locale } = storeToRefs(localeStore);

  function t(path, params) {
    return translate(locale.value, path, params);
  }

  const navSections = computed(() => getNavSections(locale.value));

  function routeTitle(routeName) {
    return getRouteTitle(locale.value, routeName);
  }

  return { locale, t, navSections, routeTitle };
}
