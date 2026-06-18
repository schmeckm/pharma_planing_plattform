<template>
  <section class="page">
    <h1>{{ t('admin.email.title') }}</h1>
    <p class="muted">{{ t('admin.email.subtitle') }}</p>

    <div v-if="error" class="alert alert--error">{{ error }}</div>
    <div v-if="success" class="alert alert--success">{{ success }}</div>

    <div class="kpi-grid">
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('admin.email.status') }}</p>
        <p class="kpi-card__value kpi-card__value--small">
          {{ status?.configured ? t('admin.email.configured') : t('admin.email.notConfigured') }}
        </p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('admin.email.from') }}</p>
        <p class="kpi-card__value kpi-card__value--small">{{ status?.from || '—' }}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('admin.email.host') }}</p>
        <p class="kpi-card__value kpi-card__value--small">{{ status?.host || '—' }}</p>
      </article>
    </div>

    <div class="panel">
      <div class="panel__header">
        <h2>{{ t('admin.email.testTitle') }}</h2>
      </div>
      <div class="panel__body">
        <div class="form-field">
          <label for="test-email">{{ t('admin.email.testRecipient') }}</label>
          <input id="test-email" v-model="recipient" type="email" />
        </div>
        <button class="btn" type="button" :disabled="sending || !recipient" @click="sendTest">
          {{ sending ? t('admin.email.sending') : t('admin.email.sendTest') }}
        </button>
        <p class="muted hint">{{ t('admin.email.hint') }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../../stores/authStore';
import { adminApi } from '../../services/adminApi';

const { t } = useI18n();
const auth = useAuthStore();

const status = ref(null);
const recipient = ref(auth.user?.email || '');
const sending = ref(false);
const error = ref('');
const success = ref('');

async function load() {
  error.value = '';
  try {
    const { data } = await adminApi.getEmailStatus();
    status.value = data;
  } catch (err) {
    error.value = err.response?.data?.error || t('admin.email.loadError');
  }
}

async function sendTest() {
  sending.value = true;
  error.value = '';
  success.value = '';
  try {
    const { data } = await adminApi.sendTestEmail(recipient.value);
    success.value = t('admin.email.sendSuccess', { accepted: (data.accepted || []).join(', ') });
    await load();
  } catch (err) {
    error.value = err.response?.data?.error || t('admin.email.sendError');
  } finally {
    sending.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.hint {
  margin-top: 1rem;
  font-size: 0.85rem;
}
</style>
