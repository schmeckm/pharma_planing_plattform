<template>

  <div class="v2-page">

    <p class="page-subtitle">Versioned, effective-dated, auditable allocation rules — editable by category</p>



    <div class="toolbar">

      <Button v-if="canWrite" label="New Rule" icon="pi pi-plus" @click="openCreate" />

      <Button label="Export Rules" icon="pi pi-download" severity="secondary" @click="exportRules" />

      <Select v-model="categoryFilter" :options="categoryOptions" optionLabel="label" optionValue="value" placeholder="All Categories" showClear class="w-14rem" />

    </div>



    <DataTable :value="rules" stripedRows size="small" paginator :rows="10" :loading="loading" @row-click="selectRule">

      <Column field="ruleId" header="Rule ID" sortable />

      <Column field="category" header="Category" sortable />

      <Column field="name" header="Name" sortable />

      <Column field="version" header="Ver." />

      <Column field="effectiveFrom" header="Effective From" />

      <Column field="effectiveTo" header="Effective To">

        <template #body="{ data }">{{ data.effectiveTo || '—' }}</template>

      </Column>

      <Column header="Active">

        <template #body="{ data }">

          <Tag :severity="data.active ? 'success' : 'secondary'" :value="data.active ? 'Yes' : 'No'" />

        </template>

      </Column>

      <Column header="Actions" v-if="canWrite">

        <template #body="{ data }">

          <Button icon="pi pi-pencil" text size="small" @click.stop="openEdit(data)" />

        </template>

      </Column>

    </DataTable>



    <div class="panels" v-if="selectedRule || auditLog.length">

      <Card v-if="selectedRule" class="detail-panel">

        <template #title>{{ selectedRule.ruleId }} — Version History</template>

        <template #content>

          <DataTable :value="versions" size="small" v-if="versions.length">

            <Column field="version" header="Version" />

            <Column field="effectiveFrom" header="Effective From" />

            <Column field="changeNotes" header="Change Notes" />

            <Column field="createdBy" header="By" />

          </DataTable>

          <p v-else class="muted">No prior versions recorded.</p>

        </template>

      </Card>



      <Card class="detail-panel">

        <template #title>Audit Trail</template>

        <template #content>

          <DataTable :value="auditLog" size="small" :rows="5" paginator>

            <Column field="timestamp" header="When" />

            <Column field="action" header="Action" />

            <Column field="ruleId" header="Rule" />

            <Column field="userId" header="User" />

          </DataTable>

        </template>

      </Card>

    </div>



    <Dialog v-model:visible="dialogVisible" :header="editing ? 'Edit Rule' : 'Create Rule'" modal class="rule-dialog">

      <div class="form-grid">

        <div class="field">

          <label>Category</label>

          <Select v-model="form.category" :options="categories" :disabled="editing" class="w-full" />

        </div>

        <div class="field">

          <label>Name</label>

          <InputText v-model="form.name" class="w-full" />

        </div>

        <div class="field">

          <label>Effective From</label>

          <InputText v-model="form.effectiveFrom" type="date" class="w-full" />

        </div>

        <div class="field">

          <label>Effective To</label>

          <InputText v-model="form.effectiveTo" type="date" class="w-full" placeholder="Optional" />

        </div>

        <div class="field full">

          <label>Scope (JSON)</label>

          <Textarea v-model="form.scopeJson" rows="3" class="w-full" />

        </div>

        <div class="field full">

          <label>Parameters (JSON)</label>

          <Textarea v-model="form.parametersJson" rows="4" class="w-full" />

        </div>

        <div class="field full" v-if="editing">

          <label>Change Notes</label>

          <InputText v-model="form.changeNotes" class="w-full" />

        </div>

        <div class="field">

          <label>Active</label>

          <ToggleSwitch v-model="form.active" />

        </div>

      </div>

      <template #footer>

        <Button label="Cancel" severity="secondary" @click="dialogVisible = false" />

        <Button label="Save" icon="pi pi-check" @click="saveRule" :loading="saving" />

      </template>

    </Dialog>

  </div>

</template>



<script setup>

import { ref, computed, onMounted, watch } from 'vue';

import DataTable from 'primevue/datatable';

import Column from 'primevue/column';

import Button from 'primevue/button';

import Select from 'primevue/select';

import Tag from 'primevue/tag';

import Card from 'primevue/card';

import Dialog from 'primevue/dialog';

import InputText from 'primevue/inputtext';

import Textarea from 'primevue/textarea';

import ToggleSwitch from 'primevue/toggleswitch';

import { apiV2 } from '@/api/v2';

import { useAuthStore } from '@/stores/auth';



const auth = useAuthStore();

const rules = ref([]);

const categories = ref([]);

const auditLog = ref([]);

const categoryFilter = ref(null);

const loading = ref(false);

const saving = ref(false);

const dialogVisible = ref(false);

const editing = ref(false);

const selectedRule = ref(null);

const versions = ref([]);



const canWrite = computed(() => auth.hasPermission('rules:write'));



const categoryOptions = computed(() => [

  { label: 'All Categories', value: null },

  ...categories.value.map((c) => ({ label: c, value: c })),

]);



const defaultForm = () => ({

  ruleId: null,

  category: 'COUNTRY',

  name: '',

  effectiveFrom: new Date().toISOString().slice(0, 10),

  effectiveTo: '',

  scopeJson: '{}',

  parametersJson: '{}',

  changeNotes: '',

  active: true,

});



const form = ref(defaultForm());



async function load() {

  loading.value = true;

  try {

    const params = categoryFilter.value ? { category: categoryFilter.value } : {};

    const data = await apiV2.getRules(params);

    rules.value = data.rules || [];

    categories.value = data.categories || [];

    auditLog.value = data.auditLog || [];

  } finally {

    loading.value = false;

  }

}



async function selectRule(e) {

  selectedRule.value = e.data;

  const detail = await apiV2.getRule(e.data.ruleId);

  versions.value = detail.versions || [];

}



function openCreate() {

  editing.value = false;

  form.value = defaultForm();

  dialogVisible.value = true;

}



function openEdit(rule) {

  editing.value = true;

  form.value = {

    ruleId: rule.ruleId,

    category: rule.category,

    name: rule.name,

    effectiveFrom: rule.effectiveFrom,

    effectiveTo: rule.effectiveTo || '',

    scopeJson: JSON.stringify(rule.scope || {}, null, 2),

    parametersJson: JSON.stringify(rule.parameters || {}, null, 2),

    changeNotes: '',

    active: rule.active !== false,

  };

  dialogVisible.value = true;

}



async function saveRule() {

  saving.value = true;

  try {

    const payload = {

      category: form.value.category,

      name: form.value.name,

      effectiveFrom: form.value.effectiveFrom,

      effectiveTo: form.value.effectiveTo || null,

      scope: JSON.parse(form.value.scopeJson),

      parameters: JSON.parse(form.value.parametersJson),

      active: form.value.active,

      changeNotes: form.value.changeNotes,

    };

    if (editing.value) {

      await apiV2.updateRule(form.value.ruleId, payload);

    } else {

      await apiV2.createRule(payload);

    }

    dialogVisible.value = false;

    await load();

  } finally {

    saving.value = false;

  }

}



async function exportRules() {

  const data = await apiV2.exportRules();

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;

  a.download = 'rules-export.json';

  a.click();

}



watch(categoryFilter, load);

onMounted(load);

</script>



<style scoped>

.toolbar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }

.w-14rem { width: 14rem; }

.panels { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.field { display: flex; flex-direction: column; gap: 4px; }

.field.full { grid-column: 1 / -1; }

.field label { font-size: 0.8125rem; font-weight: 600; }

.w-full { width: 100%; }

.muted { color: var(--color-text-muted); font-size: 0.875rem; }

@media (max-width: 900px) { .panels { grid-template-columns: 1fr; } }

</style>

