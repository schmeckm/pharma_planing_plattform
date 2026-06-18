<template>
  <div v-if="comparison" class="opt-impact panel">
    <div class="opt-impact-header">
      <div>
        <h2>Optimization result</h2>
        <p class="opt-impact-summary">{{ summaryText }}</p>
      </div>
      <Tag
        :value="verdictLabel"
        :severity="verdictSeverity"
      />
    </div>
    <div class="opt-impact-grid">
      <div
        v-for="metric in metrics"
        :key="metric.label"
        class="opt-metric"
        :class="metric.tone"
      >
        <span class="opt-metric-label">{{ metric.label }}</span>
        <span class="opt-metric-value">{{ metric.display }}</span>
        <span v-if="metric.delta" class="opt-metric-delta">{{ metric.delta }}</span>
      </div>
    </div>
    <p v-if="persistHint" class="opt-hint">{{ persistHint }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Tag from 'primevue/tag';
import { plannerText } from '@/utils/plannerTerminology';

const props = defineProps({
  comparison: { type: Object, default: null },
  persisted: { type: Boolean, default: false },
});

const summaryText = computed(() => plannerText(props.comparison?.summary || 'No significant change'));

const metrics = computed(() => {
  const c = props.comparison;
  if (!c) return [];
  const items = [
    {
      label: 'Late',
      before: c.lateOrders?.before,
      after: c.lateOrders?.after,
      invert: true,
    },
    {
      label: 'RMSL violations',
      before: c.rmslViolations?.before,
      after: c.rmslViolations?.after,
      invert: true,
    },
    {
      label: 'Risk score',
      before: c.riskDelta?.before,
      after: c.riskDelta?.after,
      invert: true,
    },
    {
      label: 'Orders moved',
      display: String(c.ordersMoved ?? 0),
      neutral: true,
    },
  ];
  if (c.oeeImpact) {
    items.push({
      label: 'Avg OEE',
      before: c.oeeImpact.before,
      after: c.oeeImpact.after,
      suffix: '%',
      invert: false,
    });
  }
  if (c.deliveryRisk) {
    items.push({
      label: 'Delivery risk',
      before: c.deliveryRisk.before,
      after: c.deliveryRisk.after,
      invert: true,
    });
  }

  return items.map((m) => {
    if (m.neutral) {
      return { label: m.label, display: m.display, delta: null, tone: 'neutral' };
    }
    const delta = (m.after ?? 0) - (m.before ?? 0);
    const improved = m.invert ? delta < 0 : delta > 0;
    const suffix = m.suffix || '';
    return {
      label: m.label,
      display: `${m.before ?? '—'}${suffix} → ${m.after ?? '—'}${suffix}`,
      delta: delta === 0 ? '±0' : `${delta > 0 ? '+' : ''}${delta}${suffix}`,
      tone: delta === 0 ? 'neutral' : improved ? 'good' : 'warn',
    };
  });
});

const improvedCount = computed(() => metrics.value.filter((m) => m.tone === 'good').length);

const verdictLabel = computed(() => {
  if (!props.comparison) return '';
  if (improvedCount.value >= 2) return 'Improved';
  if (improvedCount.value === 1) return 'Partially improved';
  return 'Review';
});

const verdictSeverity = computed(() => {
  if (improvedCount.value >= 2) return 'success';
  if (improvedCount.value === 1) return 'warn';
  return 'secondary';
});

const persistHint = computed(() => {
  if (props.persisted) return 'Impact recorded in Control Tower (planning impact).';
  return 'After activate plan or confirm sequence, impact appears in Supply Control Tower for MRP/schedulers.';
});
</script>

<style scoped>
.opt-impact {
  margin-bottom: 1rem;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 8px;
  background: var(--p-content-background, #fff);
  padding: 0.75rem 1rem 1rem;
}

.opt-impact-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.opt-impact-header h2 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.opt-impact-summary {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #64748b);
}

.opt-impact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

.opt-metric {
  border-radius: 6px;
  padding: 0.5rem 0.65rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.opt-metric.good {
  border-color: #86efac;
  background: #f0fdf4;
}

.opt-metric.warn {
  border-color: #fcd34d;
  background: #fffbeb;
}

.opt-metric-label {
  display: block;
  font-size: 0.72rem;
  color: #64748b;
}

.opt-metric-value {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
}

.opt-metric-delta {
  font-size: 0.75rem;
  color: #64748b;
}

.opt-hint {
  margin: 0.75rem 0 0;
  font-size: 0.78rem;
  color: #64748b;
}
</style>
