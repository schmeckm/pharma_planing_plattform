<template>
  <div class="chart-wrap">
    <Bar :data="chartData" :options="chartOptions" />
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
import { chartColorAt, mergeChartOptions } from '@/utils/chartColors';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const props = defineProps({
  lines: { type: Array, default: () => [] },
  horizon: { type: String, default: 'long' },
});

const chartData = computed(() => {
  const labels = props.lines.map((l) => l.lineId?.replace('PACK_', '') || l.lineId);
  const oeeKey = props.horizon === 'short' ? 'shortTermOee' : 'longTermOee';
  const factorKey = props.horizon === 'short' ? 'shortTermFactor' : 'longTermFactor';
  return {
    labels,
    datasets: [
      {
        label: 'OEE %',
        data: props.lines.map((l) => l[oeeKey] ?? 0),
        backgroundColor: chartColorAt(1),
        yAxisID: 'y',
      },
      {
        label: 'Leistungsfaktor',
        data: props.lines.map((l) => Math.round((l[factorKey] ?? 1) * 100)),
        backgroundColor: chartColorAt(2),
        yAxisID: 'y1',
      },
    ],
  };
});

const chartOptions = computed(() => mergeChartOptions({
  plugins: { legend: { position: 'bottom' } },
  scales: {
    y: {
      type: 'linear',
      position: 'left',
      max: 100,
      title: { display: true, text: 'OEE %' },
    },
    y1: {
      type: 'linear',
      position: 'right',
      max: 150,
      grid: { drawOnChartArea: false },
      title: { display: true, text: 'Faktor ×100' },
    },
  },
}));
</script>

<style scoped>
.chart-wrap {
  height: 280px;
}
</style>
