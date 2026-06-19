<template>
  <div class="chart-wrap">
    <Bar v-if="capacity" :data="chartData" :options="chartOptions" />
    <el-empty v-else :description="t('mlPrognosis.charts.noCapacity')" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'vue-chartjs';
import { useI18n } from '@/composables/useI18n';
import { capacityUtilColor, chartFreeCapacityColor, mergeChartOptions } from '@/utils/chartColors';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const props = defineProps({
  capacity: { type: Object, default: null },
  horizon: { type: Number, default: 30 },
});

const { t } = useI18n();

const chartData = computed(() => {
  const util = props.capacity?.projectedUtilizationPercent ?? 0;
  const headroom = Math.max(0, 100 - Math.min(util, 100));
  return {
    labels: [
      t('mlPrognosis.charts.utilizationT', { horizon: props.horizon }),
      t('mlPrognosis.charts.freeCapacity'),
    ],
    datasets: [
      {
        label: t('mlPrognosis.charts.capacityPct'),
        data: [Math.min(util, 150), headroom],
        backgroundColor: [
          capacityUtilColor(util),
          chartFreeCapacityColor(),
        ],
      },
    ],
  };
});

const chartOptions = computed(() => mergeChartOptions({
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(ctx) {
          if (ctx.dataIndex === 0 && props.capacity) {
            return `${ctx.raw}% (${props.capacity.recentCompletedQuantity} / ${props.capacity.theoreticalCapacity} EA)`;
          }
          return `${ctx.raw}%`;
        },
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      max: 150,
      title: { display: true, text: `${t('common.utilization')} %` },
    },
    y: { stacked: true },
  },
}));
</script>

<style scoped>
.chart-wrap {
  height: 120px;
  padding: 4px 12px 0;
  max-width: 520px;
}
</style>
