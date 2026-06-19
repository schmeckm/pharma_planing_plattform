import { computed } from 'vue';

import { useI18n } from 'vue-i18n';



export function useUserNavLinks() {

  const { t } = useI18n();



  return computed(() => [
    { to: '/dashboard', label: t('nav.dashboard') },
  ]);

}


