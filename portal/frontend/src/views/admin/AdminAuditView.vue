<template>
  <section class="page">
    <h1>{{ t('admin.audit.title') }}</h1>
    <p class="muted">{{ t('admin.audit.subtitle') }}</p>

    <div v-if="error" class="alert alert--error">{{ error }}</div>

    <div class="panel">
      <div class="panel__header">
        <h2>{{ t('admin.audit.filtersTitle') }}</h2>
      </div>
      <div class="panel__body">
        <div class="filter-grid">
          <div class="form-field">
            <label for="audit-action">{{ t('admin.audit.filters.action') }}</label>
            <select id="audit-action" v-model="filters.action" class="table-select">
              <option value="">{{ t('admin.audit.filters.allActions') }}</option>
              <option v-for="action in actions" :key="action" :value="action">
                {{ action }}
              </option>
            </select>
          </div>
          <div class="form-field">
            <label for="audit-from">{{ t('admin.audit.filters.from') }}</label>
            <input id="audit-from" v-model="filters.from" type="date" class="table-input" />
          </div>
          <div class="form-field">
            <label for="audit-to">{{ t('admin.audit.filters.to') }}</label>
            <input id="audit-to" v-model="filters.to" type="date" class="table-input" />
          </div>
        </div>
        <div class="filter-actions">
          <button class="btn" type="button" :disabled="loading" @click="applyFilters">
            {{ t('admin.audit.applyFilters') }}
          </button>
          <button class="btn btn--ghost" type="button" :disabled="loading" @click="resetFilters">
            {{ t('admin.audit.resetFilters') }}
          </button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header panel__header--toolbar">
        <h2>{{ t('admin.audit.tableTitle') }}</h2>
        <span class="muted">{{ t('admin.audit.resultCount', { count: total }) }}</span>
      </div>
      <div class="panel__body panel__body--flush">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('admin.audit.columns.time') }}</th>
              <th>{{ t('admin.audit.columns.user') }}</th>
              <th>{{ t('admin.audit.columns.action') }}</th>
              <th>{{ t('admin.audit.columns.entity') }}</th>
              <th>{{ t('admin.audit.columns.details') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="data-table__empty">{{ t('common.loading') }}</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="5" class="data-table__empty">{{ t('admin.audit.empty') }}</td>
            </tr>
            <tr v-for="entry in items" :key="entry.id">
              <td>{{ formatDate(entry.createdAt) }}</td>
              <td>{{ entry.user?.displayName || entry.user?.email || '—' }}</td>
              <td><code>{{ entry.action }}</code></td>
              <td>{{ formatEntity(entry) }}</td>
              <td class="data-table__meta">{{ formatMetadata(entry.metadata) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { adminApi } from '../../services/adminApi';

const { t } = useI18n();

const items = ref([]);
const actions = ref([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');

const filters = reactive({
  action: '',
  from: '',
  to: '',
});

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function formatEntity(entry) {
  if (!entry.entityType) return '—';
  return entry.entityId ? `${entry.entityType} #${entry.entityId}` : entry.entityType;
}

function formatMetadata(metadata) {
  if (!metadata || !Object.keys(metadata).length) return '—';
  return JSON.stringify(metadata);
}

function buildParams() {
  const params = { limit: 100 };
  if (filters.action) params.action = filters.action;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  return params;
}

async function loadActions() {
  try {
    const { data } = await adminApi.getAuditActions();
    actions.value = data.actions || [];
  } catch {
    actions.value = [];
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await adminApi.getAudit(buildParams());
    items.value = data.items;
    total.value = data.total;
  } catch (err) {
    error.value = err.response?.data?.error || t('admin.audit.loadError');
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  load();
}

function resetFilters() {
  filters.action = '';
  filters.from = '';
  filters.to = '';
  load();
}

onMounted(async () => {
  await loadActions();
  await load();
});
</script>

<style scoped>
.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem 1rem;
}

.filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
