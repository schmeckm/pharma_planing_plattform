import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export function useAdminNavLinks() {
  const { t } = useI18n();

  return computed(() => [
    { to: '/admin', label: t('nav.adminDashboard') },
    { to: '/admin/users', label: t('admin.users.title') },
    { to: '/admin/audit', label: t('admin.audit.title') },
    { to: '/admin/system', label: t('admin.system.title') },
    { to: '/admin/email', label: t('admin.email.title') },
  ]);
}
