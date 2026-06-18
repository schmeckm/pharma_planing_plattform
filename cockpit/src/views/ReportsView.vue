<template>
  <div>
    <p class="page-subtitle">Allocation performance and compliance reporting</p>

    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr)">
      <KpiCard label="Total Simulations" :value="stats.totalSimulations" icon="Cpu" />
      <KpiCard label="Success Rate" :value="stats.successRate" suffix="%" icon="TrendCharts" accent="success" />
      <KpiCard label="Failed Allocations" :value="stats.failed" icon="Warning" accent="warning" />
      <KpiCard label="Countries Active" :value="stats.countries" icon="Location" accent="neutral" />
    </div>

    <div class="panel">
      <div class="panel-header"><h2>Allocation Summary by Country</h2></div>
      <div class="panel-body panel-body--flush">
        <el-table :data="countrySummary" stripe size="small">
          <el-table-column prop="country" label="Country" width="100" />
          <el-table-column prop="orders" label="Orders" width="100" />
          <el-table-column prop="simulated" label="Simulated" width="100" />
          <el-table-column prop="allocated" label="Allocated" width="100" />
          <el-table-column prop="avgRmsl" label="Avg Shelf-Life (mo)" width="120" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import { useOrdersStore } from '@/stores/orders';

const ordersStore = useOrdersStore();

onMounted(async () => {
  await Promise.all([
    ordersStore.loadOrders(),
    ordersStore.loadAuditTrail({ limit: 200 }),
    ordersStore.loadRules(),
  ]);
});

const stats = computed(() => {
  const audit = ordersStore.auditTrail;
  const success = audit.filter((a) => a.status === 'SUCCESS').length;
  const failed = audit.filter((a) => a.status === 'FAILED').length;
  const total = audit.length || 1;
  return {
    totalSimulations: audit.filter((a) => a.executionMode === 'SIMULATE').length,
    successRate: Math.round((success / total) * 100) || 0,
    failed,
    countries: ordersStore.rules.countryRules?.length || 0,
  };
});

const countrySummary = computed(() => {
  const map = {};
  for (const order of ordersStore.orders) {
    const c = order.destinationCountry;
    if (!map[c]) map[c] = { country: c, orders: 0, simulated: 0, allocated: 0, avgRmsl: 0 };
    map[c].orders++;
    if (order.status === 'SIMULATED') map[c].simulated++;
    if (order.status === 'ALLOCATED') map[c].allocated++;
  }
  return Object.values(map);
});
</script>

<style scoped>
.panel-body--flush { padding: 0; }
</style>
