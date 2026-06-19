<template>
  <div class="kpi-card" :class="`kpi-card--${accent}`">
    <div class="kpi-card__icon">
      <el-icon :size="20"><component :is="icon" /></el-icon>
    </div>
    <div class="kpi-card__body">
      <div class="kpi-card__label">{{ label }}</div>
      <div class="kpi-card__value">{{ formattedValue }}</div>
      <div v-if="subtitle" class="kpi-card__subtitle">{{ subtitle }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: String,
  value: [String, Number],
  subtitle: String,
  icon: { type: String, default: 'DataLine' },
  accent: { type: String, default: 'primary' },
  suffix: String,
});

const formattedValue = computed(() => {
  if (props.suffix) return `${props.value}${props.suffix}`;
  return props.value;
});
</script>

<style scoped>
.kpi-card {
  background: var(--color-panel, #ffffff);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  gap: 12px;
  box-shadow: var(--shadow-sm);
  border-top: 3px solid var(--blue-500, var(--color-accent));
}

.kpi-card--primary { border-top-color: var(--blue-500, var(--color-accent)); }
.kpi-card--success { border-top-color: var(--color-success); }
.kpi-card--warning { border-top-color: var(--color-warning); }
.kpi-card--info { border-top-color: var(--blue-400, var(--color-info)); }
.kpi-card--neutral { border-top-color: var(--color-neutral); }

.kpi-card__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  background: var(--blue-50, var(--color-accent-soft));
  color: var(--blue-600, var(--color-accent));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-card__label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.kpi-card__value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.kpi-card__subtitle {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  margin-top: 4px;
}
</style>
