<template>
  <div class="line-scorecard panel">
    <div class="line-scorecard__head">
      <h2>Line scorecard</h2>
      <Tag
        v-if="planStability?.ppsPercent != null"
        :value="`PPS ${planStability.ppsPercent}%`"
        :severity="ppsSeverity"
      />
    </div>
    <p v-if="comparisonSummary" class="line-scorecard__summary">{{ comparisonSummary }}</p>
    <div v-if="aggregateChips.length" class="line-scorecard__aggregates">
      <span v-for="chip in aggregateChips" :key="chip.label" class="metric-chip">
        <span class="metric-chip__label">{{ chip.label }}</span>
        <span class="metric-chip__value">{{ chip.value }}</span>
      </span>
    </div>
    <div class="line-scorecard__grid">
      <div v-for="line in lines" :key="line.lineId" class="line-scorecard__row">
        <div class="line-scorecard__line">
          <strong>{{ line.label || line.lineId }}</strong>
          <span class="muted">{{ line.orderCount }} orders</span>
        </div>
        <div class="line-scorecard__metrics">
          <span>Late: {{ line.lateOrders ?? 0 }}</span>
          <span>Moved: {{ line.ordersMoved ?? line.movedOrders ?? 0 }}</span>
        </div>
      </div>
    </div>
    <p v-if="!lines.length" class="empty-hint">No line data — load sequence or run optimization.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Tag from 'primevue/tag';

const props = defineProps({
  scorecard: { type: Object, default: null },
  planStability: { type: Object, default: null },
  comparison: { type: Object, default: null },
});

const lines = computed(() => props.scorecard?.lines || []);
const comparisonSummary = computed(() =>
  props.scorecard?.comparisonSummary || props.comparison?.summary || null,
);

const aggregateChips = computed(() => {
  const agg = props.scorecard?.aggregates;
  if (!agg) return [];
  return [
    { label: 'Late avoided', value: agg.lateOrdersAvoided ?? 0 },
    { label: 'RMSL reduced', value: agg.rmslViolationsReduced ?? 0 },
    { label: 'Risk improved', value: agg.riskScoreImprovement ?? 0 },
    { label: 'Orders moved', value: agg.ordersMoved ?? 0 },
  ].filter((c) => c.value !== 0 || props.comparison);
});

const ppsSeverity = computed(() => {
  const p = props.planStability?.ppsPercent;
  if (p == null) return 'secondary';
  if (p >= 95) return 'success';
  if (p >= 85) return 'warn';
  return 'danger';
});
</script>

<style scoped>
.line-scorecard {
  padding: 0.75rem 1rem 1rem;
}

.line-scorecard__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.line-scorecard__head h2 {
  margin: 0;
  font-size: 1rem;
}

.line-scorecard__summary {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.line-scorecard__aggregates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.metric-chip {
  display: flex;
  flex-direction: column;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  background: var(--color-surface-muted, #f5f6f7);
  font-size: 0.78rem;
}

.metric-chip__label {
  color: var(--color-text-muted);
}

.metric-chip__value {
  font-weight: 600;
}

.line-scorecard__grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.line-scorecard__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--color-border, #e8eaed);
  font-size: 0.85rem;
}

.line-scorecard__line .muted {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.line-scorecard__metrics {
  display: flex;
  gap: 1rem;
  color: var(--color-text-muted);
}

.empty-hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}
</style>
