<template>
  <div class="user-features">
    <div class="panel-header">
      <div>
        <h2>{{ t('admin.userFeatures.title') }}</h2>
        <p class="hint">{{ t('admin.userFeatures.subtitle') }}</p>
      </div>
      <div class="panel-header__actions">
        <el-select
          v-model="selectedUserId"
          filterable
          :placeholder="t('admin.userFeatures.selectUser')"
          class="user-select"
          @change="onUserChange"
        >
          <el-option
            v-for="u in users"
            :key="u.userId"
            :label="`${u.displayName} (${u.role})`"
            :value="u.userId"
          />
        </el-select>
      </div>
    </div>

    <div v-if="selectedUser" class="panel-body">
      <div class="user-features__master">
        <el-checkbox
          :model-value="allSelected"
          :indeterminate="someSelected && !allSelected"
          @change="toggleMaster"
        >
          {{ t('admin.userFeatures.toggleAll') }}
        </el-checkbox>
        <span class="master-count">{{ t('admin.userFeatures.selectedCount', { count: checkedIds.length, total: allowedFeatureIds.length }) }}</span>
        <div class="user-features__master-actions">
          <el-button size="small" type="success" plain @click="selectAll">
            {{ t('admin.userFeatures.allOn') }}
          </el-button>
          <el-button size="small" type="danger" plain @click="deselectAll">
            {{ t('admin.userFeatures.allOff') }}
          </el-button>
        </div>
      </div>

      <div class="user-features__toolbar">
        <el-tag size="small" effect="plain">{{ selectedUser.role }}</el-tag>
        <el-tag v-if="selectedUser.usesCustomFeatures" size="small" type="warning">
          {{ t('admin.userFeatures.customProfile') }}
        </el-tag>
        <el-tag v-else size="small" type="info">
          {{ t('admin.userFeatures.roleDefault') }}
        </el-tag>
        <div class="user-features__toolbar-actions">
          <el-button size="small" @click="selectAllForRole">{{ t('admin.userFeatures.selectRoleDefault') }}</el-button>
          <el-button size="small" @click="clearAll">{{ t('admin.userFeatures.clearAll') }}</el-button>
          <el-button type="primary" size="small" :loading="saving" @click="save">
            {{ t('admin.userFeatures.save') }}
          </el-button>
        </div>
      </div>

      <div v-loading="loading" class="user-features__sections">
        <div v-for="(features, sectionId) in groupedFeatures" :key="sectionId" class="feature-section">
          <div class="feature-section__head">
            <h3>{{ sectionLabel(sectionId) }}</h3>
            <el-checkbox
              :model-value="isSectionAllSelected(features)"
              :indeterminate="isSectionIndeterminate(features)"
              @change="(val) => toggleSection(features, val)"
            >
              {{ t('admin.userFeatures.sectionToggle') }}
            </el-checkbox>
          </div>
          <el-checkbox-group v-model="checkedIds" class="feature-section__grid">
            <el-checkbox
              v-for="feature in features"
              :key="feature.id"
              :value="feature.id"
              :disabled="!isAllowedForRole(feature)"
            >
              {{ featureLabel(feature) }}
              <span v-if="feature.permission" class="feature-perm">{{ feature.permission }}</span>
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { apiV2 } from '@/api/v2';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from '@/composables/useI18n';
import { groupFeaturesBySection, FEATURE_SECTION_KEYS } from '@/config/features';

const auth = useAuthStore();
const { t } = useI18n();

const users = ref([]);
const catalogFeatures = ref([]);
const selectedUserId = ref('');
const checkedIds = ref([]);
const roleDefaultIds = ref([]);
const loading = ref(false);
const saving = ref(false);
const useCustom = ref(false);

const selectedUser = computed(() => users.value.find((u) => u.userId === selectedUserId.value) || null);

const groupedFeatures = computed(() => groupFeaturesBySection(catalogFeatures.value));

const allowedFeatureIds = computed(() =>
  catalogFeatures.value.filter((f) => isAllowedForRole(f)).map((f) => f.id),
);

const allSelected = computed(() => {
  const allowed = allowedFeatureIds.value;
  return allowed.length > 0 && allowed.every((id) => checkedIds.value.includes(id));
});

const someSelected = computed(() =>
  allowedFeatureIds.value.some((id) => checkedIds.value.includes(id)),
);

function sectionLabel(sectionId) {
  const key = FEATURE_SECTION_KEYS[sectionId];
  return key ? t(key) : sectionId;
}

function featureLabel(feature) {
  return t(feature.labelKey);
}

function isAllowedForRole(feature) {
  if (!selectedUser.value) return false;
  if (selectedUser.value.role === 'ADMIN') return true;
  if (!feature.permission) return true;
  const perms = selectedUser.value.permissions || [];
  return perms.includes('*') || perms.includes(feature.permission);
}

async function loadCatalog() {
  const catalog = await apiV2.getFeatureCatalog();
  catalogFeatures.value = catalog.features || [];
}

async function loadUsers() {
  const data = await apiV2.getUsers();
  users.value = data.items || [];
  if (!selectedUserId.value && users.value.length) {
    selectedUserId.value = users.value[0].userId;
    await onUserChange();
  }
}

async function loadRoleDefaults(role) {
  const data = await apiV2.getRoleDefaultFeatures(role);
  roleDefaultIds.value = data.featureIds || [];
}

function applyUserSelection(user) {
  useCustom.value = user.usesCustomFeatures === true;
  if (Array.isArray(user.enabledFeatures)) {
    checkedIds.value = [...user.enabledFeatures];
    return;
  }
  checkedIds.value = [...(user.enabledFeatureIds || roleDefaultIds.value)];
}

async function onUserChange() {
  const user = selectedUser.value;
  if (!user) return;
  loading.value = true;
  try {
    await loadRoleDefaults(user.role);
    applyUserSelection(user);
  } finally {
    loading.value = false;
  }
}

function selectAll() {
  checkedIds.value = [...allowedFeatureIds.value];
}

function deselectAll() {
  checkedIds.value = [];
}

function toggleMaster(checked) {
  if (checked) selectAll();
  else deselectAll();
}

function isSectionAllSelected(features) {
  const allowed = features.filter((f) => isAllowedForRole(f)).map((f) => f.id);
  return allowed.length > 0 && allowed.every((id) => checkedIds.value.includes(id));
}

function isSectionIndeterminate(features) {
  const allowed = features.filter((f) => isAllowedForRole(f)).map((f) => f.id);
  const selected = allowed.filter((id) => checkedIds.value.includes(id));
  return selected.length > 0 && selected.length < allowed.length;
}

function toggleSection(features, checked) {
  const allowed = features.filter((f) => isAllowedForRole(f)).map((f) => f.id);
  const set = new Set(checkedIds.value);
  if (checked) {
    for (const id of allowed) set.add(id);
  } else {
    for (const id of allowed) set.delete(id);
  }
  checkedIds.value = [...set];
}

function selectAllForRole() {
  checkedIds.value = [...roleDefaultIds.value];
  useCustom.value = false;
}

function clearAll() {
  checkedIds.value = ['daily-wizard', 'help'].filter((id) =>
    catalogFeatures.value.some((f) => f.id === id && isAllowedForRole(f)),
  );
}

async function save() {
  if (!selectedUser.value) return;
  saving.value = true;
  try {
    const roleDefaults = roleDefaultIds.value.slice().sort().join(',');
    const selected = checkedIds.value.slice().sort().join(',');
    const enabledFeatures = roleDefaults === selected ? null : [...checkedIds.value];

    const updated = await apiV2.updateUserFeatures(selectedUser.value.userId, enabledFeatures);
    const idx = users.value.findIndex((u) => u.userId === updated.userId);
    if (idx >= 0) users.value[idx] = updated;

    if (auth.user?.userId === updated.userId) {
      auth.setUserSession({ ...auth.user, ...updated });
    }

    applyUserSelection(updated);
    ElMessage.success(t('admin.userFeatures.saved'));
  } catch (err) {
    ElMessage.error(err.message || t('admin.userFeatures.saveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([loadCatalog(), loadUsers()]);
  } catch (err) {
    ElMessage.error(err.message || t('admin.userFeatures.loadFailed'));
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.user-features {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.panel-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 0;
}

.panel-header h2 {
  margin: 0 0 4px;
}

.panel-body {
  padding: 12px 16px 16px;
}

.hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.user-select {
  min-width: 260px;
}

.user-features__master {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 12px 14px;
  margin-bottom: 12px;
  background: var(--color-bg-muted, #f5f7fa);
  border: 1px solid var(--color-border, #e4e7ed);
  border-radius: 8px;
}

.user-features__master-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.master-count {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.feature-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.feature-section__head h3 {
  margin: 0;
}

.user-features__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.user-features__toolbar-actions {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.user-features__sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feature-section__head h3 {
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.feature-section h3 {
  margin: 0 0 8px;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.feature-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 6px 16px;
}

.feature-perm {
  margin-left: 6px;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .user-features__toolbar-actions {
    margin-left: 0;
    width: 100%;
  }
}
</style>
