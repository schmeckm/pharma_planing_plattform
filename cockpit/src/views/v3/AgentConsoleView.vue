<template>
  <div class="v2-page agent-console">
    <p class="page-subtitle">Multi-agent orchestration — Planning, QA, Supply Chain advisors (human planner approves all actions)</p>

    <div class="console-toolbar">
      <AgentEngineToggle />
      <CopilotLauncher />
      <Button label="Morning Briefing" icon="pi pi-sun" severity="secondary" outlined :loading="briefingLoading" @click="loadBriefing" />
      <Dropdown v-model="trigger" :options="triggers" placeholder="Trigger" />
      <InputNumber v-model="horizonDays" :min="1" :max="90" show-buttons suffix=" days" />
      <Button label="Run Orchestrator" icon="pi pi-play" :loading="loading" @click="run" />
      <Tag v-if="llmStatus" :severity="llmStatus.configured ? 'success' : 'secondary'" :value="llmTagLabel" />
      <Button
        v-if="llmStatus?.configured"
        label="Reindex learning"
        icon="pi pi-refresh"
        severity="secondary"
        text
        :loading="reindexLoading"
        @click="reindex"
      />
    </div>

    <Card v-if="briefing">
      <template #title>{{ briefing.label }}</template>
      <template #content>
        <p class="advisor-note">{{ briefing.advisorNote }}</p>
        <div class="summary-grid">
          <div><strong>Open Orders</strong><br>{{ briefing.summary.openOrders }}</div>
          <div><strong>Allocatable</strong><br>{{ briefing.summary.allocatableOrders }}</div>
          <div><strong>At Risk</strong><br>{{ briefing.summary.ordersAtRisk }}</div>
          <div><strong>Inventory Risks</strong><br>{{ briefing.summary.inventoryRisks }}</div>
          <div><strong>Sequence Issues</strong><br>{{ briefing.summary.japanSequenceRisks }}</div>
          <div><strong>QA Lots Pending</strong><br>{{ briefing.summary.pendingInspectionLots }}</div>
        </div>
        <p class="sources"><strong>Data sources:</strong> {{ briefing.dataSourcesRead?.join(' · ') }}</p>
      </template>
    </Card>

    <Card v-if="result" class="mt-3">
      <template #title>Last Run — {{ result.runId }}</template>
      <template #content>
        <div class="run-meta">
          <span><strong>Trigger:</strong> {{ result.trigger }}</span>
          <span><strong>Recommendations:</strong> {{ result.totalRecommendations }}</span>
          <span><strong>Agents:</strong> {{ result.agentsRun?.join(', ') }}</span>
          <span v-if="result.llmMode"><strong>Engine:</strong> {{ result.llmMode }}</span>
        </div>
        <DataTable :value="result.recommendations" size="small" striped-rows class="mt-3">
          <Column field="agent" header="Agent" />
          <Column field="packagingOrderId" header="Order" />
          <Column field="action" header="Action" />
          <Column field="priority" header="Priority">
            <template #body="{ data }">
              <Tag :severity="sev(data.priority)" :value="data.priority" />
            </template>
          </Column>
          <Column field="impact" header="Impact" />
          <Column field="approverRole" header="Approver" />
        </DataTable>
      </template>
    </Card>

    <Card class="mt-3">
      <template #title>Knowledge Graph</template>
      <template #content>
        <div v-if="graphStats" class="graph-stats">
          <div><strong>Nodes:</strong> {{ graphStats.nodeCount }}</div>
          <div><strong>Relationships:</strong> {{ graphStats.relationshipCount }}</div>
          <div v-for="(count, label) in graphStats.labels" :key="label">
            <strong>{{ label }}:</strong> {{ count }}
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { apiV3 } from '@/api/v3';
import AgentEngineToggle from '@/components/shared/AgentEngineToggle.vue';
import CopilotLauncher from '@/components/shared/CopilotLauncher.vue';
import { useAgentModeStore } from '@/stores/agentMode';

const toast = useToast();
const agentMode = useAgentModeStore();
const loading = ref(false);
const briefingLoading = ref(false);
const reindexLoading = ref(false);
const trigger = ref('SCHEDULED_DAILY');
const horizonDays = ref(7);
const result = ref(null);
const briefing = ref(null);
const graphStats = ref(null);
const llmStatus = ref(null);

const llmTagLabel = computed(() => {
  if (!llmStatus.value) return '';
  const chunks = llmStatus.value.learning?.chunks ?? 0;
  return llmStatus.value.configured ? `LLM ready · ${chunks} chunks` : 'LLM not configured';
});

const triggers = ['SCHEDULED_DAILY', 'ORDER_BLOCKED', 'BATCH_RELEASED', 'MANUAL'];

function sev(p) {
  return { HIGH: 'danger', MEDIUM: 'warn', LOW: 'success' }[p] || 'info';
}

async function loadBriefing() {
  briefingLoading.value = true;
  try {
    briefing.value = await apiV3.morningBriefing(horizonDays.value);
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Briefing failed', detail: err.message, life: 4000 });
  } finally {
    briefingLoading.value = false;
  }
}

async function run() {
  loading.value = true;
  try {
    result.value = await apiV3.runAgents(agentMode.agentRunPayload({
      trigger: trigger.value,
      horizonDays: horizonDays.value,
    }));
    if (result.value.dailySummary) briefing.value = result.value.dailySummary;
    toast.add({ severity: 'success', summary: 'Orchestrator complete', life: 3000 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Run failed', detail: err.message, life: 4000 });
  } finally {
    loading.value = false;
  }
}

async function reindex() {
  reindexLoading.value = true;
  try {
    const res = await apiV3.llmReindex();
    llmStatus.value = await apiV3.llmStatus();
    toast.add({ severity: 'success', summary: 'Learning index updated', detail: `${res.chunksIndexed ?? res.chunks ?? '?'} chunks`, life: 4000 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Reindex failed', detail: err.message, life: 4000 });
  } finally {
    reindexLoading.value = false;
  }
}

onMounted(async () => {
  loadBriefing();
  try {
    graphStats.value = await apiV3.graphStats();
  } catch { /* optional */ }
  try {
    llmStatus.value = await apiV3.llmStatus();
  } catch { /* optional */ }
});
</script>

<style scoped>
.console-toolbar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
.run-meta { display: flex; gap: 24px; flex-wrap: wrap; font-size: 0.875rem; }
.graph-stats { display: flex; gap: 20px; flex-wrap: wrap; font-size: 0.875rem; }
.summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin: 12px 0; font-size: var(--text-md); }
.advisor-note { font-size: var(--text-sm); color: var(--color-text-muted, #6a6d70); margin: 0 0 8px; }
.sources { font-size: var(--text-xs); color: var(--color-text-muted); margin: 8px 0 0; }
.mt-3 { margin-top: 16px; }
@media (max-width: 900px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
