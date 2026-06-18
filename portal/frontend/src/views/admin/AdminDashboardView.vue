<template>
  <section class="page">
    <h1>{{ t('admin.overview.title') }}</h1>
    <p class="muted">{{ t('admin.welcome') }}</p>

    <div class="admin-grid">
      <RouterLink
        v-for="card in cards"
        :key="card.to"
        :to="card.to"
        class="admin-card"
      >
        <h2>{{ card.title }}</h2>
        <p>{{ card.text }}</p>
      </RouterLink>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const cards = computed(() => [
  { to: '/admin/users', title: t('admin.users.title'), text: t('admin.users.summary') },
  { to: '/admin/audit', title: t('admin.audit.title'), text: t('admin.audit.summary') },
  { to: '/admin/system', title: t('admin.system.title'), text: t('admin.system.summary') },
  { to: '/admin/email', title: t('admin.email.title'), text: t('admin.email.summary') },
]);
</script>
