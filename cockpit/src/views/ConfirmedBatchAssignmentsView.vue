<template>

  <div>

    <WizardReturnBar />

    <p class="page-subtitle">Confirmed production sequences and executed batch assignments</p>



    <el-tabs v-model="activeTab">

      <el-tab-pane label="Confirmed Sequences" name="sequences">

        <div class="panel">

          <div class="panel-header">

            <h2>Confirmed Plant Sequence</h2>

            <el-button size="small" @click="loadSchedule">Refresh</el-button>

          </div>

          <div class="panel-body">

            <div v-if="schedule.status === 'CONFIRMED'" class="schedule-meta">

              <el-tag type="success">{{ schedule.status }}</el-tag>

              <span>Schedule {{ schedule.scheduleId }}</span>

              <span>{{ schedule.itemCount }} orders</span>

              <span v-if="schedule.confirmedAt">Confirmed {{ formatDate(schedule.confirmedAt) }}</span>

            </div>

            <p v-else class="empty">No confirmed sequence yet — confirm from Production Sequencing</p>



            <el-table v-if="schedule.orders?.length" :data="schedule.orders" stripe size="small" class="mt-3">

              <el-table-column prop="packagingOrder" label="PO" width="120">

                <template #default="{ row }">{{ row.packagingOrder || row.packagingOrderId }}</template>

              </el-table-column>

              <el-table-column prop="destinationCountry" label="Country" width="80" />

              <el-table-column prop="productionLine" label="Line" width="140" />

              <el-table-column prop="plannedStartDate" label="Start" width="110" />

              <el-table-column prop="plannedEndDate" label="End" width="110" />

              <el-table-column prop="requestedDeliveryDate" label="Delivery" width="110" />

              <el-table-column prop="durationHours" label="Hours" width="80" />

              <el-table-column prop="priority" label="Priority" width="90" />

              <el-table-column prop="recommendedBatchId" label="Batch" width="140" />

            </el-table>



            <el-button v-if="schedule.status !== 'CONFIRMED'" type="primary" class="mt-3" @click="$router.push('/line-optimization')">

              Open Production Sequencing

            </el-button>

          </div>

        </div>

      </el-tab-pane>



      <el-tab-pane :label="PLANNER_LABELS.CONFIRMED_BATCH_ASSIGNMENTS" name="assignments">

        <div class="panel">

          <div class="panel-header">

            <h2>{{ PLANNER_LABELS.CONFIRMED_BATCH_ASSIGNMENTS }}</h2>

            <el-button size="small" @click="refreshAudit">Refresh</el-button>

          </div>

          <div class="panel-body panel-body--flush">

            <el-table :data="confirmedRows" stripe size="small">

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

            <p v-if="!confirmedRows.length" class="empty">

              No confirmed batch assignments yet — execute from Batch Recommendations

            </p>

          </div>

        </div>

      </el-tab-pane>

    </el-tabs>

  </div>

</template>



<script setup>

import { ref, computed, onMounted } from 'vue';

import StatusTag from '@/components/shared/StatusTag.vue';
import WizardReturnBar from '@/components/wizard/WizardReturnBar.vue';

import { useOrdersStore } from '@/stores/orders';

import { planningApi } from '@/api/planning';

import { PLANNER_LABELS } from '@/utils/plannerTerminology';



const ordersStore = useOrdersStore();

const activeTab = ref('sequences');

const schedule = ref({ status: 'DRAFT', orders: [], itemCount: 0 });



const confirmedRows = computed(() =>

  ordersStore.auditTrail.filter((r) => r.executionMode === 'EXECUTE' || r.status === 'SUCCESS')

);



function formatDate(ts) {

  return ts ? new Date(ts).toLocaleString() : '—';

}



async function loadSchedule() {

  schedule.value = await planningApi.getConfirmedSchedule();

}



function refreshAudit() {

  ordersStore.loadAuditTrail({ limit: 100 });

}



onMounted(() => {

  loadSchedule();

  refreshAudit();

});

</script>



<style scoped>

.panel-body--flush { padding: 0; }

.panel-body { padding: 16px; }

.schedule-meta { display: flex; gap: 16px; align-items: center; font-size: 0.875rem; flex-wrap: wrap; }

.empty { padding: 16px 0; color: var(--text-color-secondary); font-size: 0.875rem; margin: 0; }

.mt-3 { margin-top: 12px; }

</style>

