<template>
  <div class="line-opt">
    <WizardReturnBar />
    <p class="page-subtitle">
      {{ PLANNER_LABELS.PRODUCTION_SEQUENCING }} — {{ SEQ_LABELS.PAGE_SUBTITLE }}
    </p>

    <div v-if="store.shadowPlanning" class="callout callout--neutral lo-shadow-banner">
      <Tag
        :value="draftStatusLabel"
        :severity="draftStatusSeverity"
      />
      <span class="lo-shadow-hint">
        Shadow planning: drafts are isolated — activate plan promotes times for allocation (RULE-014).
      </span>
    </div>

    <div v-if="store.comparisonDeltaKpis.length" class="accent-block lo-delta-kpis">
      <p class="accent-block__title">Optimization: before → after</p>
      <div class="lo-delta-grid">
        <KpiCard
          v-for="k in store.comparisonDeltaKpis"
          :key="k.label"
          :label="k.label"
          :value="k.value"
          :subtitle="k.subtitle"
          :icon="k.icon"
          :accent="k.accent"
        />
      </div>
    </div>

    <div class="lo-kpis">
      <KpiCard
        v-for="k in store.kpiCards"
        :key="k.label"
        :label="k.label"
        :value="k.value"
        :suffix="k.suffix"
        :accent="k.accent"
      />
    </div>

    <PlanningHorizonBar @recalculate="recalculateFromHorizon" />

    <LineScorecardPanel
      :scorecard="store.lineScorecard"
      :plan-stability="store.planStability"
      :comparison="store.comparison"
    />

    <OptimizationImpactBanner
      :comparison="store.comparison"
      :persisted="!!store.lastImpactEventId"
    />

    <SequencingToolbar
      :loading="store.loading"
      :shadow-planning="store.shadowPlanning"
      :can-activate="canActivate"
      :solver-badge="store.solverBadge"
      :operations-solver-badge="store.operationsSolverBadge"
      :routing-source-badge="store.routingSourceBadge"
      @optimize="optimize"
      @what-if="simulate"
      @save-draft="saveDraft"
      @confirm="confirm"
      @activate="activate"
      @batch="simulateBatches"
      @refresh="store.loadDashboard()"
    />

    <div class="lo-main">
      <div class="lo-gantt panel panel--compact">
        <div class="panel-header gantt-header">
          <h2>{{ SEQ_LABELS.GANTT_TITLE }}</h2>
          <div class="gantt-header-controls">
            <SelectButton
              v-model="ganttViewMode"
              :options="ganttViewOptions"
              option-label="label"
              option-value="value"
            />
            <div v-if="store.movedOrderIds.length && ganttViewMode === 'packaging'" class="gantt-controls">
            <span class="gantt-legend">
              <span class="gantt-legend-swatch" />
              {{ SEQ_LABELS.GANTT_LEGEND_MOVED }} ({{ store.movedOrderIds.length }})
            </span>
            <label class="gantt-filter">
              <Checkbox v-model="showMovedOnly" binary input-id="gantt-moved-only" />
              <span>{{ SEQ_LABELS.GANTT_FILTER_MOVED }}</span>
            </label>
            </div>
          </div>
        </div>
        <p v-if="ganttViewMode === 'operations'" class="callout callout--warning callout--compact">{{ SEQ_LABELS.OPERATIONS_HINT }}</p>
        <p v-if="scopeFilterLabel" class="callout callout--scope">
          Scope from Control Tower: {{ scopeFilterLabel }}
          <RouterLink to="/line-optimization" class="text-link">Show all</RouterLink>
        </p>
        <p v-if="lineImbalanceHint" class="callout callout--warning">{{ lineImbalanceHint }}</p>
        <div class="panel-body">
          <SwimlaneGantt
            v-if="activeGanttTasks.length"
            v-model:granularity="ganttGranularity"
            :tasks="activeGanttTasks"
            :lines="activeSwimlanes"
            :timeline-start="activeTimelineStart"
            :timeline-end="activeTimelineEnd"
            :selected-id="selectedId"
            :moved-order-ids="ganttViewMode === 'packaging' ? store.movedOrderIds : []"
            :moved-order-details="store.movedOrderDetails"
            :line-column-label="ganttViewMode === 'operations' ? 'Work center' : SEQ_LABELS.PRODUCTION_LINE"
            :show-time-legend="ganttViewMode === 'operations'"
            :time-legend-title="SEQ_LABELS.OP_TIME_LEGEND"
            @select="onSelect"
            @move="onMove"
          />
          <p v-else-if="store.ganttTasks.length && showMovedOnly" class="empty-state">No moved orders in the current plan.</p>
          <p v-else class="empty-state">{{ SEQ_LABELS.LOADING }}</p>
          <p class="hint">{{ SEQ_LABELS.GANTT_HINT }}</p>
        </div>
      </div>

      <div class="lo-detail panel panel--compact">
        <div class="panel-header"><h2>{{ detailPanelTitle }}</h2></div>
        <div class="panel-body" v-if="store.selectedTask">
          <OrderDetailPanel
            :task="store.selectedTask"
            :operations="selectedOperations"
            :selected-operation="selectedOperation"
            :combined-plan="store.selectedCombinedPlanning"
            :horizon-start="store.ganttTimelineStart"
            :horizon-end="store.ganttTimelineEnd"
          />
        </div>
        <div v-else class="panel-body empty-state">{{ emptyDetailHint }}</div>
      </div>
    </div>

    <WorkCenterCapacityPanel :capacity="store.operationPlan?.workCenterCapacity" />

    <CombinedPlanningPanel
      :items="store.combinedPlanning?.items || []"
      :summary="store.combinedPlanningSummary"
      :loading="store.combinedPlanningLoading"
      :disabled="store.combinedPlanningDisabled"
      @refresh="store.loadCombinedPlanning()"
      @select-order="store.selectCombinedOrder"
    />

    <Card v-if="store.batchResults?.results?.length" class="lo-batch">
      <template #title>{{ PLANNER_LABELS.BATCH_RECOMMENDATIONS }}</template>
      <template #content>
        <p class="batch-summary">
          {{ store.batchResults.successful }}/{{ store.batchResults.totalOrders }} orders simulated successfully
        </p>
        <DataTable :value="store.batchResults.results" size="small" stripedRows>
          <Column field="packagingOrderId" header="Order" />
          <Column field="status" header="Status" />
          <Column field="recommendedBatchId" header="Recommended Batch">
            <template #body="{ data }">{{ data.recommendedBatchId || '—' }}</template>
          </Column>
          <Column header="Risk">
            <template #body="{ data }">
              <RiskBadge v-if="data.risk" :level="data.risk.level" :score="data.risk.score" />
              <span v-else>—</span>
            </template>
          </Column>
          <Column header="Failures">
            <template #body="{ data }">{{ data.failures?.length || 0 }}</template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import Card from 'primevue/card';
import Checkbox from 'primevue/checkbox';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { useToast } from 'primevue/usetoast';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import WizardReturnBar from '@/components/wizard/WizardReturnBar.vue';
import RiskBadge from '@/components/shared/RiskBadge.vue';
import SwimlaneGantt from '@/components/lineOptimization/SwimlaneGantt.vue';
import OrderDetailPanel from '@/components/lineOptimization/OrderDetailPanel.vue';
import CombinedPlanningPanel from '@/components/lineOptimization/CombinedPlanningPanel.vue';
import PlanningHorizonBar from '@/components/lineOptimization/PlanningHorizonBar.vue';
import OptimizationImpactBanner from '@/components/lineOptimization/OptimizationImpactBanner.vue';
import LineScorecardPanel from '@/components/lineOptimization/LineScorecardPanel.vue';
import SequencingToolbar from '@/components/lineOptimization/SequencingToolbar.vue';
import SelectButton from 'primevue/selectbutton';
import WorkCenterCapacityPanel from '@/components/lineOptimization/WorkCenterCapacityPanel.vue';
import { useDailyPlanningStore } from '@/stores/dailyPlanning';
import { useHorizonSettingsStore } from '@/stores/horizonSettings';
import { PLANNER_LABELS } from '@/utils/plannerTerminology';
import { SEQ_LABELS } from '@/utils/sequencingLabels';
import { apiV4 } from '@/api/v4';

const store = useDailyPlanningStore();
const horizonSettings = useHorizonSettingsStore();
const route = useRoute();
const toast = useToast();
const showMovedOnly = ref(false);
const selectedOperation = ref(null);
const GANTT_ZOOM_KEY = 'hap_gantt_granularity';
const ganttGranularity = ref(localStorage.getItem(GANTT_ZOOM_KEY) || 'day');

watch(ganttGranularity, (v) => {
  localStorage.setItem(GANTT_ZOOM_KEY, v);
});

const ganttViewOptions = [
  { label: SEQ_LABELS.GANTT_VIEW_OPERATIONS, value: 'operations' },
  { label: SEQ_LABELS.GANTT_VIEW_PACKAGING, value: 'packaging' },
];

const ganttViewMode = computed({
  get: () => store.ganttViewMode,
  set: (v) => { store.ganttViewMode = v; },
});

watch(ganttViewMode, (mode) => {
  if (mode !== 'operations') selectedOperation.value = null;
});

const activeSwimlanes = computed(() => {
  if (ganttViewMode.value === 'operations' && store.operationPlan?.workCenterSwimlanes?.length) {
    return store.operationPlan.workCenterSwimlanes;
  }
  return store.lines;
});

const activeTimelineStart = computed(() => {
  if (ganttViewMode.value === 'operations' && store.operationPlan?.operationTimelineStart) {
    return store.operationPlan.operationTimelineStart;
  }
  return store.ganttTimelineStart;
});

const activeTimelineEnd = computed(() => {
  if (ganttViewMode.value === 'operations' && store.operationPlan?.operationTimelineEnd) {
    return store.operationPlan.operationTimelineEnd;
  }
  return store.ganttTimelineEnd;
});

const selectedOperations = computed(() => {
  if (!store.selectedTask) return [];
  const id = taskId(store.selectedTask);
  return (store.operationPlan?.operations || []).filter(
    (o) => o.packagingOrder === id || o.packagingOrderId === id,
  );
});
const ownershipByMaterial = ref({});

function orderMatchesScope(order) {
  const { line, portfolio, mrp, scheduler } = route.query;
  if (line && order.productionLine !== line) return false;
  const material = order.materialNumber || order.material;
  const own = ownershipByMaterial.value[material];
  if (portfolio && own?.productPortfolio !== portfolio) return false;
  if (mrp && own?.mrpController !== mrp) return false;
  if (scheduler && own?.detailedScheduler !== scheduler) return false;
  if ((portfolio || mrp || scheduler) && material && !own) return false;
  return true;
}

const scopeFilterLabel = computed(() => {
  const parts = [];
  if (route.query.line) parts.push(`Line ${route.query.line}`);
  if (route.query.portfolio) parts.push(`Portfolio ${route.query.portfolio}`);
  if (route.query.mrp) parts.push(`MRP ${route.query.mrp}`);
  if (route.query.scheduler) parts.push(`Scheduler ${route.query.scheduler}`);
  return parts.join(' · ');
});

const activeGanttTasks = computed(() => {
  if (ganttViewMode.value === 'operations' && store.operationPlan?.operationGanttTasks?.length) {
    let tasks = store.operationPlan.operationGanttTasks;
    const hasScope = route.query.line || route.query.portfolio || route.query.mrp || route.query.scheduler;
    if (hasScope) {
      const poIds = new Set(store.orders.filter(orderMatchesScope).map((o) => taskId(o)));
      tasks = tasks.filter((t) => poIds.has(t.packagingOrderId || t.id));
    }
    return tasks;
  }
  return displayedPackagingTasks.value;
});

const displayedPackagingTasks = computed(() => {
  let tasks = store.ganttTasks;
  const hasScope = route.query.line || route.query.portfolio || route.query.mrp || route.query.scheduler;
  if (hasScope) {
    const ids = new Set(store.orders.filter(orderMatchesScope).map((o) => taskId(o)));
    tasks = tasks.filter((t) => ids.has(t.id));
  }
  if (!showMovedOnly.value) return tasks;
  const moved = new Set(store.movedOrderIds);
  return tasks.filter((t) => moved.has(t.id));
});

const lineImbalanceHint = computed(() => {
  const d = store.lineDistribution;
  if (!d.warning || !d.dominantLine) return '';
  return SEQ_LABELS.GANTT_LINE_IMBALANCE
    .replace('{pct}', String(d.dominantPct))
    .replace('{line}', d.dominantLine);
});

const selectedId = computed(() => {
  if (ganttViewMode.value === 'operations' && selectedOperation.value?.operationId) {
    return selectedOperation.value.operationId;
  }
  return store.selectedTask ? taskId(store.selectedTask) : null;
});

const detailPanelTitle = computed(() =>
  (ganttViewMode.value === 'operations' && selectedOperation.value)
    ? SEQ_LABELS.OPERATION_DETAIL
    : SEQ_LABELS.ORDER_DETAIL,
);

const emptyDetailHint = computed(() =>
  ganttViewMode.value === 'operations'
    ? SEQ_LABELS.SELECT_OPERATION
    : SEQ_LABELS.SELECT_ORDER,
);

const canActivate = computed(() => store.planningDraft?.status === 'READY');

const draftStatusLabel = computed(() => {
  const draft = store.planningDraft;
  const prod = store.productionSchedule;
  if (draft?.status === 'READY') return `Draft READY (${draft.itemCount} orders)`;
  if (draft?.status === 'DRAFT') return `Draft DRAFT (${draft.itemCount} orders)`;
  if (prod?.status === 'CONFIRMED') return 'Production plan CONFIRMED';
  return 'No draft';
});

const draftStatusSeverity = computed(() => {
  const s = store.planningDraft?.status;
  if (s === 'READY') return 'warn';
  if (s === 'DRAFT') return 'info';
  if (store.productionSchedule?.status === 'CONFIRMED') return 'success';
  return 'secondary';
});

function taskId(o) {
  return o.packagingOrder || o.packagingOrderId || o.id;
}

function onSelect(task) {
  if (task.operationNo) {
    const fullOp = (store.operationPlan?.operations || []).find((o) => o.operationId === task.id) || task;
    selectedOperation.value = fullOp;
    const poId = task.packagingOrderId || task.packagingOrder;
    const order = store.orders.find((o) => taskId(o) === poId);
    if (order) {
      store.selectTask({ id: poId, ...order });
      return;
    }
  } else {
    selectedOperation.value = null;
  }

  if (task.packagingOrderId) {
    const order = store.orders.find(
      (o) => taskId(o) === task.packagingOrderId,
    );
    if (order) {
      store.selectTask({ id: task.packagingOrderId, ...order });
      return;
    }
  }
  store.selectTask(task);
}

async function onMove({ taskId, productionLine, plannedStartDate, plannedStartDateTime }) {
  const startDate = plannedStartDateTime?.slice(0, 10) || plannedStartDate;
  if (ganttViewMode.value === 'operations') {
    store.updateOperationPosition(taskId, productionLine, startDate);
    await store.runOperationsWhatIf({
      operationId: taskId,
      workCenterId: productionLine,
      plannedStartDate: startDate,
    });
    const op = (store.operationPlan?.operations || []).find((o) => o.operationId === taskId);
    if (op) selectedOperation.value = op;
    return;
  }
  store.updateTaskPosition(taskId, productionLine, startDate);
  await store.runWhatIf();
  const task = store.orders.find((o) => (o.packagingOrder || o.packagingOrderId) === taskId);
  if (task) store.selectTask({ id: taskId, ...task });
}

async function simulate() {
  await store.runWhatIf();
  toast.add({ severity: 'info', summary: PLANNER_LABELS.WHAT_IF_SIMULATION, detail: 'Risk recalculated', life: 3000 });
}

async function recalculateFromHorizon() {
  try {
    await store.recalculatePlanning();
    toast.add({
      severity: 'success',
      summary: 'Recalculated',
      detail: 'Sequence and combined planning updated',
      life: 3000,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Recalculation failed',
      detail: err.message || 'Optimizer unavailable',
      life: 6000,
    });
  }
}

async function optimize() {
  try {
    await store.runRecommendedSequence();
    toast.add({ severity: 'success', summary: PLANNER_LABELS.RECOMMENDED_SEQUENCE, detail: 'Sequence updated', life: 3000 });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: PLANNER_LABELS.RECOMMENDED_SEQUENCE,
      detail: err.message || 'Optimization timed out or failed',
      life: 6000,
    });
  }
}

async function saveDraft() {
  const r = await store.saveDraftSequence('Draft plant sequence');
  const id = r.draftScheduleId || r.scheduleId;
  toast.add({
    severity: 'info',
    summary: store.shadowPlanning ? 'Draft saved (shadow)' : 'Draft saved',
    detail: id,
    life: 4000,
  });
}

async function confirm() {
  const r = await store.confirmSequence('Confirmed plant sequence');
  toast.add({
    severity: 'success',
    summary: store.shadowPlanning ? 'Draft released (READY)' : 'Sequence confirmed',
    detail: r.message || r.scheduleId,
    life: 5000,
  });
}

async function activate() {
  try {
    const r = await store.activateDraftSequence();
    toast.add({
      severity: 'success',
      summary: 'Plan activated',
      detail: r.message || r.scheduleId,
      life: 5000,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Activation failed',
      detail: err.response?.data?.message || err.message,
      life: 6000,
    });
  }
}

async function simulateBatches() {
  const r = await store.simulateBatchAssignment();
  toast.add({
    severity: r.failed ? 'warn' : 'success',
    summary: PLANNER_LABELS.BATCH_RECOMMENDATIONS,
    detail: `${r.successful}/${r.totalOrders} simulated`,
    life: 4000,
  });
}

onMounted(async () => {
  store.loadPlanningSettingsFromStorage();
  await horizonSettings.load();
  await store.loadSchedulingDefaults();
  await store.loadDashboard();
  if (route.query.portfolio || route.query.mrp || route.query.scheduler) {
    try {
      const impact = await apiV4.planningImpact({ scope: 'all', limit: 1 });
      const map = {};
      for (const row of impact.ownershipCatalog || []) {
        map[row.materialNumber] = row;
      }
      ownershipByMaterial.value = map;
    } catch {
      /* optional scope filter */
    }
  }
});
</script>

<style scoped>
.line-opt { display: flex; flex-direction: column; gap: 16px; }
.lo-shadow-hint { color: var(--color-text-muted); }
.lo-delta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.lo-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.lo-main { display: grid; grid-template-columns: 1fr var(--detail-panel-width, 320px); gap: 16px; }
.lo-detail {
  position: sticky;
  top: 0;
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
}
.lo-detail .panel-body {
  flex: 1;
  overflow-y: auto;
}
.gantt-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}
.gantt-header-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.gantt-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  font-size: var(--text-sm);
}
.gantt-legend {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-accent);
}
.gantt-legend-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: var(--color-risk-ok);
  outline: 2px dashed var(--color-accent);
  outline-offset: 1px;
}
.gantt-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  user-select: none;
}
.text-link { margin-left: 0.75rem; }
.lo-compare, .lo-batch { margin-top: 8px; }
.batch-summary { font-size: var(--text-md); margin: 0 0 12px; }
.compare-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 12px; font-size: var(--text-md); }
@media (max-width: 1100px) {
  .lo-main { grid-template-columns: 1fr; }
  .compare-grid { grid-template-columns: 1fr 1fr; }
}
</style>
