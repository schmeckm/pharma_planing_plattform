<template>
  <div class="generic-crud">
    <div class="generic-crud__toolbar panel">
      <div class="generic-crud__toolbar-left">
        <h2 class="generic-crud__title">{{ entityLabel }}</h2>
        <span class="generic-crud__count text-muted">{{ pagination.total }} records</span>
      </div>
      <div class="generic-crud__toolbar-right">
        <span class="p-input-icon-left generic-crud__search">
          <i class="pi pi-search" />
          <InputText v-model="searchQuery" placeholder="Search…" @keyup.enter="loadData" />
        </span>
        <Button icon="pi pi-refresh" severity="secondary" outlined :loading="loading" @click="loadData" />
        <Button label="Add" icon="pi pi-plus" :loading="loading" @click="openCreate" />
      </div>
    </div>

    <div class="panel generic-crud__table-wrap">
      <DataTable
        :value="rows"
        :loading="loading"
        data-key="rowKey"
        striped-rows
        size="small"
        paginator
        :rows="pagination.pageSize"
        :total-records="pagination.total"
        :lazy="true"
        :first="(pagination.page - 1) * pagination.pageSize"
        sort-mode="single"
        removable-sort
        :sort-field="sortField"
        :sort-order="sortOrder"
        edit-mode="cell"
        @cell-edit-complete="onCellEdit"
        @page="onPage"
        @sort="onSort"
        class="generic-crud__table"
      >
        <Column
          v-for="col in columns"
          :key="col.field"
          :field="col.field"
          :header="col.header"
          :sortable="col.sortable"
          :style="colStyle(col)"
        >
          <template v-if="col.type === 'boolean'" #body="{ data }">
            <Tag :severity="data[col.field] ? 'success' : 'secondary'" :value="data[col.field] ? 'Yes' : 'No'" />
          </template>
          <template v-else-if="col.type === 'enum'" #body="{ data }">
            <Tag severity="info" :value="data[col.field] || '—'" />
          </template>
          <template v-else #body="{ data }">
            {{ formatCell(data[col.field]) }}
          </template>

          <template v-if="editable && col.type === 'boolean'" #editor="{ data, field }">
            <Checkbox v-model="data[field]" :binary="true" />
          </template>
          <template v-else-if="editable && col.type === 'enum'" #editor="{ data, field }">
            <Dropdown
              v-model="data[field]"
              :options="enumOptions(col.enumKey)"
              placeholder="Select"
              class="w-full"
            />
          </template>
          <template v-else-if="editable && col.type === 'number'" #editor="{ data, field }">
            <InputNumber v-model="data[field]" class="w-full" />
          </template>
          <template v-else-if="editable && col.type === 'date'" #editor="{ data, field }">
            <InputText v-model="data[field]" class="w-full" placeholder="YYYY-MM-DD" />
          </template>
          <template v-else-if="editable && !isIdColumn(col)" #editor="{ data, field }">
            <InputText v-model="data[field]" class="w-full" />
          </template>
        </Column>

        <Column header="Actions" style="width: 8rem" frozen align-frozen="right">
          <template #body="{ data }">
            <div class="generic-crud__actions">
              <Button icon="pi pi-pencil" text rounded severity="secondary" @click="openEdit(data)" />
              <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmDelete(data)" />
            </div>
          </template>
        </Column>

        <template #empty>
          <p class="empty-state">No records found</p>
        </template>
      </DataTable>
    </div>

    <Dialog
      v-model:visible="dialogVisible"
      :header="dialogMode === 'create' ? `Add ${entityLabel}` : `Edit ${entityLabel}`"
      modal
      :style="{ width: 'min(640px, 96vw)' }"
      class="generic-crud__dialog"
    >
      <div class="generic-crud__form">
        <div v-for="col in formColumns" :key="col.field" class="form-field">
          <label class="form-field__label">
            {{ col.header }}
            <span v-if="col.required" class="required">*</span>
          </label>
          <Checkbox v-if="col.type === 'boolean'" v-model="formData[col.field]" :binary="true" />
          <Dropdown
            v-else-if="col.type === 'enum'"
            v-model="formData[col.field]"
            :options="enumOptions(col.enumKey)"
            placeholder="Select"
            class="w-full"
          />
          <InputNumber v-else-if="col.type === 'number'" v-model="formData[col.field]" class="w-full" />
          <Calendar
            v-else-if="col.type === 'date'"
            v-model="formData[col.field]"
            date-format="yy-mm-dd"
            show-icon
            class="w-full"
          />
          <InputText
            v-else
            v-model="formData[col.field]"
            class="w-full"
            :disabled="dialogMode === 'edit' && isIdColumn(col)"
          />
          <small v-if="fieldErrors[col.field]" class="field-error">{{ fieldErrors[col.field] }}</small>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="dialogVisible = false" />
        <Button label="Save" icon="pi pi-check" :loading="saving" @click="saveForm" />
      </template>
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Calendar from 'primevue/calendar';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import ConfirmDialog from 'primevue/confirmdialog';
import { adminDataApi } from '@/api/adminData';
import { ENUM_OPTIONS } from '@/config/adminDataEntities';

const props = defineProps({
  entitySlug: { type: String, required: true },
  entityLabel: { type: String, required: true },
  columns: { type: Array, required: true },
  idField: { type: String, required: true },
  enumOptionsMap: { type: Object, default: () => ENUM_OPTIONS },
  editable: { type: Boolean, default: true },
});

const toast = useToast();
const confirm = useConfirm();

const loading = ref(false);
const saving = ref(false);
const rows = ref([]);
const searchQuery = ref('');
const sortField = ref(null);
const sortOrder = ref(1);
const pagination = ref({ page: 1, pageSize: 25, total: 0, totalPages: 1 });

const dialogVisible = ref(false);
const dialogMode = ref('create');
const formData = ref({});
const fieldErrors = ref({});
const editingId = ref(null);

const formColumns = computed(() => props.columns.filter((c) => c.field !== '_compositeId'));

function enumOptions(key) {
  return props.enumOptionsMap[key] || [];
}

function isIdColumn(col) {
  return col.field === props.idField || col.field === 'orderId' || col.field === 'operationId';
}

function colStyle(col) {
  if (col.field === 'message' || col.field === 'materialDescription') return { minWidth: '14rem' };
  return { minWidth: '7rem' };
}

function formatCell(val) {
  if (val == null || val === '') return '—';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

function rowId(row) {
  return row[props.idField] ?? row._compositeId;
}

function emptyForm() {
  const obj = {};
  for (const col of formColumns.value) {
    if (col.type === 'boolean') obj[col.field] = false;
    else if (col.type === 'number') obj[col.field] = null;
    else obj[col.field] = '';
  }
  return obj;
}

async function loadData() {
  loading.value = true;
  try {
    const result = await adminDataApi.list(props.entitySlug, {
      search: searchQuery.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      sortField: sortField.value,
      sortOrder: sortOrder.value >= 0 ? 'asc' : 'desc',
    });
    rows.value = result.items.map((r) => ({
      ...r,
      rowKey: rowId(r),
    }));
    pagination.value = { ...pagination.value, ...result.pagination };
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Load failed', detail: err.message, life: 5000 });
  } finally {
    loading.value = false;
  }
}

function onPage(ev) {
  pagination.value.page = Math.floor(ev.first / ev.rows) + 1;
  pagination.value.pageSize = ev.rows;
  loadData();
}

function onSort(ev) {
  sortField.value = ev.sortField;
  sortOrder.value = ev.sortOrder;
  loadData();
}

function openCreate() {
  dialogMode.value = 'create';
  formData.value = emptyForm();
  fieldErrors.value = {};
  editingId.value = null;
  dialogVisible.value = true;
}

function openEdit(row) {
  dialogMode.value = 'edit';
  formData.value = { ...row };
  fieldErrors.value = {};
  editingId.value = rowId(row);
  dialogVisible.value = true;
}

function validateForm() {
  const errors = {};
  for (const col of formColumns.value) {
    if (!col.required) continue;
    const val = formData.value[col.field];
    if (val == null || val === '') errors[col.field] = 'Required';
    if (col.type === 'number' && col.required && (val == null || val <= 0) && col.field.includes('Quantity')) {
      errors[col.field] = 'Must be > 0';
    }
  }
  fieldErrors.value = errors;
  return Object.keys(errors).length === 0;
}

async function saveForm() {
  if (!validateForm()) return;
  saving.value = true;
  try {
    const payload = { ...formData.value };
    delete payload.rowKey;
    delete payload._compositeId;
    for (const col of formColumns.value) {
      if (col.type === 'date' && payload[col.field] instanceof Date) {
        payload[col.field] = payload[col.field].toISOString().slice(0, 10);
      }
    }

    if (dialogMode.value === 'create') {
      await adminDataApi.create(props.entitySlug, payload);
      toast.add({ severity: 'success', summary: 'Created', life: 3000 });
    } else {
      await adminDataApi.update(props.entitySlug, editingId.value, payload);
      toast.add({ severity: 'success', summary: 'Updated', life: 3000 });
    }
    dialogVisible.value = false;
    await loadData();
  } catch (err) {
    const detail = err.response?.data?.message || err.message;
    toast.add({ severity: 'error', summary: 'Save failed', detail, life: 6000 });
  } finally {
    saving.value = false;
  }
}

async function onCellEdit(ev) {
  const { data, newValue, field } = ev;
  const id = rowId(data);
  try {
    await adminDataApi.update(props.entitySlug, id, { [field]: newValue });
    toast.add({ severity: 'success', summary: 'Saved', detail: field, life: 2000 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Inline save failed', detail: err.message, life: 5000 });
    await loadData();
  }
}

function confirmDelete(row) {
  confirm.require({
    message: `Delete ${rowId(row)}?`,
    header: 'Confirm delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deleteRow(row),
  });
}

async function deleteRow(row) {
  try {
    await adminDataApi.delete(props.entitySlug, rowId(row));
    toast.add({ severity: 'success', summary: 'Deleted', life: 3000 });
    await loadData();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Delete failed', detail: err.message, life: 5000 });
  }
}

watch(() => props.entitySlug, () => {
  pagination.value.page = 1;
  searchQuery.value = '';
  sortField.value = null;
  loadData();
});

onMounted(loadData);
</script>

<style scoped>
.generic-crud__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-3);
}

.generic-crud__toolbar-left {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.generic-crud__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.generic-crud__count {
  font-size: var(--font-size-sm);
}

.generic-crud__toolbar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.generic-crud__search :deep(input) {
  min-width: 12rem;
}

.generic-crud__table-wrap {
  overflow: hidden;
}

.generic-crud__table :deep(.p-datatable-tbody > tr > td) {
  font-size: var(--font-size-sm);
  padding: 0.35rem 0.5rem;
}

.generic-crud__actions {
  display: flex;
  gap: 0.15rem;
}

.generic-crud__form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.generic-crud__form .form-field:nth-child(odd):last-child {
  grid-column: 1 / -1;
}

.required {
  color: var(--color-danger, #c0392b);
}

.field-error {
  color: var(--color-danger, #c0392b);
  display: block;
  margin-top: 0.2rem;
}

@media (max-width: 640px) {
  .generic-crud__form {
    grid-template-columns: 1fr;
  }
}
</style>
