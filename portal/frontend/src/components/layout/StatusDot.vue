<template>
  <span class="status-dot" :class="`status-dot--${variant}`" :title="label" />
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: { type: String, required: true },
  label: { type: String, default: '' },
});

const variant = computed(() => {
  const value = props.status.toLowerCase();
  if (['online', 'ok', 'aktiv', 'konfiguriert', 'active'].includes(value)) return 'ok';
  if (['degraded', 'warn', 'inaktiv', 'nicht konfiguriert', 'offline'].includes(value)) return 'warn';
  return 'fail';
});
</script>

<style scoped>
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot--ok {
  background: var(--color-success);
  box-shadow: 0 0 0 2px rgba(0, 230, 118, 0.18);
}

.status-dot--warn {
  background: var(--color-warning);
  box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.18);
}

.status-dot--fail {
  background: var(--color-error);
  box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.18);
}
</style>
