<template>
  <footer class="app-footer">
    <div class="app-footer__left">
      <span class="app-footer__brand">{{ t('app.name') }}</span>
      <span class="app-footer__sep">·</span>
      <span class="app-footer__muted">v{{ health.version }}</span>
    </div>

    <div class="app-footer__services">
      <span
        v-for="service in health.services"
        :key="service.id"
        class="app-footer__service"
        :title="serviceLatency(service)"
      >
        <StatusDot :status="service.status" :label="service.label" />
        <span>{{ service.label }}</span>
        <span class="app-footer__status-label">{{ formatStatus(service.status) }}</span>
      </span>
    </div>

    <div class="app-footer__right">
      <span class="app-footer__muted">{{ checkedLabel }}</span>
    </div>
  </footer>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHealthStore } from '../../stores/healthStore';
import StatusDot from './StatusDot.vue';

const { t } = useI18n();
const health = useHealthStore();

const checkedLabel = computed(() => {
  if (!health.checkedAt) return t('footer.checking');
  return new Date(health.checkedAt).toLocaleString();
});

function formatStatus(status) {
  const key = `footer.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function serviceLatency(service) {
  if (service.latencyMs == null) return service.label;
  return `${service.label}: ${service.latencyMs} ms`;
}

onMounted(() => {
  health.startPolling();
});

onBeforeUnmount(() => {
  health.stopPolling();
});
</script>

<style scoped>
.app-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: var(--footer-height);
  padding: 0 12px;
  font-size: 0.72rem;
  color: var(--color-muted);
  overflow: hidden;
}

.app-footer__left,
.app-footer__right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  white-space: nowrap;
}

.app-footer__brand {
  color: var(--color-text);
  font-weight: 600;
}

.app-footer__sep {
  opacity: 0.4;
}

.app-footer__services {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
  scrollbar-width: none;
}

.app-footer__services::-webkit-scrollbar {
  display: none;
}

.app-footer__service {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.app-footer__status-label {
  color: var(--color-accent);
  font-weight: 600;
}

@media (max-width: 1100px) {
  .app-footer__right {
    display: none;
  }
}

@media (max-width: 800px) {
  .app-footer__services .app-footer__status-label {
    display: none;
  }
}
</style>
