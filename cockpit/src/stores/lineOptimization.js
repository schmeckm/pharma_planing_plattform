import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { lineOptimizationApi } from '@/api/lineOptimization';
import { addDays } from '@/utils/dateHelpers';

export const useLineOptimizationStore = defineStore('lineOptimization', () => {
  const loading = ref(false);
  const orders = ref([]);
  const ganttTasks = ref([]);
  const lines = ref([]);
  const timelineStart = ref('2026-09-01');
  const timelineEnd = ref('2026-09-15');
  const kpis = ref({});
  const selectedTask = ref(null);
  const comparison = ref(null);
  const lastScenario = ref(null);
  const localSequence = ref([]);

  const kpiCards = computed(() => [
    { label: 'Open Rough Planned', value: kpis.value.openRoughPlanned ?? 0, accent: 'primary' },
    { label: 'Optimized Orders', value: kpis.value.optimizedOrders ?? 0, accent: 'success' },
    { label: 'High Risk Orders', value: kpis.value.highRiskOrders ?? 0, accent: 'warning' },
    { label: 'Shelf-Life Risk Orders', value: kpis.value.rmslRiskOrders ?? 0, accent: 'warning' },
    { label: 'Sequence Check Issues', value: kpis.value.jpSequenceIssues ?? 0, accent: 'warning' },
    { label: 'Peak Line Util %', value: kpis.value.peakUtilization ?? 0, suffix: '%', accent: 'info' },
  ]);

  async function load() {
    loading.value = true;
    try {
      const [orderData, lineData] = await Promise.all([
        lineOptimizationApi.getOrders(),
        lineOptimizationApi.getLines(),
      ]);
      orders.value = orderData.orders;
      ganttTasks.value = orderData.ganttTasks;
      timelineStart.value = orderData.timelineStart;
      timelineEnd.value = orderData.timelineEnd;
      kpis.value = orderData.kpis;
      lines.value = lineData.lines;
      localSequence.value = orderData.orders.map((o) => ({
        packagingOrder: o.packagingOrder || o.packagingOrderId,
        productionLine: o.productionLine,
        plannedStartDate: o.plannedStartDate,
        plannedEndDate: o.plannedEndDate,
        recommendedBatchId: o.recommendedBatchId,
      }));
    } finally {
      loading.value = false;
    }
  }

  async function runOptimize() {
    loading.value = true;
    try {
      const result = await lineOptimizationApi.optimize({});
      orders.value = result.optimized;
      ganttTasks.value = result.ganttTasks;
      timelineStart.value = result.timelineStart;
      timelineEnd.value = result.timelineEnd;
      kpis.value = result.kpis;
      comparison.value = result.comparison;
      lastScenario.value = result;
      localSequence.value = result.optimized.map((o) => ({
        packagingOrder: o.packagingOrder || o.packagingOrderId,
        productionLine: o.productionLine,
        plannedStartDate: o.plannedStartDate,
        plannedEndDate: o.plannedEndDate,
        recommendedBatchId: o.recommendedBatchId,
      }));
    } finally {
      loading.value = false;
    }
  }

  async function runSimulate() {
    loading.value = true;
    try {
      const result = await lineOptimizationApi.simulate(localSequence.value);
      orders.value = result.result;
      kpis.value = result.kpis;
      comparison.value = result.comparison;
      lastScenario.value = result;
      ganttTasks.value = result.ganttTasks || [];
      if (result.timelineStart) timelineStart.value = result.timelineStart;
      if (result.timelineEnd) timelineEnd.value = result.timelineEnd;
    } finally {
      loading.value = false;
    }
  }

  async function saveSequence(label) {
    loading.value = true;
    try {
      return await lineOptimizationApi.saveSequence({ sequence: localSequence.value, label });
    } finally {
      loading.value = false;
    }
  }

  function updateTaskPosition(taskId, newLineId, newStartDate) {
    const order = orders.value.find((o) => (o.packagingOrder || o.packagingOrderId) === taskId);
    const duration = order
      ? Math.max(1, Math.ceil((new Date(order.plannedEndDate) - new Date(order.plannedStartDate)) / 86400000) + 1)
      : 2;
    const endDate = addDays(newStartDate, duration - 1);

    localSequence.value = localSequence.value.map((item) =>
      item.packagingOrder === taskId
        ? { ...item, productionLine: newLineId, plannedStartDate: newStartDate, plannedEndDate: endDate }
        : item
    );

    orders.value = orders.value.map((o) => {
      const id = o.packagingOrder || o.packagingOrderId;
      if (id !== taskId) return o;
      return { ...o, productionLine: newLineId, plannedStartDate: newStartDate, plannedEndDate: endDate };
    });

    ganttTasks.value = ganttTasks.value.map((t) =>
      t.id === taskId ? { ...t, productionLine: newLineId, start: newStartDate, end: endDate } : t
    );
  }

  function selectTask(task) {
    selectedTask.value = orders.value.find(
      (o) => (o.packagingOrder || o.packagingOrderId) === task.id
    ) || task;
  }

  return {
    loading, orders, ganttTasks, lines, timelineStart, timelineEnd, kpis, kpiCards,
    selectedTask, comparison, lastScenario, localSequence,
    load, runOptimize, runSimulate, saveSequence, updateTaskPosition, selectTask,
  };
});
