<template>
  <div class="chart-wrap">
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'vue-chartjs';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps({
  orders: { type: Array, default: () => [] },
});

const countryCounts = computed(() => {
  const counts = {};
  for (const order of props.orders) {
    const c = order.destinationCountry || 'Unknown';
    counts[c] = (counts[c] || 0) + 1;
  }
  return counts;
});

const chartData = computed(() => ({
  labels: Object.keys(countryCounts.value),
  datasets: [
    {
      data: Object.values(countryCounts.value),
      backgroundColor: ['#0a6ed1', '#107e3e', '#e9730c', '#bb0000', '#6a6d70', '#8859ff'],
      borderWidth: 0,
    },
  ],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { boxWidth: 12, padding: 12, font: { size: 11 } },
    },
  },
  cutout: '65%',
};
</script>

<style scoped>
.chart-wrap {
  height: 220px;
  position: relative;
}
</style>
