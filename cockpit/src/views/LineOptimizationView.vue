<template>
  <div class="line-opt">
    <WizardReturnBar />
    <p class="page-subtitle">
      {{ PLANNER_LABELS.PRODUCTION_SEQUENCING }} — {{ SEQ_LABELS.PAGE_SUBTITLE }}
    </p>

    <div v-if="store.shadowPlanning" class="lo-shadow-banner">
      <Tag
        :value="draftStatusLabel"
        :severity="draftStatusSeverity"
      />
      <span class="lo-shadow-hint">
        Shadow planning: drafts are isolated — activate plan promotes times for allocation (RULE-014).
      </span>
    </div>

    <div v-if="store.comparisonDeltaKpis.length" class="lo-delta-kpis">
      <p class="lo-delta-title">Optimization: before → after</p>
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
      <div class="lo-gantt panel">
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
        <p v-if="ganttViewMode === 'operations'" class="gantt-ops-hint">{{ SEQ_LABELS.OPERATIONS_HINT }}</p>
        <p v-if="scopeFilterLabel" class="gantt-scope-banner">
          Scope from Control Tower: {{ scopeFilterLabel }}
          <RouterLink to="/line-optimization" class="scope-clear">Show all</RouterLink>
        </p>
        <p v-if="lineImbalanceHint" class="gantt-warn">{{ lineImbalanceHint }}</p>
        <div class="panel-body">
          <SwimlaneGantt
            v-if="activeGanttTasks.length"
            :tasks="activeGanttTasks"
            :lines="activeSwimlanes"
            :timeline-start="activeTimelineStart"
            :timeline-end="activeTimelineEnd"
            :selected-id="selectedId"
            :moved-order-ids="ganttViewMode === 'packaging' ? store.movedOrderIds : []"
            :moved-order-details="store.movedOrderDetails"
            :line-column-label="ganttViewMode === 'operations' ? 'Work center' : SEQ_LABELS.PRODUCTION_LINE"
            @select="onSelect"
            @move="onMove"
          />
          <p v-else-if="store.ganttTasks.length && showMovedOnly" class="empty">No moved orders in the current plan.</p>
          <p v-else class="empty">{{ SEQ_LABELS.LOADING }}</p>
          <p class="hint">{{ SEQ_LABELS.GANTT_HINT }}</p>
        </div>
      </div>

      <div class="lo-detail panel">
        <div class="panel-header"><h2>{{ SEQ_LABELS.ORDER_DETAIL }}</h2></div>
        <div class="panel-body" v-if="store.selectedTask">
          <dl class="detail-list">
            <dt>PO</dt><dd>{{ taskId(store.selectedTask) }}</dd>
            <dt>Country</dt><dd>{{ store.selectedTask.destinationCountry }}</dd>
            <dt>Line</dt><dd>{{ store.selectedTask.productionLine }}</dd>
            <dt>Start / End</dt><dd>{{ store.selectedTask.plannedStartDate }} → {{ store.selectedTask.plannedEndDate }}</dd>
            <dt>Delivery</dt><dd>{{ store.selectedTask.requestedDeliveryDate }}</dd>
            <dt>Duration</dt><dd>{{ store.selectedTask.durationHours }} h</dd>
            <dt v-if="store.selectedTask.estimatedRuntimeHours != null">Runtime</dt>
            <dd v-if="store.selectedTask.estimatedRuntimeHours != null">{{ fmtH(store.selectedTask.estimatedRuntimeHours) }}</dd>
            <dt v-if="store.selectedTask.estimatedSetupHours != null">Setup</dt>
            <dd v-if="store.selectedTask.estimatedSetupHours != null">{{ fmtH(store.selectedTask.estimatedSetupHours) }}</dd>
            <dt v-if="store.selectedTask.estimatedDowntimeHours != null">Downtime</dt>
            <dd v-if="store.selectedTask.estimatedDowntimeHours != null">{{ fmtH(store.selectedTask.estimatedDowntimeHours) }}</dd>
            <dt v-if="store.selectedTask.estimatedTeardownHours != null">Teardown</dt>
            <dd v-if="store.selectedTask.estimatedTeardownHours != null">{{ fmtH(store.selectedTask.estimatedTeardownHours) }}</dd>
            <dt>Priority</dt><dd>{{ store.selectedTask.priority }}</dd>
            <dt>Batch</dt><dd>{{ store.selectedTask.recommendedBatchId || '—' }}</dd>
            <dt>Status</dt><dd><RiskBadge :level="statusLevel(store.selectedTask)" /></dd>
            <dt>Risk Score</dt><dd>{{ store.selectedTask.riskScore ?? '—' }}</dd>
            <dt>Shelf-Life at Start</dt><dd>{{ store.selectedTask.rmslAtStart ?? '—' }} mo</dd>
            <dt>Shelf-Life at End</dt><dd>{{ store.selectedTask.rmslAtEnd ?? '—' }} mo</dd>
            <dt>Shelf-Life at Delivery</dt><dd>{{ store.selectedTask.rmslAtDelivery ?? '—' }} mo</dd>
            <dt>Expected OEE</dt><dd>{{ store.selectedTask.expectedOee != null ? store.selectedTask.expectedOee + '%' : '—' }}</dd>
            <dt>Expected Throughput</dt><dd>{{ store.selectedTask.expectedThroughput ?? '—' }}</dd>
            <dt>Expected Yield</dt><dd>{{ store.selectedTask.expectedYield != null ? store.selectedTask.expectedYield + '%' : '—' }}</dd>
            <dt>Line Score</dt><dd>{{ store.selectedTask.lineScore ?? '—' }}</dd>
            <dt>Line Reliability</dt><dd>{{ store.selectedTask.lineReliability != null ? store.selectedTask.lineReliability + '%' : '—' }}</dd>
          </dl>
          <ul v-if="selectedOperations.length" class="ops-list">
            <li v-for="op in selectedOperations" :key="op.operationId" :class="{ 'op-bn': op.isBottleneck }">
              Op {{ op.operationNo }} {{ op.operationName }} · {{ op.workCenterId }}
              · {{ op.plannedStartDate }} → {{ op.plannedEndDate }}
              <Tag v-if="op.isBottleneck" severity="warn" value="Bottleneck" class="op-tag" />
            </li>
          </ul>
          <ul v-if="store.selectedTask.issues?.length" class="issues">
            <li v-for="(iss, i) in store.selectedTask.issues" :key="i">{{ plannerText(iss.message) }}</li>
          </ul>
          <CombinedPlanningDetail
            :plan="store.selectedCombinedPlanning"
            :horizon-start="store.ganttTimelineStart"
            :horizon-end="store.ganttTimelineEnd"
          />
        </div>
        <div v-else class="panel-body empty">{{ SEQ_LABELS.SELECT_ORDER }}</div>
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
import { computed, onMounted, ref } from 'vue';
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
import CombinedPlanningPanel from '@/components/lineOptimization/CombinedPlanningPanel.vue';
import CombinedPlanningDetail from '@/components/lineOptimization/CombinedPlanningDetail.vue';
import PlanningHorizonBar from '@/components/lineOptimization/PlanningHorizonBar.vue';
import OptimizationImpactBanner from '@/components/lineOptimization/OptimizationImpactBanner.vue';
import SequencingToolbar from '@/components/lineOptimization/SequencingToolbar.vue';
import SelectButton from 'primevue/selectbutton';
import WorkCenterCapacityPanel from '@/components/lineOptimization/WorkCenterCapacityPanel.vue';
import { useDailyPlanningStore } from '@/stores/dailyPlanning';
import { useHorizonSettingsStore } from '@/stores/horizonSettings';
import { plannerText, PLANNER_LABELS } from '@/utils/plannerTerminology';
import { SEQ_LABELS } from '@/utils/sequencingLabels';
import { apiV4 } from '@/api/v4';

const store = useDailyPlanningStore();
const horizonSettings = useHorizonSettingsStore();
const route = useRoute();
const toast = useToast();
const showMovedOnly = ref(false);

const ganttViewOptions = [
  { label: SEQ_LABELS.GANTT_VIEW_OPERATIONS, value: 'operations' },
  { label: SEQ_LABELS.GANTT_VIEW_PACKAGING, value: 'packaging' },
];

const ganttViewMode = computed({
  get: () => store.ganttViewMode,
  set: (v) => { store.ganttViewMode = v; },
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

const selectedId = computed(() =>
  store.selectedTask ? taskId(store.selectedTask) : null
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

function fmtH(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 10) / 10} h`;
}

function taskId(o) {
  return o.packagingOrder || o.packagingOrderId || o.id;
}

function statusLevel(o) {
  if ((o.riskScore || 0) >= 30) return 'HIGH';
  if (o.allocationStatus === 'AT_RISK') return 'MEDIUM';
  return 'LOW';
}

function onSelect(task) {
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

async function onMove({ taskId, productionLine, plannedStartDate }) {
  store.updateTaskPosition(taskId, productionLine, plannedStartDate);
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
.lo-shadow-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-bg-muted, #f8f9fa);
  font-size: 0.8125rem;
}
.lo-shadow-hint { color: var(--text-color-secondary); }
.lo-delta-kpis {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #86efac;
  background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%);
}
.lo-delta-title {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #166534;
}
.lo-delta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.lo-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.lo-main { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
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
.gantt-ops-hint {
  margin: 0;
  padding: 0.4rem 1rem;
  font-size: 0.75rem;
  color: #64748b;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
}
.ops-list {
  margin: 0 0 12px;
  padding-left: 18px;
  font-size: 0.75rem;
  list-style: none;
}
.ops-list li {
  padding: 4px 0;
  border-bottom: 1px solid #f1f5f9;
}
.ops-list li.op-bn {
  font-weight: 600;
  color: #b45309;
}
.op-tag {
  margin-left: 0.35rem;
  vertical-align: middle;
}
.gantt-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  font-size: 0.75rem;
}
.gantt-legend {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #166534;
}
.gantt-legend-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: #0070f2;
  outline: 2px dashed #16a34a;
  outline-offset: 1px;
}
.gantt-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  user-select: none;
}
.gantt-warn {
  margin: 0;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: #92400e;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
}
.gantt-scope-banner {
  margin: 0;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: #1e40af;
  background: #eff6ff;
  border-bottom: 1px solid #93c5fd;
}
.scope-clear {
  margin-left: 0.75rem;
  color: var(--p-primary-color, #0070f2);
  text-decoration: none;
}
.scope-clear:hover { text-decoration: underline; }
.panel { background: var(--color-bg, #fff); border: 1px solid var(--color-border, #ddd); border-radius: 8px; }
.panel-header { padding: 12px 16px; border-bottom: 1px solid var(--color-border, #eee); }
.panel-header h2 { margin: 0; font-size: 0.9375rem; }
.panel-body { padding: 16px; }
.hint { font-size: 0.6875rem; color: var(--text-color-secondary); margin-top: 8px; }
.detail-list { display: grid; grid-template-columns: 100px 1fr; gap: 6px 12px; font-size: 0.8125rem; margin: 0; }
.detail-list dt { color: var(--text-color-secondary); }
.issues { margin: 12px 0 0; padding-left: 18px; font-size: 0.75rem; color: #bb0000; }
.empty { color: var(--text-color-secondary); font-size: 0.875rem; }
.lo-compare, .lo-batch { margin-top: 8px; }
.batch-summary { font-size: 0.875rem; margin: 0 0 12px; }
.compare-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 12px; font-size: 0.875rem; }
@media (max-width: 1100px) {
  .lo-main { grid-template-columns: 1fr; }
  .compare-grid { grid-template-columns: 1fr 1fr; }
}
</style>
