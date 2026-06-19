<template>
  <div class="ds-view">
    <p class="page-subtitle">
      Finite-capacity detailed scheduling for pharmaceutical packaging — SAP PP/DS style MVP
    </p>

    <div class="ds-toolbar panel">
      <Button label="Build schedule" icon="pi pi-calendar-plus" :loading="store.loading" @click="build" />
      <Button label="Confirm (shadow)" icon="pi pi-check" severity="success" outlined :loading="store.loading" :disabled="!store.schedule" @click="confirmSchedule" />
      <Button label="Explain schedule" icon="pi pi-sparkles" severity="secondary" outlined :loading="store.loading" @click="explainSchedule" />
      <Tag v-if="store.wsConnected" severity="success" value="Live WS" />
      <Tag v-else severity="secondary" value="WS offline" />
    </div>

    <div class="ds-kpis">
      <KpiCard
        v-for="k in store.kpiCards"
        :key="k.label"
        :label="k.label"
        :value="k.value"
        :accent="k.accent"
      />
    </div>

    <div class="ds-main">
      <div class="panel ds-gantt-panel">
        <div class="panel-header">
          <h2>Packaging line Gantt</h2>
          <span class="text-muted text-sm">{{ gantt.timelineStart }} → {{ gantt.timelineEnd }}</span>
        </div>
        <div class="panel-body">
          <SwimlaneGantt
            v-if="gantt.tasks?.length"
            v-model:granularity="ganttGranularity"
            :tasks="gantt.tasks"
            :lines="gantt.lines"
            :timeline-start="gantt.timelineStart"
            :timeline-end="gantt.timelineEnd"
            :selected-id="store.selectedTaskId"
            line-column-label="Packaging line"
            @select="onSelect"
            @move="onMove"
          />
          <p v-else class="empty-state">No schedule — click Build schedule</p>
          <p class="hint">Drag orders horizontally to reschedule · Drag to another line to reassign</p>
        </div>
      </div>

      <div class="panel ds-side">
        <div class="panel-header"><h2>Order detail</h2></div>
        <div class="panel-body" v-if="store.selectedTask">
          <section class="detail-section">
            <div class="detail-row">
              <span class="detail-row__label">Order</span>
              <span class="detail-row__value">{{ store.selectedTask.orderNumber || store.selectedTask.id }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-row__label">Type</span>
              <span class="detail-row__value">{{ store.selectedTask.type }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-row__label">Line</span>
              <span class="detail-row__value">{{ store.selectedTask.lineId }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-row__label">Planned</span>
              <span class="detail-row__value">
                {{ store.selectedTask.plannedStartDateTime || store.selectedTask.plannedStartDate }}
                →
                {{ store.selectedTask.plannedEndDateTime || store.selectedTask.plannedEndDate }}
              </span>
            </div>
            <div v-if="store.selectedTask.country" class="detail-row">
              <span class="detail-row__label">Country</span>
              <span class="detail-row__value">{{ store.selectedTask.country }}</span>
            </div>
            <div v-if="store.selectedTask.recommendedBatch" class="detail-row">
              <span class="detail-row__label">Batch</span>
              <span class="detail-row__value">{{ store.selectedTask.recommendedBatch }}</span>
            </div>
          </section>
          <Button
            v-if="isBlocked(store.selectedTask.orderNumber)"
            label="AI: Why blocked?"
            icon="pi pi-comment"
            class="ds-explain-btn"
            :loading="store.loading"
            @click="explainOrder(store.selectedTask.orderNumber)"
          />
        </div>
        <div v-else class="panel-body empty-state">Select an order in the Gantt</div>
      </div>
    </div>

    <div class="ds-grid-2">
      <div class="panel">
        <div class="panel-header"><h2>Exceptions</h2></div>
        <div class="panel-body panel-body--flush">
          <DataTable :value="store.exceptions" size="small" striped-rows :rows="8" paginator>
            <Column field="type" header="Type" />
            <Column field="orderNumber" header="Order" />
            <Column field="severity" header="Severity">
              <template #body="{ data }">
                <Tag :severity="data.severity === 'HIGH' ? 'danger' : 'warn'" :value="data.severity" />
              </template>
            </Column>
            <Column field="message" header="Message" style="min-width: 16rem" />
          </DataTable>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>What-if simulation</h2></div>
        <div class="panel-body ds-whatif">
          <div class="form-field">
            <span class="form-field__label">Scenario</span>
            <SelectButton v-model="whatIfType" :options="whatIfOptions" option-label="label" option-value="value" />
          </div>
          <div v-if="whatIfType === 'lineFailure'" class="form-field">
            <span class="form-field__label">Failed line</span>
            <Dropdown v-model="whatIfLine" :options="lineOptions" option-label="label" option-value="value" placeholder="Select line" />
          </div>
          <div v-if="whatIfType === 'oeeDrop'" class="form-field">
            <span class="form-field__label">OEE drop to</span>
            <InputNumber
              v-model="whatIfOee"
              class="w-full ds-oee-input"
              :min="0.5"
              :max="1"
              :step="0.05"
              :max-fraction-digits="2"
              input-class="ds-oee-input__field"
            />
          </div>
          <Button label="Run simulation" icon="pi pi-play" :loading="store.loading" @click="runWhatIf" />
          <div v-if="store.whatIfResult" class="ds-whatif-result">
            <p><strong>{{ store.whatIfResult.comparison?.summary }}</strong></p>
            <ul>
              <li v-for="(v, k) in store.whatIfResult.comparison?.deltas" :key="k">{{ k }}: {{ v > 0 ? '+' : '' }}{{ v }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <Card v-if="store.agentExplanation" class="ds-agent">
      <template #title>AI Planner Agent ({{ store.agentExplanation.source }})</template>
      <template #content>
        <p class="ds-agent-text">{{ store.agentExplanation.explanation }}</p>
        <ul v-if="store.agentExplanation.recommendedActions?.length">
          <li v-for="(a, i) in store.agentExplanation.recommendedActions" :key="i">{{ a }}</li>
        </ul>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import SelectButton from 'primevue/selectbutton';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import SwimlaneGantt from '@/components/lineOptimization/SwimlaneGantt.vue';
import { useDetailedSchedulingStore } from '@/stores/detailedScheduling';

const store = useDetailedSchedulingStore();
const toast = useToast();
const GANTT_ZOOM_KEY = 'hap_gantt_granularity';
const ganttGranularity = ref(localStorage.getItem(GANTT_ZOOM_KEY) || 'hour');
const whatIfType = ref('lineFailure');
const whatIfLine = ref('PACK_LINE_03');
const whatIfOee = ref(0.65);
let ws = null;

const whatIfOptions = [
  { label: 'Line failure', value: 'lineFailure' },
  { label: 'OEE drop', value: 'oeeDrop' },
  { label: 'Batch release', value: 'batchRelease' },
];

const gantt = computed(() => store.gantt);

watch(ganttGranularity, (v) => {
  localStorage.setItem(GANTT_ZOOM_KEY, v);
});

watch(
  () => gantt.value.granularity,
  (v) => {
    if (v && gantt.value.hasDateTime) ganttGranularity.value = v;
  },
);

const lineOptions = computed(() =>
  (gantt.value.lines || []).map((l) => ({ label: l.lineName || l.lineId, value: l.lineId })),
);

function isBlocked(orderNumber) {
  return store.blockedOrders.some((o) => o.orderNumber === orderNumber);
}

async function build() {
  await store.buildSchedule({ horizonDays: 28, solver: 'ortools' });
  toast.add({ severity: 'success', summary: 'Schedule built', life: 3000 });
}

async function confirmSchedule() {
  const result = await store.confirmSchedule();
  toast.add({
    severity: result.shadowPlanning ? 'success' : 'info',
    summary: 'Schedule confirmed',
    detail: result.message,
    life: 4000,
  });
}

function onSelect(task) {
  store.selectTask(task);
}

async function onMove({ taskId, productionLine, plannedStartDate, plannedStartDateTime }) {
  const result = await store.rescheduleOrder({
    orderNumber: taskId.replace(/-SETUP$/, ''),
    lineId: productionLine,
    plannedStartDate: plannedStartDateTime?.slice(0, 10) || plannedStartDate,
    plannedStartDateTime,
    manualOverride: true,
  });
  if (result.success) {
    toast.add({ severity: 'info', summary: 'Order rescheduled', life: 3000 });
  } else {
    toast.add({ severity: 'warn', summary: 'Reschedule blocked', detail: result.exceptions?.[0]?.message, life: 5000 });
  }
}

async function explainOrder(orderNumber) {
  await store.explainOrder(orderNumber);
}

async function explainSchedule() {
  await store.explainSchedule();
}

async function runWhatIf() {
  const scenario = { label: whatIfType.value, scenarioId: `WI-${Date.now()}` };
  if (whatIfType.value === 'lineFailure') {
    scenario.lineFailure = whatIfLine.value;
    scenario.label = `Line ${whatIfLine.value} failure`;
  } else if (whatIfType.value === 'oeeDrop') {
    scenario.oeeDrop = { toOee: whatIfOee.value };
    scenario.label = `OEE drop to ${whatIfOee.value}`;
  } else {
    scenario.batchRelease = { batchId: 'BATCH-0001', addCountries: ['US'] };
    scenario.label = 'Batch B100 released for US';
  }
  await store.runWhatIf(scenario);
  toast.add({ severity: 'info', summary: 'What-if complete', life: 3000 });
}

onMounted(async () => {
  ws = store.initWebSocket();
  await store.loadDashboard();
});

onUnmounted(() => {
  if (ws) ws.close();
});
</script>

<style scoped>
.ds-view { display: flex; flex-direction: column; gap: 16px; }
.ds-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}
.ds-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.ds-main {
  display: grid;
  grid-template-columns: 1fr var(--detail-panel-width, 320px);
  gap: 16px;
}
.ds-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.ds-whatif { display: flex; flex-direction: column; gap: 12px; }
.ds-whatif-result {
  margin-top: 8px;
  padding: 12px;
  background: var(--color-bg-muted);
  border-radius: var(--radius);
  font-size: var(--text-sm);
}
.ds-agent-text { line-height: 1.5; white-space: pre-wrap; }
.ds-explain-btn { width: 100%; margin-top: 8px; }
.ds-oee-input { width: 100%; }
:deep(.ds-oee-input__field) {
  width: 100%;
  background: var(--color-panel, #fff);
  color: var(--color-text, #32363a);
  border: 1px solid var(--color-border, #e5e5e5);
}
@media (max-width: 1100px) {
  .ds-main, .ds-grid-2 { grid-template-columns: 1fr; }
}
</style>
