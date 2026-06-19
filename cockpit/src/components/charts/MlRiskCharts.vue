<template>
  <div class="risk-charts">
    <div class="risk-charts__tier">
      <p class="risk-charts__label">{{ t('mlPrognosis.charts.riskTiers') }}</p>
      <div class="chart-wrap chart-wrap--donut">
        <Doughnut v-if="hasRisk" :data="tierData" :options="donutOptions" />
        <el-empty v-else :description="t('mlPrognosis.charts.noRisk')" />
      </div>
    </div>
    <div class="risk-charts__top">
      <p class="risk-charts__label">{{ t('mlPrognosis.charts.topRiskOrders') }}</p>
      <div class="chart-wrap chart-wrap--bar">
        <Bar v-if="topRows.length" :data="topBarData" :options="barOptions" />
        <el-empty v-else :description="t('mlPrognosis.charts.noRiskOrders')" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Bar } from 'vue-chartjs';
import { useI18n } from '@/composables/useI18n';
import { mergeChartOptions, riskTierColor, riskTierPalette } from '@/utils/chartColors';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const props = defineProps({
  rows: { type: Array, default: () => [] },
});

const { t } = useI18n();

const tierCounts = computed(() => {
  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const r of props.rows) {
    const tier = r.suggestedTier || 'LOW';
    if (counts[tier] != null) counts[tier] += 1;
  }
  return counts;
});

const hasRisk = computed(() => props.rows.length > 0);

const tierData = computed(() => ({
  labels: ['LOW', 'MEDIUM', 'HIGH'],
  datasets: [
    {
      data: [tierCounts.value.LOW, tierCounts.value.MEDIUM, tierCounts.value.HIGH],
      backgroundColor: riskTierPalette(),
    },
  ],
}));

const topRows = computed(() =>
  [...props.rows]
    .sort((a, b) => (b.overallRiskProbability || 0) - (a.overallRiskProbability || 0))
    .slice(0, 8),
);

const topBarData = computed(() => ({
  labels: topRows.value.map((r) => r.packagingOrderId?.replace('FG-', '') || '—'),
  datasets: [
    {
      label: t('mlPrognosis.charts.overallRiskPct'),
      data: topRows.value.map((r) => Math.round((r.overallRiskProbability || 0) * 100)),
      backgroundColor: topRows.value.map((r) =>
        riskTierColor(r.suggestedTier || 'LOW'),
      ),
    },
  ],
}));

const donutOptions = computed(() => mergeChartOptions({
  plugins: { legend: { position: 'bottom' } },
}));

const barOptions = computed(() => mergeChartOptions({
  indexAxis: 'y',
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, max: 100, title: { display: true, text: t('mlPrognosis.charts.probabilityPct') } },
  },
}));
</script>

<style scoped>
.risk-charts {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 16px;
  padding: 8px 12px 0;
}
.risk-charts__label {
  margin: 0 0 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.chart-wrap--donut,
.chart-wrap--bar {
  height: 220px;
}
@media (max-width: 900px) {
  .risk-charts {
    grid-template-columns: 1fr;
  }
}
</style>
