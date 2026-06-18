<template>
  <section class="page">
    <h1>{{ t('nav.dashboard') }}</h1>
    <p class="muted">{{ t('dashboard.welcome', { name: auth.user?.displayName || '' }) }}</p>

    <div class="kpi-grid">
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('dashboard.role') }}</p>
        <p class="kpi-card__value">{{ roleLabel }}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('dashboard.email') }}</p>
        <p class="kpi-card__value kpi-card__value--small">{{ auth.user?.email }}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('dashboard.status') }}</p>
        <p class="kpi-card__value">{{ health.status }}</p>
      </article>
    </div>

    <div class="panel">
      <div class="panel__header">
        <h2>{{ t('dashboard.placeholderTitle') }}</h2>
      </div>
      <div class="panel__body">
        <p class="muted">{{ t('dashboard.placeholder') }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/authStore';
import { useHealthStore } from '../stores/healthStore';

const { t } = useI18n();
const auth = useAuthStore();
const health = useHealthStore();

const roleLabel = computed(() =>
  auth.user?.role === 'admin' ? t('roles.admin') : t('roles.user')
);

onMounted(() => {
  health.fetchHealth();
});
</script>

<style scoped>
.kpi-card__value--small {
  font-size: 0.95rem;
  word-break: break-all;
}
</style>
