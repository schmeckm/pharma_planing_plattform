<template>
  <div class="v2-page control-tower">
    <div class="ct-header">
      <p class="page-subtitle">Global Supply Chain Control Tower — real-time visibility across inventory, demand, allocation, and risk</p>
      <div class="ct-toolbar">
        <Tag :severity="store.wsConnected ? 'success' : 'secondary'" :value="store.wsConnected ? 'Live' : 'Offline'" />
        <SelectButton v-model="horizon" :options="horizonOpts" option-label="label" option-value="value" @change="reload" />
        <Button label="Refresh" icon="pi pi-refresh" outlined :loading="store.loading" @click="reload" />
      </div>
    </div>

    <div v-if="store.loading && !store.dashboard" class="loading"><ProgressSpinner /></div>

    <template v-else-if="store.dashboard">
      <!-- Executive KPIs -->
      <div class="kpi-grid">
        <KpiCard v-for="k in kpiCards" :key="k.label" :label="k.label" :value="k.value" :suffix="k.suffix" :icon="k.icon" :accent="k.accent" />
      </div>

      <TabView>
        <!-- Global Inventory -->
        <TabPanel header="Global Inventory">
          <div class="panel-grid">
            <Card>
              <template #title>By Plant</template>
              <template #content><Chart type="bar" :data="plantChart" :options="chartOpts" /></template>
            </Card>
            <Card>
              <template #title>By Country / Market</template>
              <template #content><Chart type="doughnut" :data="countryChart" :options="chartOpts" /></template>
            </Card>
            <Card class="span-2">
              <template #title>Batch Inventory</template>
              <template #content>
                <DataTable :value="inventoryRows" size="small" striped-rows paginator :rows="8">
                  <Column field="batchId" header="Batch" />
                  <Column field="plant" header="Plant" />
                  <Column field="availableQuantity" header="Available" />
                  <Column field="allocatedQuantity" header="Allocated" />
                  <Column field="blockedQuantity" header="Restricted Qty" />
                  <Column field="remainingShelfLifeMonths" header="Shelf-Life (mo)" />
                  <Column field="qualityStatus" header="Status" />
                </DataTable>
              </template>
            </Card>
          </div>
        </TabPanel>

        <!-- Market Demand -->
        <TabPanel header="Market Demand">
          <div class="panel-grid">
            <Card>
              <template #title>Country Demand</template>
              <template #content><Chart type="bar" :data="demandCountryChart" :options="chartOpts" /></template>
            </Card>
            <Card>
              <template #title>Forecast vs Open Demand</template>
              <template #content>
                <div class="stat-row"><span>Open Demand</span><strong>{{ store.dashboard.demand.summary.openDemand?.toLocaleString() }} EA</strong></div>
                <div class="stat-row"><span>Forecast Q3</span><strong>{{ store.dashboard.demand.summary.forecastTotal?.toLocaleString() }} EA</strong></div>
                <div class="stat-row"><span>Sales Orders</span><strong>{{ store.dashboard.demand.summary.salesOrderCount }}</strong></div>
              </template>
            </Card>
            <Card class="span-2">
              <template #title>Sales Orders</template>
              <template #content>
                <DataTable :value="store.dashboard.demand.salesOrders" size="small" striped-rows>
                  <Column field="salesOrderId" header="SO" />
                  <Column field="customerName" header="Customer" />
                  <Column field="destinationCountry" header="Country" />
                  <Column field="quantity" header="Qty" />
                  <Column field="requestedDeliveryDate" header="Delivery" />
                </DataTable>
              </template>
            </Card>
          </div>
        </TabPanel>

        <!-- Allocation Monitor -->
        <TabPanel header="Allocation Monitor">
          <div class="alloc-summary">
            <div v-for="s in allocStats" :key="s.label" class="alloc-stat"><span>{{ s.label }}</span><strong>{{ s.value }}</strong></div>
          </div>
          <DataTable :value="store.dashboard.allocation.pendingDecisions" size="small" striped-rows class="mt-3">
            <Column field="packagingOrderId" header="PO" />
            <Column field="destinationCountry" header="Country" />
            <Column field="quantity" header="Qty" />
            <Column field="plannedStartDate" header="Planned Start" />
          </DataTable>
        </TabPanel>

        <!-- Risk Control Center -->
        <TabPanel header="Risk Control">
          <DataTable :value="store.dashboard.risk.heatmap" size="small" striped-rows>
            <Column field="countryCode" header="Country" />
            <Column field="orderCount" header="Orders" />
            <Column field="rmslViolations" header="Shelf-Life Violations" />
            <Column header="Risk">
              <template #body="{ data }"><RiskBadge :level="data.riskLevel" /></template>
            </Column>
          </DataTable>
          <h4 class="mt-3">Expiry Risks</h4>
          <DataTable :value="store.dashboard.risk.expiryRisks" size="small" striped-rows>
            <Column field="batchId" header="Batch" />
            <Column field="remainingShelfLifeMonths" header="Shelf-Life (mo)" />
            <Column field="availableQuantity" header="Qty" />
            <Column header="Risk"><template #body="{ data }"><RiskBadge :level="data.riskLevel" /></template></Column>
          </DataTable>
        </TabPanel>

        <!-- Event Monitor -->
        <TabPanel header="Events">
          <DataTable :value="store.dashboard.events.items" size="small" striped-rows>
            <Column field="timestamp" header="Time" />
            <Column field="eventType" header="Type" />
            <Column field="entityId" header="Entity" />
            <Column field="message" header="Message" />
            <Column header="Severity"><template #body="{ data }"><Tag :severity="sev(data.severity)" :value="data.severity" /></template></Column>
          </DataTable>
        </TabPanel>

        <!-- Digital Twin -->
        <TabPanel header="Digital Twin">
          <div class="twin-summary">
            <span>Horizon: T+{{ store.dashboard.digitalTwin.horizonDays }}</span>
            <span>Orders: {{ store.dashboard.digitalTwin.projections?.summary?.totalOrders }}</span>
            <span>Projected Success: {{ store.dashboard.digitalTwin.projections?.summary?.projectedSuccess }}</span>
            <span>Projected Failed: {{ store.dashboard.digitalTwin.projections?.summary?.projectedFailed }}</span>
          </div>
        </TabPanel>

        <!-- Planning Impact -->
        <TabPanel header="Planning impact">
          <PlanningImpactPanel
            :horizon-days="horizon"
            :initial-data="store.dashboard?.planningImpact"
          />
        </TabPanel>

        <!-- Recommendations -->
        <TabPanel header="Recommendations">
          <DataTable :value="store.dashboard.recommendations.recommendations" size="small" striped-rows>
            <Column field="type" header="Type" />
            <Column field="title" header="Recommendation" />
            <Column field="action" header="Action" />
            <Column field="priority" header="Priority">
              <template #body="{ data }"><Tag :severity="sev(data.priority)" :value="data.priority" /></template>
            </Column>
            <Column field="rationale" header="Rationale" />
          </DataTable>
        </TabPanel>
      </TabView>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import SelectButton from 'primevue/selectbutton';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ProgressSpinner from 'primevue/progressspinner';
import Chart from 'primevue/chart';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import RiskBadge from '@/components/shared/RiskBadge.vue';
import PlanningImpactPanel from '@/components/controlTower/PlanningImpactPanel.vue';
import { useControlTowerStore } from '@/stores/controlTower';
import { useHorizonSettingsStore } from '@/stores/horizonSettings';

const store = useControlTowerStore();
const horizonSettings = useHorizonSettingsStore();
const horizon = computed({
  get: () => horizonSettings.controlTowerHorizon,
  set: (value) => horizonSettings.setControlTowerHorizon(value),
});
const horizonOpts = computed(() => horizonSettings.controlTowerOptions);
const chartOpts = { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };

const kpis = computed(() => store.liveKpis || store.dashboard?.executive?.kpis || {});

const kpiCards = computed(() => {
  const base = [
    { label: 'Service Level', value: kpis.value.serviceLevel, suffix: '%', icon: 'TrendCharts', accent: 'success' },
    { label: 'Inventory Coverage', value: kpis.value.inventoryCoverage, suffix: 'x', icon: 'Box', accent: 'primary' },
    { label: 'Allocation Success', value: kpis.value.allocationSuccessRate, suffix: '%', icon: 'CircleCheck', accent: 'info' },
    { label: 'Shelf-Life Compliance', value: kpis.value.rmslCompliance, suffix: '%', icon: 'Timer', accent: 'success' },
    { label: 'Market Fill Rate', value: kpis.value.marketFillRate, suffix: '%', icon: 'DataAnalysis', accent: 'info' },
    { label: 'Inventory at Risk', value: kpis.value.inventoryAtRisk?.toLocaleString?.() || kpis.value.inventoryAtRisk, icon: 'Warning', accent: 'warning' },
  ];
  const pi = store.dashboard?.planningImpact?.summary;
  if (pi?.activationCount) {
    base.push(
      { label: 'Planning activations', value: pi.activationCount, icon: 'Check', accent: 'primary' },
      { label: 'Late avoided (plan)', value: pi.lateOrdersAvoided ?? 0, icon: 'Timer', accent: 'success' },
      { label: 'RMSL reduced (plan)', value: pi.rmslViolationsReduced ?? 0, icon: 'Shield', accent: 'success' },
    );
  }
  return base;
});

const inventoryRows = computed(() => store.dashboard?.inventory?.finishedGoods?.items || []);
const plantChart = computed(() => {
  const d = store.dashboard?.inventory?.finishedGoods?.byPlant || {};
  return { labels: Object.keys(d), datasets: [{ label: 'Available EA', data: Object.values(d), backgroundColor: '#0070f2' }] };
});
const countryChart = computed(() => {
  const d = store.dashboard?.inventory?.finishedGoods?.byCountry || {};
  return { labels: Object.keys(d), datasets: [{ data: Object.values(d), backgroundColor: ['#0070f2','#107e3e','#e9730c','#bb0000','#6a6d70'] }] };
});
const demandCountryChart = computed(() => {
  const rows = store.dashboard?.demand?.byCountry || [];
  return { labels: rows.map((r) => r.countryCode), datasets: [{ label: 'Demand EA', data: rows.map((r) => r.quantity), backgroundColor: '#5899da' }] };
});
const allocStats = computed(() => {
  const s = store.dashboard?.allocation?.summary || {};
  return [
    { label: 'Allocated', value: s.allocated },
    { label: 'Open', value: s.open },
    { label: 'Planning Exceptions', value: s.blocked },
    { label: 'Pending', value: s.pendingDecisions },
  ];
});

function sev(v) {
  return { HIGH: 'danger', MEDIUM: 'warn', LOW: 'success', INFO: 'info' }[v] || 'info';
}

async function reload() {
  await store.loadDashboard(horizon.value);
}

onMounted(async () => {
  await horizonSettings.load();
  await reload();
  store.connectWs();
});
onUnmounted(() => store.disconnectWs());
</script>

<style scoped>
.control-tower { display: flex; flex-direction: column; gap: 16px; }
.ct-header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: flex-start; }
.ct-toolbar { display: flex; gap: 8px; align-items: center; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.panel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.span-2 { grid-column: 1 / -1; }
.stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--surface-border); }
.alloc-summary { display: flex; gap: 24px; flex-wrap: wrap; }
.alloc-stat { display: flex; flex-direction: column; }
.twin-summary { display: flex; gap: 24px; flex-wrap: wrap; font-size: 0.875rem; }
.loading { display: flex; justify-content: center; padding: 48px; }
.mt-3 { margin-top: 16px; }
:deep(.p-chart) { height: 220px; }
@media (max-width: 900px) { .panel-grid { grid-template-columns: 1fr; } }
</style>
