<template>

  <div class="chart-wrap">

    <Bar v-if="rows.length" :data="chartData" :options="chartOptions" />

    <el-empty v-else :description="t('mlPrognosis.charts.noOee')" />

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



function shiftLabel(shiftId) {

  return t(`common.shifts.${shiftId}`) !== `common.shifts.${shiftId}` ? t(`common.shifts.${shiftId}`) : shiftId;

}



const chartData = computed(() => {

  const top = props.rows.slice(0, 8);

  return {

    labels: top.map((r) => {

      const line = r.lineId?.replace('PACK_LINE_', 'L') || r.lineId;

      return `${line} · ${shiftLabel(r.shiftId)}`;

    }),

    datasets: [

      {

        label: t('mlPrognosis.charts.histOeePct'),

        data: top.map((r) => r.historicalOee ?? 0),

        backgroundColor: '#64748b',

      },

      {

        label: t('mlPrognosis.charts.forecastOeePct'),

        data: top.map((r) => r.projectedOee ?? 0),

        backgroundColor: '#0a6ed1',

      },

    ],

  };

});



const chartOptions = computed(() => ({

  responsive: true,

  maintainAspectRatio: false,

  plugins: {

    legend: { position: 'bottom' },

  },

  scales: {

    y: {

      beginAtZero: true,

      max: 100,

      title: { display: true, text: 'OEE %' },

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

