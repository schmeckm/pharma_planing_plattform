<template>
  <div class="v2-page executive">
    <div class="exec-header">
      <p class="page-subtitle">Global allocation intelligence — predictive risk, market exposure, and agent recommendations</p>
      <div class="exec-controls">
        <SelectButton v-model="horizon" :options="horizonOptions" option-label="label" option-value="value" @change="load" />
        <Button label="Run Agents" icon="pi pi-bolt" :loading="runningAgents" @click="runAgents" />
        <Button label="Refresh" icon="pi pi-refresh" severity="secondary" outlined :loading="loading" @click="load" />
      </div>
    </div>

    <div v-if="loading && !dashboard" class="loading-state">
      <ProgressSpinner />
    </div>

    <template v-else-if="dashboard">
      <Message severity="info" :closable="false" class="advisor-banner">
        AI-assisted planning — recommendations require human planner approval before execution.
      </Message>

      <div class="kpi-grid">
        <KpiCard label="Open Orders" :value="dashboard.kpis.openOrders" icon="List" accent="primary" />
        <KpiCard label="Orders at Risk" :value="dashboard.kpis.ordersAtRisk" icon="Warning" accent="warning" />
        <KpiCard label="Global Risk" :value="dashboard.kpis.globalRisk" icon="Warning" :accent="riskAccent(dashboard.kpis.globalRisk)" />
        <KpiCard label="Service Level" :value="dashboard.kpis.serviceLevel" suffix="%" icon="TrendCharts" accent="info" />
        <KpiCard label="Shelf-Life Compliance" :value="dashboard.kpis.rmslCompliance" suffix="%" icon="CircleCheck" accent="success" />
        <KpiCard label="Allocation Success" :value="dashboard.kpis.allocationSuccessRate" suffix="%" icon="CircleCheck" accent="success" />
        <KpiCard label="Line Utilization" :value="dashboard.kpis.lineUtilization" suffix="%" icon="Odometer" accent="info" />
        <KpiCard label="Inventory Exposure" :value="formatNum(dashboard.kpis.inventoryExposure)" icon="Box" accent="primary" />
      </div>

      <Card v-if="dashboard.dailySummary">
        <template #title>Daily Planning Summary (Planning Agent)</template>
        <template #content>
          <div class="summary-grid">
            <div><strong>Open Orders</strong><br>{{ dashboard.dailySummary.openOrders }}</div>
            <div><strong>Allocatable</strong><br>{{ dashboard.dailySummary.allocatableOrders }}</div>
            <div><strong>At Risk</strong><br>{{ dashboard.dailySummary.ordersAtRisk }}</div>
            <div><strong>Inventory Risks</strong><br>{{ dashboard.dailySummary.inventoryRisks }}</div>
            <div><strong>Sequence Check Issues</strong><br>{{ dashboard.dailySummary.japanSequenceRisks }}</div>
            <div><strong>Recommended Actions</strong><br>{{ dashboard.dailySummary.recommendedActions }}</div>
          </div>
        </template>
      </Card>

      <div class="exec-grid">
        <Card>
          <template #title>Country Risk Heatmap (T+{{ horizon }})</template>
          <template #content>
            <DataTable :value="dashboard.heatmap" size="small" striped-rows>
              <Column field="countryCode" header="Country" />
              <Column field="orderCount" header="Orders" />
              <Column header="Risk">
                <template #body="{ data }">
                  <RiskBadge :level="data.riskLevel" />
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>

        <Card>
          <template #title>Top Predicted Risks</template>
          <template #content>
            <ul v-if="dashboard.topRisks.length" class="risk-list">
              <li v-for="(r, i) in dashboard.topRisks" :key="i">
                <strong>{{ r.packagingOrderId || r.orderId }}</strong>
                <span>{{ r.reason || r.type }}</span>
                <RiskBadge v-if="r.riskLevel" :level="r.riskLevel" />
              </li>
            </ul>
            <p v-else class="empty-hint">No critical risks projected for this horizon.</p>
          </template>
        </Card>

        <Card class="exec-grid__wide">
          <template #title>Agent Recommendations</template>
          <template #content>
            <DataTable :value="dashboard.agentRecommendations" size="small" striped-rows>
              <Column field="agent" header="Agent" />
              <Column field="packagingOrderId" header="Order" />
              <Column field="action" header="Recommended Action" />
              <Column field="priority" header="Priority">
                <template #body="{ data }">
                  <Tag :severity="prioritySeverity(data.priority)" :value="data.priority" />
                </template>
              </Column>
              <Column field="status" header="Status" />
              <Column field="impact" header="Impact" />
              <Column header="Planner Action">
                <template #body="{ data }">
                  <Button v-if="data.status === 'PENDING_APPROVAL'" icon="pi pi-check" text severity="success" @click="approveRec(data)" />
                  <Button v-if="data.status === 'PENDING_APPROVAL'" icon="pi pi-times" text severity="danger" @click="dismissRec(data)" />
                </template>
              </Column>
            </DataTable>
            <p v-if="!dashboard.agentRecommendations.length" class="empty-hint">
              No agent recommendations yet. Click "Run Agents" to generate proactive actions.
            </p>
          </template>
        </Card>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import RiskBadge from '@/components/shared/RiskBadge.vue';
import { apiV3 } from '@/api/v3';

const toast = useToast();
const horizon = ref(7);
const loading = ref(false);
const runningAgents = ref(false);
const dashboard = ref(null);

const horizonOptions = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
];

function formatNum(n) {
  return new Intl.NumberFormat().format(n ?? 0);
}

function riskAccent(level) {
  return { LOW: 'success', MEDIUM: 'warning', HIGH: 'warning' }[level] || 'neutral';
}

function prioritySeverity(p) {
  return { HIGH: 'danger', MEDIUM: 'warn', LOW: 'success' }[p] || 'info';
}

async function load() {
  loading.value = true;
  try {
    dashboard.value = await apiV3.executiveDashboard(horizon.value);
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Load failed', detail: err.message, life: 4000 });
  } finally {
    loading.value = false;
  }
}

async function approveRec(rec) {
  try {
    await apiV3.approveRecommendation(rec.recommendationId);
    toast.add({ severity: 'success', summary: 'Approved', detail: rec.action, life: 3000 });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Approve failed', detail: err.message, life: 4000 });
  }
}

async function dismissRec(rec) {
  try {
    await apiV3.dismissRecommendation(rec.recommendationId, 'Dismissed by planner');
    toast.add({ severity: 'info', summary: 'Dismissed', life: 3000 });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Dismiss failed', detail: err.message, life: 4000 });
  }
}

async function runAgents() {
  runningAgents.value = true;
  try {
    const result = await apiV3.runAgents({ trigger: 'MANUAL', horizonDays: horizon.value });
    toast.add({
      severity: 'success',
      summary: 'Agents completed',
      detail: `${result.totalRecommendations || 0} recommendation(s) generated`,
      life: 4000,
    });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Agent run failed', detail: err.message, life: 4000 });
  } finally {
    runningAgents.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.executive { display: flex; flex-direction: column; gap: 20px; }
.exec-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 12px; }
.exec-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.exec-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.exec-grid__wide { grid-column: 1 / -1; }
.risk-list { list-style: none; padding: 0; margin: 0; }
.risk-list li {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  padding: 8px 0; border-bottom: 1px solid var(--surface-border);
}
.advisor-banner { margin-bottom: 8px; }
.summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; font-size: var(--text-md); }
.empty-hint { color: var(--text-color-secondary); font-size: 0.875rem; margin: 0; }
@media (max-width: 900px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } }
.loading-state { display: flex; justify-content: center; padding: 48px; }
@media (max-width: 900px) { .exec-grid { grid-template-columns: 1fr; } }
</style>
