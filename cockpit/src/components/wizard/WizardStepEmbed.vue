<template>
  <div v-if="hasContent" class="step-embed">
    <div v-if="stepId === 'daily-plan'" class="step-embed__grid">
      <div><span>Aufträge</span><strong>{{ ctx.dashboardKpis?.openOrders ?? '—' }}</strong></div>
      <div><span>Risiko</span><strong>{{ ctx.dashboardKpis?.highRiskOrders ?? '—' }}</strong></div>
      <div><span>Spät</span><strong>{{ ctx.dashboardKpis?.lateOrders ?? '—' }}</strong></div>
      <div><span>Auslastung</span><strong>{{ ctx.dashboardKpis?.peakUtilization ?? '—' }} %</strong></div>
    </div>
    <div v-if="stepId === 'daily-plan' && ctx.executability" class="step-embed__exec">
      <span>Ausführbar: {{ ctx.executability.executable }}/{{ ctx.executability.total }}</span>
      <span>Blockiert: {{ ctx.executability.blocked }}</span>
      <span>Quote: {{ ctx.executability.executableRate }}%</span>
    </div>

    <ul v-else-if="stepId === 'sequencing' && ctx.topSequence?.length" class="step-embed__list">
      <li v-for="(item, i) in ctx.topSequence.slice(0, 3)" :key="item.packagingOrder || item.packagingOrderId">
        {{ i + 1 }}. {{ item.packagingOrder || item.packagingOrderId }}
        <span class="muted">{{ item.productionLine }} · {{ item.plannedStartDate }}</span>
      </li>
    </ul>

    <div v-else-if="stepId === 'sequencing' && ctx.degradedLines?.length" class="step-embed__alert">
      <span v-for="l in ctx.degradedLines.slice(0, 3)" :key="l.lineId">
        {{ l.lineName || l.lineId }}: {{ Math.round(l.performanceFactor * 100) }} % Leistung
      </span>
    </div>

    <div v-else-if="stepId === 'exceptions'" class="step-embed__grid">
      <div><span>Offen</span><strong>{{ ctx.exceptionCount ?? 0 }}</strong></div>
    </div>

    <div v-else-if="stepId === 'confirm'" class="step-embed__grid">
      <div><span>Bestätigt</span><strong>{{ ctx.confirmedCount ?? '—' }}</strong></div>
    </div>

    <p v-else-if="stepId === 'simulation'" class="step-embed__line">
      {{ ctx.openOrders ?? '—' }} offene Aufträge · Simulation pro Auftrag
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  stepId: { type: String, required: true },
  ctx: { type: Object, default: () => ({}) },
});

const hasContent = computed(() => {
  const { stepId, ctx } = props;
  if (stepId === 'daily-plan') return !!ctx.dashboardKpis || !!ctx.executability;
  if (stepId === 'sequencing') return (ctx.topSequence?.length || ctx.degradedLines?.length);
  if (stepId === 'exceptions') return ctx.exceptionCount != null;
  if (stepId === 'confirm') return ctx.confirmedCount != null;
  if (stepId === 'simulation') return ctx.openOrders != null;
  return false;
});
</script>

<style scoped>
.step-embed {
  margin: 16px 0;
  padding: 14px 16px;
  background: #f5f6f7;
  border-radius: var(--radius, 6px);
  font-size: 0.875rem;
}

.step-embed__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.step-embed__grid span {
  display: block;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.step-embed__list {
  margin: 0;
  padding-left: 1.2rem;
  line-height: 1.6;
}

.step-embed__list .muted {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.step-embed__alert {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #b88230;
}

.step-embed__line {
  margin: 0;
  color: var(--color-text-muted);
}

.step-embed__exec {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

@media (max-width: 700px) {
  .step-embed__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
