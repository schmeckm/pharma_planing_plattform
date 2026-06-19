import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { planningApi } from '@/api/planning';
import { lineOptimizationApi } from '@/api/lineOptimization';
import { addDays } from '@/utils/dateHelpers';
import { computeBarMetrics } from '@/utils/ganttTimeScale';
import { SEQ_LABELS } from '@/utils/sequencingLabels';

const PLANNING_SETTINGS_KEY = 'hap_planning_settings';

export const useDailyPlanningStore = defineStore('dailyPlanning', () => {
  const loading = ref(false);
  const planningDate = ref(new Date().toISOString().slice(0, 10));
  const orders = ref([]);
  const ganttTasks = ref([]);
  const lines = ref([]);
  const timelineStart = ref('2026-09-01');
  const timelineEnd = ref('2026-09-15');
  const horizonDays = ref(14);
  const horizonDaysMin = ref(7);
  const horizonDaysMax = ref(365);
  const planningStartAnchorOverride = ref(null);
  const kpis = ref({});
  const exceptions = ref([]);
  const comparison = ref(null);
  const localSequence = ref([]);
  const selectedTask = ref(null);
  const batchResults = ref(null);
  const recommendations = ref(null);
  const lineUtilization = ref([]);
  const shadowPlanning = ref(false);
  const planningDraft = ref(null);
  const productionSchedule = ref(null);
  const combinedPlanning = ref(null);
  const combinedPlanningLoading = ref(false);
  const lastImpactEventId = ref(null);
  const operationPlan = ref(null);
  const ganttViewMode = ref('operations');
  const solverEngine = ref(null);
  const solverStatus = ref(null);
  const schedulerDegraded = ref(false);
  const schedulerMessage = ref(null);

  const solverBadge = computed(() => {
    if (schedulerDegraded.value) {
      return {
        label: 'Degraded',
        severity: 'warn',
        detail: schedulerMessage.value || 'Solver fallback active',
      };
    }
    if (solverEngine.value === 'google-or-tools') {
      return {
        label: 'OR-Tools',
        severity: 'success',
        detail: solverStatus.value || 'CP-SAT',
      };
    }
    if (solverEngine.value === 'heuristic-line-sequencer') {
      return { label: 'Heuristic', severity: 'secondary', detail: solverStatus.value };
    }
    if (solverStatus.value === 'NOT_OPTIMIZED') {
      return { label: 'Rough plan', severity: 'info', detail: 'Not optimized yet' };
    }
    return {
      label: solverEngine.value || 'Unknown',
      severity: 'secondary',
      detail: solverStatus.value,
    };
  });

  const operationsSolverBadge = computed(() => {
    const solver = operationPlan.value?.operationsSolver;
    if (!solver) return null;
    if (solver.ortoolsFallback) {
      return {
        label: SEQ_LABELS.OPERATIONS_SOLVER_FALLBACK,
        severity: 'warn',
        detail: solver.ortoolsError || 'OR-Tools unavailable — heuristic used',
      };
    }
    if (solver.solverEngine === 'google-or-tools-operations') {
      return {
        label: SEQ_LABELS.OPERATIONS_SOLVER_ORTOOLS,
        severity: 'success',
        detail: solver.solverStatus || 'Multi-WC CP-SAT',
      };
    }
    return {
      label: SEQ_LABELS.OPERATIONS_SOLVER_HEURISTIC,
      severity: 'secondary',
      detail: solver.solverStatus || 'Bottleneck-first',
    };
  });

  const routingSourceBadge = computed(() => {
    const summary = operationPlan.value?.routingSummary;
    if (!summary) return null;
    const sapCount = summary.sapRoutingCount ?? 0;
    const templateCount = summary.templateRoutingCount ?? 0;
    if (sapCount > 0 && templateCount === 0) {
      return { label: SEQ_LABELS.OPERATIONS_SAP_ROUTING, severity: 'info', detail: `${sapCount} orders from SAP AFVC` };
    }
    if (templateCount > 0 && sapCount === 0) {
      return { label: SEQ_LABELS.OPERATIONS_TEMPLATE_ROUTING, severity: 'secondary', detail: `${templateCount} orders from template` };
    }
    return {
      label: `${sapCount} SAP · ${templateCount} template`,
      severity: 'info',
      detail: summary.sapDataSource || 'Mixed routing sources',
    };
  });

  function applyOperationPlan(plan) {
    if (!plan) return;
    operationPlan.value = plan;
  }

  function applyScheduleMeta(result) {
    if (!result) return;
    if (result.engine != null) solverEngine.value = result.engine;
    if (result.solverStatus != null) solverStatus.value = result.solverStatus;
    schedulerDegraded.value = !!result.schedulerDegraded;
    schedulerMessage.value = result.schedulerMessage || null;
    if (result.scheduling) {
      solverEngine.value = result.scheduling.engine ?? solverEngine.value;
      solverStatus.value = result.scheduling.solverStatus ?? solverStatus.value;
      schedulerDegraded.value = !!result.scheduling.schedulerDegraded;
      schedulerMessage.value = result.scheduling.schedulerMessage ?? schedulerMessage.value;
    }
  }

  const combinedByOrderId = computed(() => {
    const map = {};
    for (const item of combinedPlanning.value?.items || []) {
      map[item.packagingOrderId] = item;
    }
    return map;
  });

  const selectedCombinedPlanning = computed(() => {
    if (!selectedTask.value) return null;
    const id = selectedTask.value.packagingOrder || selectedTask.value.packagingOrderId;
    return combinedByOrderId.value[id] || null;
  });

  const combinedPlanningSummary = computed(() => combinedPlanning.value?.summary || null);
  const combinedPlanningDisabled = computed(() => !!combinedPlanning.value?.disabled);

  const effectivePlanningStart = computed(
    () => planningStartAnchorOverride.value || timelineStart.value,
  );

  const ganttTimelineStart = computed(
    () => effectivePlanningStart.value || timelineStart.value,
  );

  const ganttTimelineEnd = computed(() => {
    const start = ganttTimelineStart.value;
    const horizonEnd = addDays(start, horizonDays.value - 1);
    const dataEnd = timelineEnd.value || horizonEnd;
    return dataEnd > horizonEnd ? dataEnd : horizonEnd;
  });

  function loadPlanningSettingsFromStorage() {
    try {
      const raw = localStorage.getItem(PLANNING_SETTINGS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Number.isFinite(saved.horizonDays)) horizonDays.value = saved.horizonDays;
      planningStartAnchorOverride.value = saved.startAnchor || null;
    } catch {
      /* ignore corrupt local settings */
    }
  }

  function persistPlanningSettings() {
    localStorage.setItem(PLANNING_SETTINGS_KEY, JSON.stringify({
      horizonDays: horizonDays.value,
      startAnchor: planningStartAnchorOverride.value,
    }));
  }

  function setPlanningHorizon(days, startAnchor = undefined) {
    if (Number.isFinite(days)) {
      horizonDays.value = Math.min(horizonDaysMax.value, Math.max(horizonDaysMin.value, days));
    }
    if (startAnchor !== undefined) {
      planningStartAnchorOverride.value = startAnchor || null;
    }
    persistPlanningSettings();
  }

  async function loadSchedulingDefaults() {
    try {
      const status = await planningApi.getSchedulingStatus();
      if (!localStorage.getItem(PLANNING_SETTINGS_KEY) && Number.isFinite(status.horizonDaysDefault)) {
        horizonDays.value = status.horizonDaysDefault;
      }
      if (Number.isFinite(status.horizonDaysMin)) horizonDaysMin.value = status.horizonDaysMin;
      if (Number.isFinite(status.horizonDaysMax)) horizonDaysMax.value = status.horizonDaysMax;
    } catch {
      /* API optional during first paint */
    }
  }

  const kpiCards = computed(() => {
    const base = [
      { label: SEQ_LABELS.KPI_OPEN, value: kpis.value.openOrders ?? orders.value.length, accent: 'primary' },
      { label: SEQ_LABELS.KPI_HIGH_RISK, value: kpis.value.highRiskOrders ?? 0, accent: 'warning' },
      { label: SEQ_LABELS.KPI_LATE, value: kpis.value.lateOrders ?? 0, accent: 'warning' },
      { label: SEQ_LABELS.KPI_RMSL, value: kpis.value.rmslRiskOrders ?? 0, accent: 'warning' },
      { label: SEQ_LABELS.KPI_SEQUENCE, value: kpis.value.japanSequenceIssues ?? 0, accent: 'danger' },
      { label: SEQ_LABELS.KPI_EXCEPTIONS, value: exceptions.value.length, accent: 'danger' },
      { label: SEQ_LABELS.KPI_PEAK_UTIL, value: kpis.value.peakUtilization ?? 0, suffix: '%', accent: 'success' },
    ];
    const cp = combinedPlanningSummary.value;
    if (cp && !combinedPlanningDisabled.value) {
      base.push({
        label: 'Planning late',
        value: cp.late ?? 0,
        accent: cp.late > 0 ? 'danger' : 'success',
      });
    }
    return base;
  });

  const comparisonDeltaKpis = computed(() => {
    const c = comparison.value;
    if (!c) return [];

    function metric(label, before, after, icon, invert = true) {
      const b = before ?? 0;
      const a = after ?? 0;
      const delta = a - b;
      let subtitle = 'No change';
      let accent = 'neutral';
      if (delta !== 0) {
        const improved = invert ? delta < 0 : delta > 0;
        subtitle = improved
          ? `${invert ? '−' : '+'}${Math.abs(delta)} improved`
          : `${delta > 0 ? '+' : ''}${delta}`;
        accent = improved ? 'success' : 'warning';
      }
      return {
        label,
        value: `${b} → ${a}`,
        subtitle,
        icon,
        accent,
      };
    }

    const items = [
      metric('Late', c.lateOrders?.before, c.lateOrders?.after, 'Timer'),
      metric('RMSL violations', c.rmslViolations?.before, c.rmslViolations?.after, 'Warning'),
      metric('Risk score', c.riskDelta?.before, c.riskDelta?.after, 'TrendCharts'),
    ];

    if (c.oeeImpact?.before != null && c.oeeImpact?.after != null) {
      items.push(
        metric('Avg OEE', c.oeeImpact.before, c.oeeImpact.after, 'DataLine', false),
      );
    }

    return items.slice(0, 3);
  });

  const movedOrderIds = computed(() => (
    (comparison.value?.moved || []).map((m) => m.packagingOrder).filter(Boolean)
  ));

  const movedOrderDetails = computed(() => {
    const map = {};
    for (const m of comparison.value?.moved || []) {
      map[m.packagingOrder] = m;
    }
    return map;
  });

  const lineDistribution = computed(() => {
    const tasks = ganttTasks.value;
    if (!tasks.length) {
      return { counts: {}, dominantLine: null, dominantPct: 0, warning: false };
    }
    const counts = {};
    for (const t of tasks) {
      const line = t.productionLine;
      if (line) counts[line] = (counts[line] || 0) + 1;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const dominantLine = entries[0]?.[0] ?? null;
    const dominantCount = entries[0]?.[1] ?? 0;
    const dominantPct = Math.round((dominantCount / tasks.length) * 100);
    return {
      counts,
      dominantLine,
      dominantPct,
      warning: dominantPct >= 70 && entries.length > 1,
    };
  });

  async function loadDashboard(date) {
    loading.value = true;
    try {
      if (date) planningDate.value = date;
      const [dash, exc] = await Promise.all([
        planningApi.getPlannerDashboard({
          date: planningDate.value,
          startAnchor: effectivePlanningStart.value,
          horizonDays: horizonDays.value,
        }),
        planningApi.getExceptions({ date: planningDate.value }),
      ]);
      orders.value = dash.orders;
      ganttTasks.value = dash.ganttTasks;
      lines.value = dash.lines;
      timelineStart.value = dash.timelineStart;
      timelineEnd.value = dash.timelineEnd;
      applyScheduleMeta(dash);
      applyOperationPlan(dash.operationPlan);
      kpis.value = dash.kpis;
      lineUtilization.value = dash.lineUtilization || [];
      recommendations.value = dash.recommendations;
      comparison.value = dash.comparison;
      exceptions.value = exc.exceptions;
      shadowPlanning.value = !!dash.shadowPlanning;
      planningDraft.value = dash.planningDraft?.draft || null;
      productionSchedule.value = dash.planningDraft?.productionSchedule || null;
      localSequence.value = dash.orders.map((o) => ({
        packagingOrder: o.packagingOrder || o.packagingOrderId,
        productionLine: o.productionLine,
        plannedStartDate: o.plannedStartDate,
        plannedEndDate: o.plannedEndDate,
        recommendedBatchId: o.recommendedBatchId,
      }));
      await loadCombinedPlanning();
    } finally {
      loading.value = false;
    }
  }

  async function recalculatePlanning() {
    return runRecommendedSequence();
  }

  async function runRecommendedSequence() {
    loading.value = true;
    try {
      const result = await planningApi.optimizeSequence({
        startAnchor: effectivePlanningStart.value,
        horizonDays: horizonDays.value,
      });
      orders.value = result.sequence;
      ganttTasks.value = result.ganttTasks;
      timelineStart.value = result.timelineStart;
      timelineEnd.value = result.timelineEnd;
      if (result.planningHorizon?.horizonDays) {
        horizonDays.value = result.planningHorizon.horizonDays;
        persistPlanningSettings();
      }
      applyScheduleMeta(result);
      applyOperationPlan(result.operationPlan);
      kpis.value = result.kpis;
      comparison.value = result.comparison;
      localSequence.value = result.sequence.map((o) => ({
        packagingOrder: o.packagingOrder || o.packagingOrderId,
        productionLine: o.productionLine,
        plannedStartDate: o.plannedStartDate,
        plannedEndDate: o.plannedEndDate,
        recommendedBatchId: o.recommendedBatchId,
      }));
      await loadCombinedPlanning();
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function runWhatIf() {
    loading.value = true;
    try {
      const result = await planningApi.whatIf(localSequence.value, true, {
        horizonDays: horizonDays.value,
      });
      orders.value = result.orders;
      ganttTasks.value = result.ganttTasks;
      kpis.value = result.kpis;
      comparison.value = result.comparison;
      if (result.timelineStart) timelineStart.value = result.timelineStart;
      if (result.timelineEnd) timelineEnd.value = result.timelineEnd;
      applyScheduleMeta(result);
      applyOperationPlan(result.operationPlan);
      await loadCombinedPlanning();
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function confirmSequence(label) {
    loading.value = true;
    try {
      const result = await planningApi.confirmSequence({
        sequence: localSequence.value,
        label,
        draftScheduleId: planningDraft.value?.draftScheduleId || undefined,
        horizonDays: horizonDays.value,
      });
      lastImpactEventId.value = result.impactEventId || null;
      await loadDraftStatus();
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function activateDraftSequence() {
    loading.value = true;
    try {
      const result = await planningApi.activateDraft({
        draftScheduleId: planningDraft.value?.draftScheduleId || undefined,
        horizonDays: horizonDays.value,
      });
      lastImpactEventId.value = result.impactEventId || null;
      await loadDraftStatus();
      await loadDashboard();
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function loadDraftStatus() {
    const status = await planningApi.getDraftStatus();
    shadowPlanning.value = !!status.shadowPlanning;
    planningDraft.value = status.draft;
    productionSchedule.value = status.productionSchedule;
    return status;
  }

  async function saveDraftSequence(label = 'Draft plant sequence') {
    loading.value = true;
    try {
      const result = await lineOptimizationApi.saveSequence({ sequence: localSequence.value, label });
      await loadDraftStatus();
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function simulateBatchAssignment() {
    loading.value = true;
    try {
      batchResults.value = await planningApi.simulateBatchAssignment({ sequence: localSequence.value });
      return batchResults.value;
    } finally {
      loading.value = false;
    }
  }

  async function loadCombinedPlanning(packagingOrderIds) {
    combinedPlanningLoading.value = true;
    try {
      combinedPlanning.value = await planningApi.combinedCalculation({
        startAnchor: effectivePlanningStart.value,
        horizonDays: horizonDays.value,
        packagingOrderIds: packagingOrderIds || orders.value.map(
          (o) => o.packagingOrder || o.packagingOrderId,
        ).filter(Boolean),
      });
      return combinedPlanning.value;
    } finally {
      combinedPlanningLoading.value = false;
    }
  }

  function selectCombinedOrder(packagingOrderId) {
    const order = orders.value.find(
      (o) => (o.packagingOrder || o.packagingOrderId) === packagingOrderId,
    );
    if (order) selectTask({ id: packagingOrderId, ...order });
  }

  async function loadExceptions() {
    const exc = await planningApi.getExceptions({ date: planningDate.value });
    exceptions.value = exc.exceptions;
    return exc;
  }

  async function runOperationsWhatIf(override) {
    loading.value = true;
    try {
      const result = await planningApi.operationsWhatIf({
        overrides: [override],
        sequence: localSequence.value,
        startAnchor: effectivePlanningStart.value,
        horizonDays: horizonDays.value,
      });
      applyOperationPlan(result.operationPlan);
      return result;
    } finally {
      loading.value = false;
    }
  }

  function updateOperationPosition(operationId, workCenterId, plannedStartDate) {
    if (!operationPlan.value?.operations?.length) return;
    const ops = operationPlan.value.operations.map((op) => {
      if (op.operationId !== operationId) return op;
      const span = Math.max(
        1,
        Math.ceil((new Date(op.plannedEndDate) - new Date(op.plannedStartDate)) / 86400000) + 1,
      );
      const endDate = addDays(plannedStartDate, span - 1);
      return { ...op, workCenterId, plannedStartDate, plannedEndDate: endDate };
    });
    const timelineStartVal = operationPlan.value.operationTimelineStart;
    const timelineEndVal = operationPlan.value.operationTimelineEnd;
    operationPlan.value = {
      ...operationPlan.value,
      operations: ops,
      operationGanttTasks: ops.map((op) => {
        const task = {
          id: op.operationId,
          packagingOrderId: op.packagingOrder,
          operationNo: op.operationNo,
          operationName: op.operationName,
          name: `Op ${op.operationNo} · ${op.packagingOrder}`,
          workCenterId: op.workCenterId,
          productionLine: op.workCenterId,
          isBottleneck: op.isBottleneck,
          start: op.plannedStartDate,
          end: op.plannedEndDate,
          destinationCountry: op.destinationCountry,
          priority: op.priority,
          durationHours: op.durationHours,
          setupHours: op.setupHours,
          productionHours: op.productionHours,
          teardownHours: op.teardownHours,
        };
        const metrics = computeBarMetrics(task, timelineStartVal, timelineEndVal, 'day');
        return { ...task, ...metrics };
      }),
    };
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
    loading, planningDate, orders, ganttTasks, lines, timelineStart, timelineEnd,
    ganttTimelineStart, ganttTimelineEnd,
    horizonDays, horizonDaysMin, horizonDaysMax, planningStartAnchorOverride, effectivePlanningStart,
    solverEngine, solverStatus, schedulerDegraded, schedulerMessage, solverBadge,
    operationsSolverBadge, routingSourceBadge,
    kpis, kpiCards, exceptions, comparison, localSequence, selectedTask, batchResults,
    recommendations, lineUtilization, shadowPlanning, planningDraft, productionSchedule,
    combinedPlanning, combinedPlanningLoading, combinedPlanningSummary, combinedPlanningDisabled,
    combinedByOrderId, selectedCombinedPlanning, lastImpactEventId, comparisonDeltaKpis,
    movedOrderIds, movedOrderDetails, lineDistribution,
    operationPlan, ganttViewMode,
    loadDashboard, loadSchedulingDefaults, loadPlanningSettingsFromStorage, setPlanningHorizon,
    recalculatePlanning, runRecommendedSequence, runWhatIf, confirmSequence, saveDraftSequence,
    activateDraftSequence, loadDraftStatus, loadCombinedPlanning, selectCombinedOrder,
    simulateBatchAssignment, loadExceptions, updateTaskPosition, updateOperationPosition,
    runOperationsWhatIf, selectTask,
  };
});
