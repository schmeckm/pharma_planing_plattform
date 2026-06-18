<template>
  <div>
    <p class="page-subtitle">Gate rules, validity windows, and per-rule SAP/REST integration configs</p>

    <RulesConfigurationHelp :rule-definitions="sortedDefinitions" />

    <div class="panel" style="margin-bottom: 20px">
      <div class="panel-header panel-header--actions">
        <h2>Planning Rule Definitions</h2>
        <el-button type="primary" size="small" @click="openCreate">New Rule</el-button>
      </div>
      <p class="panel-hint">
        Gate rules run in the allocation engine. Integration configs live in
        <code>data/rule-integrations/&lt;ruleId&gt;.json</code>.
      </p>
      <div class="panel-body panel-body--flush">
        <el-table :data="sortedDefinitions" stripe size="small">
          <el-table-column prop="ruleId" label="ID" width="100" />
          <el-table-column label="Name" width="150">
            <template #default="{ row }">{{ ruleLabel(row.ruleName) }}</template>
          </el-table-column>
          <el-table-column label="Type" width="120">
            <template #default="{ row }">{{ ruleTypeLabel(row.ruleType) }}</template>
          </el-table-column>
          <el-table-column prop="priority" label="Priority" width="70" />
          <el-table-column label="Valid" width="170">
            <template #default="{ row }">{{ formatValidity(row) }}</template>
          </el-table-column>
          <el-table-column label="Integration" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.hasIntegration" size="small" type="info">JSON</el-tag>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="Description" min-width="160" show-overflow-tooltip />
          <el-table-column label="Active" width="70">
            <template #default="{ row }">
              <el-tag :type="row.active !== false ? 'success' : 'info'" size="small">
                {{ row.active !== false ? 'Yes' : 'No' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="220" fixed="right">
            <template #default="{ row }">
              <template v-if="isGateRule(row)">
                <el-button link type="primary" size="small" @click="openEdit(row)">Edit</el-button>
                <el-button link type="primary" size="small" @click="openIntegration(row)">API</el-button>
                <el-button link type="danger" size="small" @click="confirmDelete(row)">Delete</el-button>
              </template>
              <span v-else class="muted">Selection phase</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><h2>Country Rules</h2></div>
      <div class="panel-body panel-body--flush">
        <el-table :data="rules.countryRules" stripe size="small">
          <el-table-column label="Country" width="180">
            <template #default="{ row }">{{ row.countryCode }} — {{ row.countryName }}</template>
          </el-table-column>
          <el-table-column label="Batch Split" width="120">
            <template #default="{ row }">
              <template v-if="editing === row.countryCode">
                <el-switch v-model="editForm.allowBatchSplit" />
              </template>
              <template v-else>{{ row.allowBatchSplit ? 'Allowed' : 'Not Allowed' }}</template>
            </template>
          </el-table-column>
          <el-table-column label="Shelf-Life (months)" width="130">
            <template #default="{ row }">
              <el-input-number
                v-if="editing === row.countryCode"
                v-model="editForm.rmslThresholdMonths"
                :min="1"
                :max="60"
                size="small"
              />
              <span v-else>{{ row.rmslThresholdMonths }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Market Release" width="80">
            <template #default="{ row }">
              <el-switch v-if="editing === row.countryCode" v-model="editForm.requiresTric" />
              <span v-else>{{ row.requiresTric ? 'Yes' : 'No' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Sequence" width="100">
            <template #default="{ row }">
              <el-switch v-if="editing === row.countryCode" v-model="editForm.requiresContinuousSequence" />
              <span v-else>{{ row.requiresContinuousSequence ? 'Yes' : 'No' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="140">
            <template #default="{ row }">
              <template v-if="editing === row.countryCode">
                <el-button link type="primary" size="small" @click="saveCountry(row.countryCode)">Save</el-button>
                <el-button link size="small" @click="editing = null">Cancel</el-button>
              </template>
              <el-button v-else link type="primary" size="small" @click="startCountryEdit(row)">Edit</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <el-dialog
      v-model="defDialogVisible"
      :title="defDialogMode === 'create' ? 'New Gate Rule' : `Edit ${defForm.ruleId}`"
      width="560px"
      destroy-on-close
    >
      <el-form label-width="120px" size="small">
        <el-form-item label="Name" required>
          <el-input v-model="defForm.ruleName" />
        </el-form-item>
        <el-form-item label="Type" required>
          <el-select v-model="defForm.ruleType" style="width: 100%">
            <el-option v-for="t in gateTypes" :key="t" :label="ruleTypeLabel(t)" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="Priority">
          <el-input-number v-model="defForm.priority" :min="1" :max="99" />
        </el-form-item>
        <el-form-item label="Valid from">
          <el-date-picker v-model="defForm.effectiveFrom" type="date" value-format="YYYY-MM-DD" clearable style="width: 100%" />
        </el-form-item>
        <el-form-item label="Valid to">
          <el-date-picker v-model="defForm.effectiveTo" type="date" value-format="YYYY-MM-DD" clearable style="width: 100%" />
        </el-form-item>
        <el-form-item label="Description">
          <el-input v-model="defForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="Active">
          <el-switch v-model="defForm.active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="defDialogVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="savingDef" @click="saveDefinition">Save</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="integrationDialogVisible"
      :title="`Integration — ${integrationRuleId}`"
      width="720px"
      destroy-on-close
    >
      <p class="panel-hint">
        Configure REST or SAP OData calls. Use <code v-pre>{{order.quantity}}</code> placeholders.
        Runtime mock uses <code>mockResponse</code>; set <code>HAP_INTEGRATION_LIVE=true</code> for live calls.
      </p>
      <el-input v-model="integrationJson" type="textarea" :rows="18" class="json-editor" />
      <div class="integration-actions">
        <el-button size="small" :loading="testingIntegration" @click="runIntegrationTest">Test Connection</el-button>
      </div>
      <pre v-if="integrationTestResult" class="test-result">{{ JSON.stringify(integrationTestResult, null, 2) }}</pre>
      <template #footer>
        <el-button @click="integrationDialogVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="savingIntegration" @click="saveIntegration">Save JSON</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  updateRules,
  createRuleDefinition,
  updateRuleDefinition,
  deleteRuleDefinition,
  fetchRuleIntegration,
  saveRuleIntegration,
  testRuleIntegration,
} from '@/api';
import { useOrdersStore } from '@/stores/orders';
import { ruleLabel, ruleTypeLabel } from '@/utils/plannerTerminology';
import { sortRuleDefinitions, isGateRuleType, GATE_PHASE_ORDER } from '@/utils/ruleDefinitions';
import RulesConfigurationHelp from '@/components/rules/RulesConfigurationHelp.vue';

const ordersStore = useOrdersStore();
const editing = ref(null);
const editForm = ref({});
const gateTypes = GATE_PHASE_ORDER;

const defDialogVisible = ref(false);
const defDialogMode = ref('create');
const savingDef = ref(false);
const defForm = ref(emptyDefForm());

const integrationDialogVisible = ref(false);
const integrationRuleId = ref('');
const integrationJson = ref('{}');
const savingIntegration = ref(false);
const testingIntegration = ref(false);
const integrationTestResult = ref(null);

const rules = computed(() => ordersStore.rules);
const sortedDefinitions = computed(() => sortRuleDefinitions(rules.value?.ruleDefinitions || []));

onMounted(() => ordersStore.loadRules());

function emptyDefForm() {
  return {
    ruleId: '',
    ruleName: '',
    ruleType: 'COMPLIANCE',
    priority: 10,
    effectiveFrom: null,
    effectiveTo: null,
    description: '',
    active: true,
  };
}

function isGateRule(row) {
  return isGateRuleType(row.ruleType);
}

function formatValidity(row) {
  const from = row.effectiveFrom || '—';
  const to = row.effectiveTo || 'open';
  return `${from} → ${to}`;
}

function startCountryEdit(row) {
  editing.value = row.countryCode;
  editForm.value = {
    allowBatchSplit: row.allowBatchSplit,
    rmslThresholdMonths: row.rmslThresholdMonths,
    requiresTric: row.requiresTric,
    requiresContinuousSequence: row.requiresContinuousSequence,
  };
}

function openCreate() {
  defDialogMode.value = 'create';
  defForm.value = emptyDefForm();
  defDialogVisible.value = true;
}

function openEdit(row) {
  defDialogMode.value = 'edit';
  defForm.value = {
    ruleId: row.ruleId,
    ruleName: row.ruleName,
    ruleType: row.ruleType,
    priority: row.priority ?? 10,
    effectiveFrom: row.effectiveFrom || null,
    effectiveTo: row.effectiveTo || null,
    description: row.description || '',
    active: row.active !== false,
  };
  defDialogVisible.value = true;
}

async function saveCountry(countryCode) {
  await updateRules({ countryCode, ...editForm.value });
  await ordersStore.loadRules();
  editing.value = null;
  ElMessage.success(`Rules updated for ${countryCode}`);
}

async function saveDefinition() {
  savingDef.value = true;
  try {
    const payload = { ...defForm.value };
    if (defDialogMode.value === 'create') {
      await createRuleDefinition(payload);
      ElMessage.success('Rule created');
    } else {
      await updateRuleDefinition(payload.ruleId, payload);
      ElMessage.success(`Rule ${payload.ruleId} updated`);
    }
    await ordersStore.loadRules();
    defDialogVisible.value = false;
  } finally {
    savingDef.value = false;
  }
}

async function confirmDelete(row) {
  await ElMessageBox.confirm(
    `Delete rule ${row.ruleId}? Integration JSON will also be removed.`,
    'Delete rule',
    { type: 'warning' },
  );
  await deleteRuleDefinition(row.ruleId);
  await ordersStore.loadRules();
  ElMessage.success(`Rule ${row.ruleId} deleted`);
}

async function openIntegration(row) {
  integrationRuleId.value = row.ruleId;
  integrationTestResult.value = null;
  const existing = await fetchRuleIntegration(row.ruleId);
  integrationJson.value = JSON.stringify(existing || defaultIntegration(row.ruleId), null, 2);
  integrationDialogVisible.value = true;
}

function defaultIntegration(ruleId) {
  return {
    ruleId,
    enabled: false,
    runtimeMode: 'mock',
    provider: 'rest',
    description: '',
    rest: {
      baseUrl: '',
      path: '/check',
      method: 'GET',
      headers: {},
      query: {},
      timeoutMs: 8000,
      passCondition: { type: 'jsonPath', path: 'passed', operator: '===', value: true },
    },
    sap: {
      baseUrl: '',
      odataService: '',
      entitySet: '',
      filter: '',
      timeoutMs: 8000,
      passCondition: { type: 'jsonPath', path: 'd.results[0].AvailableQty', operator: '>=', value: '{{order.quantity}}' },
    },
    mockResponse: { passed: true },
  };
}

async function saveIntegration() {
  savingIntegration.value = true;
  try {
    const parsed = JSON.parse(integrationJson.value);
    await saveRuleIntegration(integrationRuleId.value, parsed);
    await ordersStore.loadRules();
    ElMessage.success('Integration config saved');
    integrationDialogVisible.value = false;
  } catch (err) {
    ElMessage.error(err.message || 'Invalid JSON');
  } finally {
    savingIntegration.value = false;
  }
}

async function runIntegrationTest() {
  testingIntegration.value = true;
  integrationTestResult.value = null;
  try {
    const parsed = JSON.parse(integrationJson.value);
    await saveRuleIntegration(integrationRuleId.value, parsed);
    integrationTestResult.value = await testRuleIntegration(integrationRuleId.value, {});
    ElMessage.success('Test completed');
  } catch (err) {
    ElMessage.error(err.message || 'Test failed');
  } finally {
    testingIntegration.value = false;
  }
}
</script>

<style scoped>
.panel-body--flush { padding: 0; }
.panel-header--actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.panel-hint {
  margin: 0 16px 12px;
  font-size: 13px;
  color: var(--text-muted, #6b7280);
}
.muted {
  font-size: 12px;
  color: var(--text-muted, #9ca3af);
}
.json-editor :deep(textarea) {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.integration-actions {
  margin-top: 10px;
}
.test-result {
  margin-top: 12px;
  padding: 10px;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 11px;
  max-height: 180px;
  overflow: auto;
}
</style>
