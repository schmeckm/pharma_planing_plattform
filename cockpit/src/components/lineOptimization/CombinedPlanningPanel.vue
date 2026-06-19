<template>
  <Card class="combined-planning">
    <template #title>
      <div class="cp-title">
        <span>Combined forward/backward planning</span>
        <Button
          label="Recalculate"
          icon="pi pi-refresh"
          text
          :loading="loading"
          @click="$emit('refresh')"
        />
      </div>
    </template>
    <template #content>
      <p v-if="disabled" class="cp-muted">
        Combined planning is disabled (COMBINED_PLANNING=false).
      </p>
      <template v-else-if="summary">
        <div class="cp-summary">
          <Tag severity="info" :value="`${summary.total} orders`" />
          <Tag severity="success" :value="`${summary.feasible} executable`" />
          <Tag v-if="summary.late" severity="danger" :value="`${summary.late} late`" />
          <Tag v-if="summary.blocked" severity="warn" :value="`${summary.blocked} blocked`" />
          <Tag v-if="summary.forwardOnly" severity="secondary" :value="`${summary.forwardOnly} forward only`" />
        </div>

        <DataTable
          :value="items"
          size="small"
          striped-rows
          :row-class="rowClass"
          @row-click="onRowClick"
        >
          <Column field="packagingOrderId" header="Order" style="min-width: 7rem" />
          <Column header="Delivery" style="min-width: 6rem">
            <template #body="{ data }">{{ data.requestedDeliveryDate || '—' }}</template>
          </Column>
          <Column header="Backward (latest)" style="min-width: 9rem">
            <template #body="{ data }">
              <span v-if="data.backward?.latestPackagingStart">
                {{ data.backward.latestPackagingStart }} → {{ data.backward.latestPackagingEnd }}
              </span>
              <span v-else class="cp-muted">—</span>
            </template>
          </Column>
          <Column header="Forward (earliest)" style="min-width: 9rem">
            <template #body="{ data }">
              <span v-if="data.forward?.earliestPackagingStart">
                {{ data.forward.earliestPackagingStart }} → {{ data.forward.earliestPackagingEnd }}
              </span>
              <span v-else class="cp-muted">—</span>
            </template>
          </Column>
          <Column header="Combined" style="min-width: 9rem">
            <template #body="{ data }">
              <strong>{{ data.plannedStartDate }}</strong> → <strong>{{ data.plannedEndDate }}</strong>
            </template>
          </Column>
          <Column header="Slack" style="width: 4rem">
            <template #body="{ data }">
              <span v-if="data.slackDaysToDelivery != null">{{ data.slackDaysToDelivery }} d</span>
              <span v-else>—</span>
            </template>
          </Column>
          <Column header="ATP/Master" style="width: 5rem">
            <template #body="{ data }">
              <Tag
                :severity="data.masterData?.eligible ? 'success' : 'danger'"
                :value="data.masterData?.eligible ? 'OK' : 'Block'"
              />
            </template>
          </Column>
          <Column header="Status" style="width: 6rem">
            <template #body="{ data }">
              <Tag :severity="statusSeverity(data)" :value="statusLabel(data)" />
            </template>
          </Column>
        </DataTable>
      </template>
      <p v-else class="cp-muted">No calculation yet — run optimize or recalculate.</p>
    </template>
  </Card>
</template>

<script setup>
import Card from 'primevue/card';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';

const props = defineProps({
  items: { type: Array, default: () => [] },
  summary: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['refresh', 'select-order']);

function statusLabel(row) {
  if (!row.masterData?.eligible) return 'Blocked';
  if (row.late) return 'Late';
  if (!row.feasibleWindow) return 'Conflict';
  return 'Executable';
}

function statusSeverity(row) {
  if (!row.masterData?.eligible) return 'danger';
  if (row.late || !row.feasibleWindow) return 'warn';
  return 'success';
}

function rowClass(row) {
  if (!row.masterData?.eligible) return 'cp-row-blocked';
  if (row.late || !row.feasibleWindow) return 'cp-row-risk';
  return '';
}

function onRowClick({ data }) {
  emit('select-order', data.packagingOrderId);
}
</script>

<style scoped>
.combined-planning { margin-top: 8px; }
.cp-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.cp-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.cp-muted {
  color: var(--color-text-muted);
  font-size: var(--text-md);
  margin: 0;
}
:deep(.cp-row-blocked) { background: rgba(220, 53, 69, 0.06) !important; }
:deep(.cp-row-risk) { background: rgba(255, 193, 7, 0.08) !important; }
</style>

