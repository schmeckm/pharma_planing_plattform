<template>
  <div class="order-sim-table">
    <div v-if="rows.length" class="table-toolbar">
      <el-button link type="primary" size="small" @click="expandAll">
        Expand all
      </el-button>
      <el-button link size="small" @click="collapseAll">
        Collapse all
      </el-button>
      <span v-if="selectedOrderIds.length" class="table-toolbar__selection">
        {{ selectedOrderIds.length }} selected
      </span>
      <el-button
        v-if="selectedOrderIds.length"
        link
        size="small"
        @click="clearSelection"
      >
        Clear selection
      </el-button>
      <span class="table-toolbar__hint">{{ rows.length }} orders</span>
    </div>
    <el-table
      :data="rows"
      row-key="id"
      :tree-props="{ children: 'children' }"
      :expand-row-keys="expandedKeys"
      highlight-current-row
      stripe
      size="small"
      style="width: 100%"
      :row-class-name="rowClassName"
      @expand-change="onExpandChange"
      @row-click="onRowClick"
    >
      <el-table-column width="44" align="center" class-name="col-select">
        <template #header>
          <el-checkbox
            :model-value="allSelected"
            :indeterminate="someSelected && !allSelected"
            @change="toggleSelectAll"
            @click.stop
          />
        </template>
        <template #default="{ row }">
          <el-checkbox
            v-if="row.rowType === 'header'"
            :model-value="isSelected(row.packagingOrderId)"
            @change="(checked) => toggleRow(row.packagingOrderId, checked)"
            @click.stop
          />
        </template>
      </el-table-column>
      <el-table-column label="Order / Position" min-width="160">
      <template #default="{ row }">
        <el-tooltip
          v-if="row.rowType === 'header' && row.failureTooltip"
          :content="row.failureTooltip"
          placement="top"
          :show-after="300"
          popper-class="failure-tooltip"
        >
          <span class="cell-header cell-header--failed-hint">
            {{ row.packagingOrderId }}
            <span v-if="row.children?.length" class="cell-bom-count">({{ row.children.length }} pos.)</span>
          </span>
        </el-tooltip>
        <span v-else-if="row.rowType === 'header'" class="cell-header">
          {{ row.packagingOrderId }}
          <span v-if="row.children?.length" class="cell-bom-count">({{ row.children.length }} pos.)</span>
        </span>
        <span v-else class="cell-component">
          <span class="cell-pos">{{ row.position }}</span>
          {{ row.materialNumber }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="Country" width="72">
      <template #default="{ row }">
        {{ row.rowType === 'header' ? row.destinationCountry : '—' }}
      </template>
    </el-table-column>
    <el-table-column label="Component" width="110">
      <template #default="{ row }">
        <span v-if="row.rowType === 'component'">{{ componentLabel(row) }}</span>
        <span v-else class="cell-muted">Header</span>
      </template>
    </el-table-column>
    <el-table-column prop="materialDescription" label="Description" min-width="170" show-overflow-tooltip>
      <template #default="{ row }">
        {{ row.materialDescription || '—' }}
      </template>
    </el-table-column>
    <el-table-column label="Quantity" width="100">
      <template #default="{ row }">
        <span v-if="row.quantity != null">{{ row.quantity?.toLocaleString() }} {{ row.unit || '' }}</span>
        <span v-else>—</span>
      </template>
    </el-table-column>
    <el-table-column label="Batch Req." width="88" align="center">
      <template #default="{ row }">
        <template v-if="row.rowType === 'component'">
          <el-tag v-if="row.batchManaged" size="small" type="warning">Yes</el-tag>
          <el-tag v-else size="small" type="info">No</el-tag>
        </template>
        <span v-else class="cell-muted">—</span>
      </template>
    </el-table-column>
    <el-table-column label="Assigned Batch" width="150">
      <template #default="{ row }">
        <template v-if="row.rowType === 'header'">
          <template v-if="row.recommendedBatchId">
            <div>{{ row.recommendedBatchId }}</div>
            <div v-if="row.batchMaterialNumber" class="cell-sub">{{ row.batchMaterialNumber }}</div>
          </template>
          <span v-else class="cell-muted">—</span>
        </template>
        <template v-else-if="row.batchManaged">
          <div>{{ row.recommendedBatchId || '—' }}</div>
          <div v-if="row.batchMaterialNumber" class="cell-sub">{{ row.batchMaterialNumber }}</div>
        </template>
        <span v-else class="cell-muted">n/a</span>
      </template>
    </el-table-column>
    <el-table-column label="Shelf-Life Risk" width="88">
      <template #default="{ row }">
        <span v-if="row.rowType === 'header' && row.recommendedBatchId">{{ row.rmsl ?? '—' }}</span>
        <span v-else-if="row.rowType === 'component' && row.batchManaged">{{ row.rmsl ?? '—' }}</span>
        <span v-else>—</span>
      </template>
    </el-table-column>
    <el-table-column label="Status" width="110">
      <template #default="{ row }">
        <el-tooltip
          v-if="row.rowType === 'header' && row.failureTooltip"
          :content="row.failureTooltip"
          placement="top"
          :show-after="300"
          popper-class="failure-tooltip"
        >
          <span class="status-tooltip-wrap">
            <StatusTag :status="row.status || row.simulationStatus || 'OPEN'" />
          </span>
        </el-tooltip>
        <StatusTag
          v-else-if="row.rowType === 'header'"
          :status="row.status || row.simulationStatus || 'OPEN'"
        />
        <span v-else class="cell-muted">—</span>
      </template>
    </el-table-column>
    <el-table-column label="Actions" width="280" fixed="right">
      <template #default="{ row }">
        <template v-if="row.rowType === 'header'">
          <el-button
            link
            type="primary"
            size="small"
            @click.stop="$emit('continue', row.packagingOrderId)"
          >
            Weiter
          </el-button>
          <el-button
            link
            type="primary"
            size="small"
            @click.stop="$emit('simulate', row.packagingOrderId)"
          >
            Simulate
          </el-button>
          <el-button
            v-if="canAllocate(row)"
            link
            type="success"
            size="small"
            @click.stop="$emit('allocate', row.packagingOrderId)"
          >
            Allocate
          </el-button>
          <el-button
            v-if="canUnallocate(row)"
            link
            type="warning"
            size="small"
            @click.stop="$emit('unallocate', row.packagingOrderId)"
          >
            Unallocate
          </el-button>
        </template>
      </template>
    </el-table-column>
  </el-table>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import StatusTag from '@/components/shared/StatusTag.vue';

const props = defineProps({
  rows: { type: Array, default: () => [] },
  selectedOrderIds: { type: Array, default: () => [] },
});

const emit = defineEmits([
  'select',
  'simulate',
  'allocate',
  'unallocate',
  'continue',
  'update:selectedOrderIds',
]);

const headerOrderIds = computed(() =>
  props.rows
    .filter((r) => r.rowType === 'header')
    .map((r) => r.packagingOrderId)
    .filter(Boolean),
);

const allSelected = computed(
  () => headerOrderIds.value.length > 0
    && headerOrderIds.value.every((id) => props.selectedOrderIds.includes(id)),
);

const someSelected = computed(() =>
  headerOrderIds.value.some((id) => props.selectedOrderIds.includes(id)),
);

function isSelected(orderId) {
  return props.selectedOrderIds.includes(orderId);
}

function toggleRow(orderId, checked) {
  const next = checked
    ? [...new Set([...props.selectedOrderIds, orderId])]
    : props.selectedOrderIds.filter((id) => id !== orderId);
  emit('update:selectedOrderIds', next);
}

function toggleSelectAll(checked) {
  emit('update:selectedOrderIds', checked ? [...headerOrderIds.value] : []);
}

function clearSelection() {
  emit('update:selectedOrderIds', []);
}

watch(headerOrderIds, (ids) => {
  const valid = new Set(ids);
  const pruned = props.selectedOrderIds.filter((id) => valid.has(id));
  if (pruned.length !== props.selectedOrderIds.length) {
    emit('update:selectedOrderIds', pruned);
  }
});

const UNALLOCATABLE_STATUSES = ['SIMULATED', 'SUCCESS', 'ALLOCATED', 'PARTIALLY_ALLOCATED'];

function canAllocate(row) {
  const status = row.status || row.simulationStatus;
  if (status === 'SIMULATED' && !row.recommendedBatchId) {
    return row.children?.some((c) => c.batchManaged && c.recommendedBatchId);
  }
  return status === 'SIMULATED';
}

function canUnallocate(row) {
  if (row.recommendedBatchId) return true;
  const status = row.status || row.simulationStatus;
  if (UNALLOCATABLE_STATUSES.includes(status)) return true;
  return row.children?.some((c) => c.batchManaged && c.recommendedBatchId);
}

const expandedKeys = ref([]);

watch(
  () => props.rows.map((r) => r.id).join(','),
  () => {
    expandedKeys.value = [];
  }
);

function onExpandChange(_row, expandedRows) {
  expandedKeys.value = expandedRows.map((r) => r.id);
}

function expandAll() {
  expandedKeys.value = props.rows.map((r) => r.id);
}

function collapseAll() {
  expandedKeys.value = [];
}
function componentLabel(row) {
  if (row.componentType === 'DRUG_PRODUCT') return 'Drug Product';
  if (row.componentType === 'PACKAGING_MATERIAL') return 'Packaging';
  return 'Component';
}

function rowClassName({ row }) {
  return row.rowType === 'header' ? 'row-order-header' : 'row-bom-line';
}

function onRowClick(row) {
  if (row.rowType === 'header' && row.children?.length) {
    const key = row.id;
    if (expandedKeys.value.includes(key)) {
      expandedKeys.value = expandedKeys.value.filter((k) => k !== key);
    } else {
      expandedKeys.value = [...expandedKeys.value, key];
    }
  }
  if (row.packagingOrderId) {
    emit('select', row.packagingOrderId);
  }
}
</script>

<style scoped>
.order-sim-table {
  width: 100%;
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}

.table-toolbar__selection {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--el-color-primary);
}

.table-toolbar__hint {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.cell-header {
  font-weight: 600;
}

.cell-header--failed-hint {
  cursor: help;
  border-bottom: 1px dashed var(--color-error);
}

.status-tooltip-wrap {
  display: inline-flex;
  cursor: help;
}

.cell-bom-count {
  margin-left: 6px;
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-text-muted);
}

.cell-component {
  color: var(--color-text-secondary);
}

.cell-pos {
  display: inline-block;
  min-width: 1.5rem;
  margin-right: 4px;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.cell-sub {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.cell-muted {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

:deep(.row-order-header) {
  background: var(--el-fill-color-light) !important;
  cursor: pointer;
}

:deep(.row-order-header td) {
  font-weight: 500;
}
</style>

<style>
.failure-tooltip {
  max-width: 360px;
  white-space: pre-line;
  line-height: 1.45;
  font-size: 0.8125rem;
}
</style>
