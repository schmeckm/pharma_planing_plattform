import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { detailedSchedulingApi, connectSchedulingWs } from '@/api/detailedScheduling';

export const useDetailedSchedulingStore = defineStore('detailedScheduling', () => {
  const loading = ref(false);
  const schedule = ref(null);
  const dashboard = ref(null);
  const whatIfResult = ref(null);
  const agentExplanation = ref(null);
  const selectedTaskId = ref(null);
  const wsConnected = ref(false);

  const kpis = computed(() => dashboard.value?.kpis || schedule.value?.kpis || {});
  const exceptions = computed(() => dashboard.value?.exceptions || schedule.value?.exceptions || []);
  const gantt = computed(() => schedule.value?.gantt || { lines: [], tasks: [], timelineStart: '', timelineEnd: '' });
  const blockedOrders = computed(() => schedule.value?.blockedOrders || dashboard.value?.blockedOrders || []);

  const selectedTask = computed(() =>
    gantt.value.tasks?.find((t) => t.id === selectedTaskId.value) || null,
  );

  const kpiCards = computed(() => [
    { label: 'Schedule adherence', value: `${kpis.value.scheduleAdherence ?? 0}%`, accent: 'primary' },
    { label: 'OTIF', value: `${kpis.value.otif ?? 0}%`, accent: 'success' },
    { label: 'Capacity util.', value: `${kpis.value.capacityUtilization ?? 0}%`, accent: 'info' },
    { label: 'Setup time', value: `${kpis.value.totalSetupHours ?? 0} h`, accent: 'neutral' },
    { label: 'Campaign eff.', value: `${kpis.value.campaignEfficiency ?? 0}%`, accent: 'primary' },
    { label: 'Blocked', value: kpis.value.blockedOrders ?? 0, accent: 'warning' },
  ]);

  async function loadDashboard() {
    loading.value = true;
    try {
      dashboard.value = await detailedSchedulingApi.getDashboard();
      const full = await detailedSchedulingApi.getSchedule().catch(() => null);
      if (full) schedule.value = full;
      return dashboard.value;
    } finally {
      loading.value = false;
    }
  }

  async function buildSchedule(options = {}) {
    loading.value = true;
    try {
      schedule.value = await detailedSchedulingApi.buildSchedule(options);
      dashboard.value = {
        kpis: schedule.value.kpis,
        exceptions: schedule.value.exceptions,
        utilization: schedule.value.utilization,
        blockedOrders: schedule.value.blockedOrders,
        scheduledCount: schedule.value.scheduledOrders?.length,
        scheduleId: schedule.value.scheduleId,
        timelineStart: schedule.value.startAnchor,
        timelineEnd: schedule.value.timelineEnd,
      };
      return schedule.value;
    } finally {
      loading.value = false;
    }
  }

  async function runWhatIf(scenario) {
    loading.value = true;
    try {
      whatIfResult.value = await detailedSchedulingApi.runWhatIf(scenario);
      return whatIfResult.value;
    } finally {
      loading.value = false;
    }
  }

  async function rescheduleOrder(payload) {
    loading.value = true;
    try {
      const result = await detailedSchedulingApi.rescheduleOrder(payload);
      if (result.success) {
        if (result.schedule) {
          schedule.value = result.schedule;
        } else {
          await loadDashboard();
        }
      }
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function explainOrder(orderNumber) {
    agentExplanation.value = await detailedSchedulingApi.explainOrder(orderNumber);
    return agentExplanation.value;
  }

  async function explainSchedule() {
    agentExplanation.value = await detailedSchedulingApi.explainSchedule();
    return agentExplanation.value;
  }

  function selectTask(task) {
    selectedTaskId.value = task?.id || null;
  }

  async function confirmSchedule(payload = {}) {
    loading.value = true;
    try {
      return await detailedSchedulingApi.confirmSchedule({
        scheduleId: schedule.value?.scheduleId,
        ...payload,
      });
    } finally {
      loading.value = false;
    }
  }

  function initWebSocket() {
    const ws = connectSchedulingWs((msg) => {
      if (msg.type === 'CONNECTED') wsConnected.value = true;
      if (msg.type === 'SCHEDULE_BUILT') {
        schedule.value = msg.payload;
        dashboard.value = {
          kpis: msg.payload.kpis,
          exceptions: msg.payload.exceptions,
          utilization: msg.payload.utilization,
          blockedOrders: msg.payload.blockedOrders,
          scheduledCount: msg.payload.scheduledOrders?.length,
          scheduleId: msg.payload.scheduleId,
          timelineStart: msg.payload.startAnchor,
          timelineEnd: msg.payload.timelineEnd,
        };
      }
      if (msg.type === 'WHAT_IF_COMPLETE') whatIfResult.value = msg.payload;
    });
    ws.onopen = () => { wsConnected.value = true; };
    ws.onclose = () => { wsConnected.value = false; };
    return ws;
  }

  return {
    loading,
    schedule,
    dashboard,
    whatIfResult,
    agentExplanation,
    selectedTaskId,
    wsConnected,
    kpis,
    exceptions,
    gantt,
    blockedOrders,
    selectedTask,
    kpiCards,
    loadDashboard,
    buildSchedule,
    runWhatIf,
    rescheduleOrder,
    explainOrder,
    explainSchedule,
    confirmSchedule,
    selectTask,
    initWebSocket,
  };
});
