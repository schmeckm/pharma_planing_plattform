<template>
  <div>
    <p class="page-subtitle">Executed and simulated allocation results</p>

    <div class="panel">
      <div class="panel-header">
        <h2>Allocation Results</h2>
        <el-button size="small" @click="refresh">Refresh</el-button>
      </div>
      <div class="panel-body panel-body--flush">
        <el-table :data="ordersStore.auditTrail" stripe size="small">
          <el-table-column prop="decisionId" label="Decision ID" width="140" />
          <el-table-column label="Timestamp" width="160">
            <template #default="{ row }">{{ formatDate(row.timestamp) }}</template>
          </el-table-column>
          <el-table-column prop="packagingOrderId" label="Order" width="120" />
          <el-table-column prop="batchId" label="Batch" width="140" />
          <el-table-column prop="destinationCountry" label="Country" width="80" />
          <el-table-column prop="allocatedQuantity" label="Qty" width="80" />
          <el-table-column label="Status" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
          <el-table-column prop="executionMode" label="Mode" width="100" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import StatusTag from '@/components/shared/StatusTag.vue';
import { useOrdersStore } from '@/stores/orders';

const ordersStore = useOrdersStore();

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleString() : '—';
}

function refresh() {
  ordersStore.loadAuditTrail({ limit: 100 });
}

onMounted(refresh);
</script>

<style scoped>
.panel-body--flush { padding: 0; }
</style>
