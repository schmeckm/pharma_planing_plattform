<template>
  <div class="simulation-view">
    <WizardReturnBar />
    <p class="page-subtitle">Review recommended batches per order with compliance and market checks</p>

    <div class="simulation-layout" :class="{ 'simulation-layout--panel-open': simulationStore.panelOpen }">
      <div class="simulation-main panel">
        <div class="panel-header">
          <h2>Batch Recommendations</h2>
          <div class="header-actions">
            <el-select v-model="statusFilter" placeholder="Status" size="small" style="width: 120px" @change="load">
              <el-option label="Planned" value="PLANNED" />
              <el-option label="Open" value="OPEN" />
              <el-option label="All" value="" />
            </el-select>
            <el-button type="primary" :loading="appStore.loading" @click="runMass">
              Mass Simulate
            </el-button>
            <el-button type="success" :loading="appStore.loading" @click="runMassAllocate">
              Mass Allocation
            </el-button>
            <el-button type="warning" :loading="appStore.loading" @click="runMassUnallocate">
              Mass Unallocate
            </el-button>
          </div>
        </div>
        <div class="panel-body panel-body--flush">
          <OrderSimulationTable
            v-model:selected-order-ids="selectedOrderIds"
            :rows="tableRows"
            @select="onSelect"
            @continue="onContinue"
            @simulate="onSimulate"
            @allocate="onAllocate"
            @unallocate="onUnallocate"
          />
        </div>
      </div>

      <SimulationDetailPanel
        v-if="simulationStore.panelOpen"
        class="simulation-detail"
        :order="simulationStore.selectedOrder"
        :country-rule="simulationStore.countryRule"
        :result="simulationStore.simulationResult"
        :batch="simulationStore.recommendedBatch"
        :rule-definitions="ordersStore.rules.ruleDefinitions"
        :loading="appStore.loading"
        @close="simulationStore.closePanel()"
        @simulate="onSimulateSelected"
        @execute="onExecute"
        @unallocate="onUnallocateSelected"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import OrderSimulationTable from '@/components/simulation/OrderSimulationTable.vue';
import WizardReturnBar from '@/components/wizard/WizardReturnBar.vue';
import SimulationDetailPanel from '@/components/simulation/SimulationDetailPanel.vue';
import { useAppStore } from '@/stores/app';
import { useOrdersStore } from '@/stores/orders';
import { useSimulationStore } from '@/stores/simulation';
import { buildOrderBomTreeRows } from '@/utils/orderBomRows';
import { resolveMassOrderIds } from '@/utils/massOrderSelection';

const appStore = useAppStore();
const ordersStore = useOrdersStore();
const simulationStore = useSimulationStore();
const statusFilter = ref('PLANNED');
const selectedOrderIds = ref([]);

const tableRows = computed(() =>
  buildOrderBomTreeRows(ordersStore.orders, {
    recommendations: simulationStore.recommendations,
    getBatchById: ordersStore.getBatchById,
    simulationResultsByOrderId: simulationStore.resultByOrderId,
  })
);

onMounted(load);

async function load() {
  await Promise.all([
    ordersStore.loadOrders(statusFilter.value ? { status: statusFilter.value } : {}),
    ordersStore.loadBatches(),
    ordersStore.loadRules(),
  ]);
}

function onSelect(id) {
  simulationStore.selectOrder(id);
}

async function onContinue(id) {
  await simulationStore.openOrderDetail(id);
}

async function onSimulateSelected() {
  if (!simulationStore.selectedOrderId) return;
  await onSimulate(simulationStore.selectedOrderId);
}

async function onSimulate(id) {
  const result = await simulationStore.runSimulation(id);
  if (result?.status === 'SIMULATED') {
    ElMessage.success(`${id}: batch ${result.recommendedBatchId} recommended`);
  } else if (result?.status === 'FAILED') {
    ElMessage.error(`${id}: ${result.failureReasons?.[0] || 'Simulation failed'}`);
  }
}

async function onExecute() {
  await simulationStore.runExecute();
  ElMessage.success('Allocation executed successfully');
  await refreshTableState();
}

async function onAllocate(id) {
  const result = await simulationStore.runAllocate(id);
  if (result?.status === 'SUCCESS') {
    ElMessage.success(`${id}: batch ${result.recommendedBatchId} allocated`);
  } else if (result?.status === 'FAILED') {
    ElMessage.error(`${id}: ${result.failureReasons?.[0] || 'Allocation failed'}`);
  }
  await refreshTableState();
}

async function onUnallocateSelected() {
  if (!simulationStore.selectedOrderId) return;
  await onUnallocate(simulationStore.selectedOrderId);
  simulationStore.closePanel();
}

async function onUnallocate(id) {
  await simulationStore.runUnallocate(id);
  ElMessage.success(`${id}: allocation cleared`);
  await refreshTableState();
}

async function refreshTableState() {
  await Promise.all([
    ordersStore.loadDashboard(),
    ordersStore.loadOrders(statusFilter.value ? { status: statusFilter.value } : {}),
    ordersStore.loadBatches(),
  ]);
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
  const total = result?.totalOrders ?? 0;
  const successful = result?.successful ?? 0;
  if (total === 0) {
    ElMessage.warning('No allocations to clear');
    return;
  }
  ElMessage.success(`Unallocated: ${successful}/${total} orders`);
  await refreshTableState();
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
  const total = result?.totalOrders ?? 0;
  const successful = result?.successful ?? 0;
  if (total === 0) {
    ElMessage.warning('No simulated orders ready for allocation');
    return;
  }
  ElMessage.success(`Allocated: ${successful}/${total} orders`);
  await refreshTableState();
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
</script>

<style scoped>
.simulation-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  min-height: calc(100vh - 160px);
}

.simulation-layout--panel-open {
  grid-template-columns: 1fr var(--detail-panel-width);
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.simulation-detail {
  position: sticky;
  top: 0;
  max-height: calc(100vh - 120px);
}

@media (max-width: 1100px) {
  .simulation-layout--panel-open {
    grid-template-columns: 1fr;
  }
}
</style>
