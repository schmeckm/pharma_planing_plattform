<template>

  <div class="chart-wrap">

    <Bar v-if="rows.length" :data="chartData" :options="chartOptions" />

    <el-empty v-else :description="t('mlPrognosis.charts.noDemand')" />

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



ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);



const props = defineProps({

  rows: { type: Array, default: () => [] },

});



const { t } = useI18n();



const topRows = computed(() =>

  [...props.rows]

    .sort((a, b) => (b.projectedWeeklyQuantity || 0) - (a.projectedWeeklyQuantity || 0))

    .slice(0, 8),

);



const chartData = computed(() => {

  const top = topRows.value;

  return {

    labels: top.map((r) => r.materialNumber?.replace('DP-', 'D') || '—'),

    datasets: [

      {

        label: t('mlPrognosis.charts.forecastWeek'),

        data: top.map((r) => r.projectedWeeklyQuantity || 0),

        backgroundColor: '#0a6ed1',

      },

      {

        label: t('mlPrognosis.lastWeek'),

        data: top.map((r) => r.lastWeeklyQuantity || 0),

        backgroundColor: '#94a3b8',

      },

      {

        label: t('mlPrognosis.charts.openQty'),

        data: top.map((r) => r.openOrderQuantity || 0),

        backgroundColor: '#107e3e',

      },

    ],

  };

});



const chartOptions = computed(() => ({

  responsive: true,

  maintainAspectRatio: false,

  plugins: {

    legend: { position: 'bottom' },

    tooltip: {

      callbacks: {

        afterLabel(ctx) {

          const row = topRows.value[ctx.dataIndex];

          if (!row) return '';

          const trend = t(`common.trends.${row.trend}`) !== `common.trends.${row.trend}`

            ? t(`common.trends.${row.trend}`)

            : row.trend || '—';

          return t('mlPrognosis.charts.tooltipTrend', { trend, r2: row.modelR2 ?? '—' });

        },

      },

    },

  },

  scales: {

    y: {

      beginAtZero: true,

      title: { display: true, text: t('mlPrognosis.charts.quantityEa') },

    },

  },

}));

</script>



<style scoped>

.chart-wrap {

  height: 260px;

  padding: 8px 12px 0;

}

</style>

