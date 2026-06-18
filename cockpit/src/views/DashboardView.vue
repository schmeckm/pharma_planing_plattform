<template>
  <div class="dashboard-view">
    <p class="page-subtitle">Operational overview — today's orders, batch recommendations, and planning exceptions</p>

    <div class="kpi-grid">
      <KpiCard label="Open Orders" :value="kpis.openOrders" icon="List" accent="primary" />
      <KpiCard label="Simulated Orders" :value="kpis.simulatedOrders" icon="Cpu" accent="info" />
      <KpiCard label="Allocations Today" :value="kpis.allocationsToday" icon="CircleCheck" accent="success" />
      <KpiCard label="Planning Exceptions" :value="kpis.blockedOrders" icon="Warning" accent="warning" />
      <KpiCard label="Available Batches" :value="kpis.availableBatches" icon="Box" accent="primary" />
      <KpiCard label="Average Shelf-Life" :value="kpis.averageRmsl" suffix=" months" icon="Timer" accent="neutral" />
    </div>

    <div class="dashboard-actions">
      <QuickActions
        @simulate="goSimulate"
        @mass-simulate="runMass"
        @mass-allocate="runMassAllocate"
        @mass-unallocate="runMassUnallocate"
        @execute="goExecute"
        @upload="uploadJson"
      />
    </div>

    <div class="dashboard-layout" :class="{ 'dashboard-layout--panel-open': simulationStore.panelOpen }">
      <div class="dashboard-grid">
        <div class="panel dashboard-table">
          <div class="panel-header">
            <h2>Batch Recommendations</h2>
            <el-button link type="primary" @click="$router.push('/simulation')">Open Batch Recommendations →</el-button>
          </div>
          <div class="panel-body panel-body--flush">
            <OrderSimulationTable
              v-model:selected-order-ids="selectedOrderIds"
              :rows="tableRows"
              @select="onContinue"
              @continue="onContinue"
              @simulate="onSimulate"
              @allocate="onAllocate"
              @unallocate="onUnallocate"
            />
          </div>
        </div>

        <div class="panel dashboard-chart">
          <div class="panel-header">
            <h2>Orders by Destination Country</h2>
          </div>
          <div class="panel-body">
            <CountryDonutChart :orders="ordersStore.orders" />
          </div>
        </div>
      </div>

      <SimulationDetailPanel
        v-if="simulationStore.panelOpen"
        class="dashboard-detail"
        :order="simulationStore.selectedOrder"
        :country-rule="simulationStore.countryRule"
        :result="simulationStore.simulationResult"
        :batch="simulationStore.recommendedBatch"
        :rule-definitions="ordersStore.rules.ruleDefinitions"
        :loading="false"
        @close="simulationStore.closePanel()"
        @simulate="onSimulateSelected"
        @execute="onAllocateSelected"
        @unallocate="onUnallocateSelected"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { buildOrderBomTreeRows } from '@/utils/orderBomRows';
import { resolveMassOrderIds } from '@/utils/massOrderSelection';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import QuickActions from '@/components/dashboard/QuickActions.vue';
import OrderSimulationTable from '@/components/simulation/OrderSimulationTable.vue';
import SimulationDetailPanel from '@/components/simulation/SimulationDetailPanel.vue';
import CountryDonutChart from '@/components/charts/CountryDonutChart.vue';
import { useOrdersStore } from '@/stores/orders';
import { useSimulationStore } from '@/stores/simulation';

const router = useRouter();
const ordersStore = useOrdersStore();
const simulationStore = useSimulationStore();
const selectedOrderIds = ref([]);
const kpis = computed(() => {
  const dash = ordersStore.dashboard ?? {};
  const recSimulated = new Set(
    simulationStore.recommendations
      .filter((r) => r.status === 'SIMULATED')
      .map((r) => r.packagingOrderId),
  ).size;
  return {
    openOrders: dash.openOrders ?? 0,
    simulatedOrders: Math.max(dash.simulatedOrders ?? 0, recSimulated),
    allocationsToday: dash.allocationsToday ?? 0,
    blockedOrders: dash.blockedOrders ?? 0,
    availableBatches: dash.availableBatches ?? 0,
    averageRmsl: dash.averageRmsl ?? 0,
  };
});

const tableRows = computed(() => {
  const recs = simulationStore.recommendations;
  const orders = ordersStore.orders.filter(
    (o) => ['PLANNED', 'OPEN', 'SIMULATED', 'ALLOCATED', 'PARTIALLY_ALLOCATED'].includes(o.status)
      || recs.some((r) => r.packagingOrderId === o.packagingOrderId),
  );

  return buildOrderBomTreeRows(orders, {
    recommendations: recs,
    getBatchById: ordersStore.getBatchById,
    simulationResultsByOrderId: simulationStore.resultByOrderId,
  });
});

async function refreshTableState() {
  await Promise.all([ordersStore.loadDashboard(), ordersStore.loadOrders(), ordersStore.loadBatches()]);
}

onMounted(async () => {
  await Promise.all([
    ordersStore.loadDashboard(),
    ordersStore.loadOrders(),
    ordersStore.loadRules(),
    ordersStore.loadBatches(),
  ]);
  if (ordersStore.dashboard?.recommendations) {
    simulationStore.setRecommendations(ordersStore.dashboard.recommendations);
  }
});

function goSimulate() {
  runMass();
}

function goExecute() {
  router.push('/simulation');
}

async function runMass() {
  const { orderIds, error } = resolveMassOrderIds(tableRows.value, selectedOrderIds.value);
  if (error === 'select_orders') {
    ElMessage.warning('Select one or more orders for mass simulation');
    return;
  }
  const result = await simulationStore.runMassSimulation(
    orderIds.length ? { packagingOrderIds: orderIds } : {}
  );
  await refreshTableState();
  const total = result?.totalOrders ?? 0;
  const successful = result?.successful ?? 0;
  if (total === 0) {
    ElMessage.warning('No planned orders found for simulation');
    return;
  }
  ElMessage.success(`Simulation completed: ${successful}/${total} orders`);
}

async function onContinue(id) {
  await simulationStore.openOrderDetail(id);
}

async function onSimulateSelected() {
  if (!simulationStore.selectedOrderId) return;
  await onSimulate(simulationStore.selectedOrderId);
}

async function onAllocateSelected() {
  if (!simulationStore.selectedOrderId) return;
  await onAllocate(simulationStore.selectedOrderId);
}

async function onUnallocateSelected() {
  if (!simulationStore.selectedOrderId) return;
  await onUnallocate(simulationStore.selectedOrderId);
}

async function onSimulate(id) {
  const result = await simulationStore.runSimulation(id);
  await refreshTableState();
  if (result?.status === 'SIMULATED') {
    ElMessage.success(`${id}: batch ${result.recommendedBatchId} recommended`);
  } else if (result?.status === 'FAILED') {
    ElMessage.error(`${id}: ${result.failureReasons?.[0] || 'Simulation failed'}`);
  }
}

async function onAllocate(id) {
  const result = await simulationStore.runAllocate(id);
  await refreshTableState();
  if (result?.status === 'SUCCESS') {
    ElMessage.success(`${id}: batch ${result.recommendedBatchId} allocated`);
  } else if (result?.status === 'FAILED') {
    ElMessage.error(`${id}: ${result.failureReasons?.[0] || 'Allocation failed'}`);
  }
}

async function onUnallocate(id) {
  try {
    await simulationStore.runUnallocate(id);
    await refreshTableState();
    ElMessage.success(`${id}: allocation cleared`);
  } catch (err) {
    ElMessage.error(`${id}: ${err.message || 'Release failed'}`);
  }
}

async function runMassUnallocate() {
  const { orderIds, error } = resolveMassOrderIds(tableRows.value, selectedOrderIds.value, {
    filter: (r) => r.recommendedBatchId
      || ['SIMULATED', 'SUCCESS', 'ALLOCATED', 'PARTIALLY_ALLOCATED'].includes(r.status || r.simulationStatus),
  });
  if (error === 'select_orders') {
    ElMessage.warning('Select one or more orders for mass unallocate');
    return;
  }
  if (error === 'no_matching_orders') {
    ElMessage.warning('Selected orders have no allocation to clear');
    return;
  }
  const result = await simulationStore.runMassUnallocate({ packagingOrderIds: orderIds });
  await refreshTableState();
  const total = result?.totalOrders ?? 0;
  const successful = result?.successful ?? 0;
  if (total === 0) {
    ElMessage.warning('No allocations to clear');
    return;
  }
  ElMessage.success(`Unallocated: ${successful}/${total} orders`);
}

async function runMassAllocate() {
  const { orderIds, error } = resolveMassOrderIds(tableRows.value, selectedOrderIds.value, {
    filter: (r) => (r.status || r.simulationStatus) === 'SIMULATED',
  });
  if (error === 'select_orders') {
    ElMessage.warning('Select one or more orders for mass allocation');
    return;
  }
  if (error === 'no_matching_orders') {
    ElMessage.warning('Selected orders must be in SIMULATED status');
    return;
  }
  const result = await simulationStore.runMassAllocate({ packagingOrderIds: orderIds });
  await refreshTableState();
  const total = result?.totalOrders ?? 0;
  const successful = result?.successful ?? 0;
  if (total === 0) {
    ElMessage.warning('No simulated orders ready for allocation');
    return;
  }
  ElMessage.success(`Allocated: ${successful}/${total} orders`);
}

function uploadJson() {
  ElMessage.info('JSON upload will connect to backend data import (future SAP integration)');
}
</script>

<style scoped>
.dashboard-actions {
  margin-bottom: 20px;
}

.dashboard-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.dashboard-layout--panel-open {
  grid-template-columns: 1fr var(--detail-panel-width);
}

.dashboard-layout--panel-open .dashboard-chart {
  display: none;
}

.dashboard-detail {
  position: sticky;
  top: 0;
  max-height: calc(100vh - 200px);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 20px;
}

.panel-body--flush {
  padding: 0;
}

.panel-body--flush :deep(.el-table) {
  border-radius: 0 0 var(--radius) var(--radius);
}

@media (max-width: 1200px) {
  .dashboard-layout--panel-open {
    grid-template-columns: 1fr;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
