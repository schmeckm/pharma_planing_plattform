<template>
  <div>
    <WizardReturnBar />
    <p class="page-subtitle">Full traceability of allocation decisions and rule evaluations</p>

    <div class="panel">
      <div class="panel-header">
        <h2>Audit Trail</h2>
        <div class="filters">
          <el-input v-model="filters.packagingOrderId" placeholder="Order ID" size="small" style="width: 140px" clearable />
          <el-select v-model="filters.status" placeholder="Status" size="small" style="width: 130px" clearable>
            <el-option label="SUCCESS" value="SUCCESS" />
            <el-option label="SIMULATED" value="SIMULATED" />
            <el-option label="FAILED" value="FAILED" />
          </el-select>
          <el-button type="primary" size="small" @click="search">Search</el-button>
        </div>
      </div>
      <div class="panel-body">
        <p class="meta">Showing {{ entries.length }} of {{ total }} entries</p>

        <el-collapse v-model="expanded">
          <el-collapse-item
            v-for="entry in entries"
            :key="entry.decisionId"
            :name="entry.decisionId"
            :title="`${entry.decisionId} — ${entry.packagingOrderId} → ${entry.batchId || 'No batch'}`"
          >
            <div class="audit-meta">
              <StatusTag :status="entry.status" />
              <span>{{ entry.executionMode }}</span>
              <span>{{ formatDate(entry.timestamp) }}</span>
              <span>{{ entry.userId }}</span>
            </div>
            <div v-if="entry.failureReasons?.length" class="failure-box">
              <div v-for="(msg, i) in entry.failureReasons" :key="i">{{ plannerText(msg) }}</div>
            </div>
            <el-table :data="entry.ruleChecks" size="small" stripe>
              <el-table-column label="Rule" width="180">
                <template #default="{ row }">{{ ruleLabel(row.ruleName) }}</template>
              </el-table-column>
              <el-table-column label="Result" width="100">
                <template #default="{ row }"><StatusTag :status="row.result" /></template>
              </el-table-column>
              <el-table-column label="Message">
                <template #default="{ row }">{{ plannerText(row.message) }}</template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import StatusTag from '@/components/shared/StatusTag.vue';
import WizardReturnBar from '@/components/wizard/WizardReturnBar.vue';
import { useOrdersStore } from '@/stores/orders';
import { ruleLabel, plannerText } from '@/utils/plannerTerminology';

const ordersStore = useOrdersStore();
const entries = ref([]);
const total = ref(0);
const expanded = ref([]);
const filters = ref({ packagingOrderId: '', status: '' });

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleString() : '—';
}

async function search() {
  const params = { limit: 100 };
  if (filters.value.packagingOrderId) params.packagingOrderId = filters.value.packagingOrderId;
  if (filters.value.status) params.status = filters.value.status;
  const result = await ordersStore.loadAuditTrail(params);
  entries.value = ordersStore.auditTrail;
  total.value = result?.total ?? entries.value.length;
}

onMounted(search);
</script>

<style scoped>
.filters {
  display: flex;
  gap: 8px;
  align-items: center;
}

.meta {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 12px;
}

.audit-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.failure-box {
  background: #ffebee;
  color: var(--color-error);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8125rem;
  margin-bottom: 12px;
}
</style>
