<template>
  <div class="v2-page autopilot-view">
    <p class="page-subtitle">
      Planning Autopilot — automatically sequences orders and assigns draft batches where policy allows.
      Hard allocation still requires planner confirmation.
    </p>

    <div class="console-toolbar">
      <Button label="Dry Run" icon="pi pi-eye" severity="secondary" outlined :loading="loading" @click="run(true)" />
      <Button label="Run Autopilot" icon="pi pi-bolt" :loading="loading" @click="run(false)" />
      <InputNumber v-model="maxOrders" :min="1" :max="500" show-buttons suffix=" orders" />
      <Tag v-if="status?.enabled" severity="success" value="Enabled" />
      <Tag v-else severity="danger" value="Disabled" />
    </div>

    <Card v-if="status">
      <template #title>Policy</template>
      <template #content>
        <p class="advisor-note">{{ status.advisorNote }}</p>
        <div class="policy-grid">
          <div><strong>Modus</strong><br>{{ status.policy.autonomyMode || 'TIERED' }}</div>
          <div><strong>Min confidence</strong><br>{{ status.policy.minConfidence }}</div>
          <div><strong>Hard allocation</strong><br>{{ status.policy.allowHardAllocation ? 'Ja (LOW only)' : 'Nein — Planer' }}</div>
          <div><strong>LOW tier</strong><br>Seq + Confirm + Draft</div>
          <div><strong>MEDIUM tier</strong><br>Seq + Draft</div>
          <div><strong>HIGH tier</strong><br>Planer-Freigabe</div>
        </div>
      </template>
    </Card>

    <Card v-if="lastRun" class="mt-3">
      <template #title>Last Run — {{ lastRun.runId }}</template>
      <template #content>
        <div class="run-meta">
          <span><strong>Mode:</strong> {{ lastRun.dryRun ? 'Dry run' : 'Live (draft saved)' }}</span>
          <span><strong>Orders:</strong> {{ lastRun.summary.totalOrders }}</span>
          <span><strong>Auto allocated:</strong> {{ lastRun.summary.autoAllocated }}</span>
          <span><strong>Escalated:</strong> {{ lastRun.summary.escalated }}</span>
        </div>
        <p class="advisor-note mt-2">{{ lastRun.advisorNote }}</p>

        <h4 class="section-title">Auto actions</h4>
        <DataTable :value="lastRun.actions" size="small" striped-rows>
          <Column field="action" header="Action" />
          <Column field="packagingOrderId" header="Order" />
          <Column field="batchId" header="Batch" />
          <Column field="confidence" header="Confidence">
            <template #body="{ data }">{{ data.confidence != null ? (data.confidence * 100).toFixed(0) + '%' : '—' }}</template>
          </Column>
          <Column field="tier" header="Tier" />
          <Column field="riskLevel" header="Risk" />
        </DataTable>

        <h4 class="section-title mt-3">Escalations (planner review)</h4>
        <DataTable :value="lastRun.escalations" size="small" striped-rows>
          <Column field="action" header="Action" />
          <Column field="packagingOrderId" header="Order" />
          <Column field="destinationCountry" header="Country" />
          <Column field="reason" header="Reason" />
          <Column field="confidence" header="Confidence">
            <template #body="{ data }">{{ data.confidence != null ? (data.confidence * 100).toFixed(0) + '%' : '—' }}</template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card class="mt-3">
      <template #title>Run History</template>
      <template #content>
        <DataTable :value="history" size="small" striped-rows>
          <Column field="runId" header="Run ID" />
          <Column field="startedAt" header="Started" />
          <Column field="dryRun" header="Dry">
            <template #body="{ data }">{{ data.dryRun ? 'Yes' : 'No' }}</template>
          </Column>
          <Column header="Auto / Escalated">
            <template #body="{ data }">
              {{ data.summary?.autoAllocated }} / {{ data.summary?.escalated }}
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { apiV3 } from '@/api/v3';

const toast = useToast();
const loading = ref(false);
const status = ref(null);
const lastRun = ref(null);
const history = ref([]);
const maxOrders = ref(52);

async function load() {
  try {
    status.value = await apiV3.autopilotStatus();
    lastRun.value = status.value.lastRun;
    const runs = await apiV3.autopilotRuns(10);
    history.value = runs.runs || [];
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Load failed', detail: err.message, life: 4000 });
  }
}

async function run(dryRun) {
  loading.value = true;
  try {
    const result = await apiV3.runAutopilot({ dryRun, maxOrders: maxOrders.value });
    lastRun.value = result;
    toast.add({
      severity: 'success',
      summary: dryRun ? 'Dry run complete' : 'Autopilot complete',
      detail: `${result.summary.autoAllocated} auto · ${result.summary.escalated} escalated`,
      life: 5000,
    });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Autopilot failed', detail: err.message, life: 5000 });
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.autopilot-view .console-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
.policy-grid, .run-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}
.advisor-note {
  color: var(--p-text-muted-color, #64748b);
  font-size: 0.9rem;
}
.section-title {
  margin: 1rem 0 0.5rem;
  font-size: 0.95rem;
}
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 1rem; }
</style>
