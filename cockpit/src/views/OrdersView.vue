<template>
  <div>
    <p class="page-subtitle">
      Packaging orders for production planning
      <span v-if="!showAll" class="subtitle-hint"> — filtered to today ({{ todayIso }})</span>
    </p>

    <el-alert
      v-if="!showAll && ordersStore.orders.length && !filteredOrders.length"
      type="info"
      :closable="false"
      show-icon
      class="orders-hint"
      title="No packaging orders scheduled for today"
      description="Demo orders are planned from September 2026. Toggle “All orders” to see the full list."
    />

    <div class="panel">
      <div class="panel-header">
        <h2>Today's Orders</h2>
        <div class="header-actions">
          <el-switch v-model="showAll" active-text="All orders" inactive-text="Today only" />
          <el-input v-model="search" placeholder="Search order ID…" size="small" style="width: 200px" clearable />
        </div>
      </div>
      <div class="panel-body panel-body--flush">
        <el-table :data="filteredOrders" stripe size="small">
          <el-table-column prop="packagingOrderId" label="Packaging Order" width="130" />
          <el-table-column prop="salesOrderId" label="Sales Order" width="120" />
          <el-table-column prop="materialDescription" label="Material" min-width="200" show-overflow-tooltip />
          <el-table-column prop="destinationCountry" label="Country" width="80" />
          <el-table-column label="Quantity" width="100">
            <template #default="{ row }">{{ row.quantity?.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="plannedStartDate" label="Planned Start" width="120" />
          <el-table-column label="Status" width="110">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
          <el-table-column prop="allocatedBatchId" label="Allocated Batch" width="140" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import StatusTag from '@/components/shared/StatusTag.vue';
import { useOrdersStore } from '@/stores/orders';

const ordersStore = useOrdersStore();
const search = ref('');
const showAll = ref(false);

const todayIso = new Date().toISOString().slice(0, 10);

const filteredOrders = computed(() => {
  let list = ordersStore.orders;
  if (!showAll.value) {
    list = list.filter((o) => o.plannedStartDate === todayIso);
  }
  if (!search.value) return list;
  const q = search.value.toLowerCase();
  return list.filter(
    (o) =>
      o.packagingOrderId.toLowerCase().includes(q) ||
      o.salesOrderId.toLowerCase().includes(q)
  );
});

onMounted(async () => {
  await ordersStore.loadOrders();
  const hasToday = ordersStore.orders.some((o) => o.plannedStartDate === todayIso);
  if (!hasToday && ordersStore.orders.length) {
    showAll.value = true;
  }
});
</script>

<style scoped>
.panel-body--flush {
  padding: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.orders-hint {
  margin-bottom: 16px;
}

.subtitle-hint {
  color: var(--el-text-color-secondary);
  font-weight: normal;
}
</style>
