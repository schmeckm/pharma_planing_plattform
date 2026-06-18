<template>
  <div>
    <p class="page-subtitle">Finished goods batches with quality, market release, and shelf-life compliance</p>

    <div class="panel">
      <div class="panel-header">
        <h2>Batch Inventory</h2>
        <el-select v-model="materialFilter" placeholder="Material" size="small" style="width: 180px" @change="load">
          <el-option label="All Materials" value="" />
          <el-option label="DP-1000 — Product Alpha" value="DP-1000" />
          <el-option label="DP-2000 — Product Beta" value="DP-2000" />
        </el-select>
      </div>
      <div class="panel-body panel-body--flush">
        <el-table :data="ordersStore.batches" stripe size="small">
          <el-table-column prop="batchId" label="Batch ID" width="150" />
          <el-table-column prop="materialNumber" label="Material" width="110" />
          <el-table-column label="Available Qty" width="110">
            <template #default="{ row }">{{ row.availableQuantity?.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="productionDate" label="Production" width="110" />
          <el-table-column prop="expiryDate" label="Expiry" width="110" />
          <el-table-column label="Shelf-Life (mo)" width="90">
            <template #default="{ row }">{{ row.remainingShelfLifeMonths ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="Quality" width="100">
            <template #default="{ row }"><StatusTag :status="row.qualityStatus" /></template>
          </el-table-column>
          <el-table-column label="Market Release Countries" min-width="140">
            <template #default="{ row }">{{ row.approvedCountries?.join(', ') || '—' }}</template>
          </el-table-column>
          <el-table-column label="Sequence" width="80">
            <template #default="{ row }">{{ row.batchSequence ?? '—' }}</template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import StatusTag from '@/components/shared/StatusTag.vue';
import { useOrdersStore } from '@/stores/orders';

const ordersStore = useOrdersStore();
const materialFilter = ref('');

function load() {
  ordersStore.loadBatches(materialFilter.value ? { materialNumber: materialFilter.value } : {});
}

onMounted(load);
</script>

<style scoped>
.panel-body--flush { padding: 0; }
</style>
