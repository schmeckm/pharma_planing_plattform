<template>
  <section class="page">
    <h1>{{ t('admin.system.title') }}</h1>
    <p class="muted">{{ t('admin.system.subtitle') }}</p>

    <div v-if="error" class="alert alert--error">{{ error }}</div>
    <div v-if="success" class="alert alert--success">{{ success }}</div>

    <div class="kpi-grid">
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('admin.system.version') }}</p>
        <p class="kpi-card__value kpi-card__value--small">{{ system?.version || '—' }}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('admin.system.environment') }}</p>
        <p class="kpi-card__value kpi-card__value--small">{{ system?.nodeEnv || '—' }}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('admin.system.uptime') }}</p>
        <p class="kpi-card__value kpi-card__value--small">{{ uptimeLabel }}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('admin.system.health') }}</p>
        <p class="kpi-card__value kpi-card__value--small">{{ system?.health?.status || '—' }}</p>
      </article>
    </div>

    <div class="panel-grid">
      <div class="panel">
        <div class="panel__header">
          <h2>{{ t('admin.system.settingsTitle') }}</h2>
        </div>
        <div class="panel__body">
          <label class="toggle-row">
            <input v-model="settings['system.maintenanceMode']" type="checkbox" />
            <span>{{ t('admin.system.maintenanceMode') }}</span>
          </label>
          <label class="toggle-row">
            <input v-model="settings['system.registrationEnabled']" type="checkbox" />
            <span>{{ t('admin.system.registrationEnabled') }}</span>
          </label>
          <label class="toggle-row">
            <input v-model="settings['email.digestEnabled']" type="checkbox" />
            <span>{{ t('admin.system.digestEnabled') }}</span>
          </label>
          <label class="toggle-row">
            <input v-model="settings['email.remindersEnabled']" type="checkbox" />
            <span>{{ t('admin.system.remindersEnabled') }}</span>
          </label>
          <button class="btn" type="button" :disabled="saving" @click="saveSettings">
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="panel__header">
          <h2>{{ t('admin.system.featuresTitle') }}</h2>
        </div>
        <div class="panel__body">
          <ul class="feature-list">
            <li v-for="item in featureItems" :key="item.key">
              <StatusTag :variant="item.enabled ? 'success' : 'warning'">
                {{ item.enabled ? t('common.enabled') : t('common.disabled') }}
              </StatusTag>
              <span>{{ item.label }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header panel__header--toolbar">
        <h2>{{ t('admin.system.servicesTitle') }}</h2>
        <button class="btn btn--ghost" type="button" :disabled="loading" @click="load">
          {{ t('common.refresh') }}
        </button>
      </div>
      <div class="panel__body panel__body--flush">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('admin.system.service') }}</th>
              <th>{{ t('admin.system.status') }}</th>
              <th>{{ t('admin.system.latency') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="service in system?.health?.services || []" :key="service.id">
              <td>{{ service.label }}</td>
              <td>{{ service.status }}</td>
              <td>{{ service.latencyMs != null ? `${service.latencyMs} ms` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { adminApi } from '../../services/adminApi';
import StatusTag from '../../components/StatusTag.vue';

const { t } = useI18n();

const system = ref(null);
const settings = reactive({
  'system.maintenanceMode': false,
  'system.registrationEnabled': true,
  'email.digestEnabled': true,
  'email.remindersEnabled': true,
});
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');

const uptimeLabel = computed(() => {
  const seconds = system.value?.uptimeSeconds;
  if (seconds == null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
});

const featureItems = computed(() => {
  const features = system.value?.features || {};
  return [
    { key: 'googleSso', label: 'Google SSO', enabled: features.googleSso },
    { key: 'llm', label: 'LLM', enabled: features.llm },
    { key: 'saas', label: 'SaaS', enabled: features.saas },
    { key: 'sentry', label: 'Sentry', enabled: features.sentry },
    { key: 'redis', label: 'Redis', enabled: features.redis },
  ];
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await adminApi.getSystem();
    system.value = data;
    Object.assign(settings, data.settings || {});
  } catch (err) {
    error.value = err.response?.data?.error || t('admin.system.loadError');
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await adminApi.updateSettings({ ...settings });
    success.value = t('admin.system.saveSuccess');
    await load();
  } catch (err) {
    error.value = err.response?.data?.error || t('admin.system.saveError');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
