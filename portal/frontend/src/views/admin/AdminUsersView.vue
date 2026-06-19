<template>
  <section class="page">
    <h1>{{ t('admin.users.title') }}</h1>
    <p class="muted">{{ t('admin.users.subtitle') }}</p>

    <div v-if="error" class="alert alert--error">{{ error }}</div>
    <div v-if="success" class="alert alert--success">{{ success }}</div>

    <div class="panel">
      <div class="panel__header panel__header--toolbar">
        <h2>{{ t('admin.users.createTitle') }}</h2>
      </div>
      <div class="panel__body">
        <form class="create-form" @submit.prevent="createUser">
          <div class="form-grid">
            <div class="form-field">
              <label for="new-email">{{ t('auth.email') }}</label>
              <input id="new-email" v-model="createForm.email" type="email" required />
            </div>
            <div class="form-field">
              <label for="new-password">{{ t('auth.password') }}</label>
              <input id="new-password" v-model="createForm.password" type="password" required minlength="8" />
            </div>
            <div class="form-field">
              <label for="new-name">{{ t('admin.users.columns.name') }}</label>
              <input id="new-name" v-model="createForm.displayName" type="text" />
            </div>
            <div class="form-field">
              <label for="new-role">{{ t('admin.users.columns.role') }}</label>
              <select id="new-role" v-model="createForm.role" class="table-select">
                <option value="user">{{ t('roles.user') }}</option>
                <option value="admin">{{ t('roles.admin') }}</option>
              </select>
            </div>
            <div class="form-field">
              <label for="new-language">{{ t('admin.users.columns.language') }}</label>
              <select id="new-language" v-model="createForm.language" class="table-select">
                <option value="de">DE</option>
                <option value="en">EN</option>
              </select>
            </div>
          </div>
          <button class="btn" type="submit" :disabled="creating">
            {{ creating ? t('admin.users.creating') : t('admin.users.create') }}
          </button>
        </form>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header panel__header--toolbar">
        <h2>{{ t('admin.users.tableTitle') }}</h2>
        <button class="btn btn--ghost" type="button" :disabled="loading" @click="load">
          {{ t('common.refresh') }}
        </button>
      </div>
      <div class="panel__body panel__body--flush">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('admin.users.columns.name') }}</th>
              <th>{{ t('admin.users.columns.email') }}</th>
              <th>{{ t('admin.users.columns.role') }}</th>
              <th>{{ t('admin.users.columns.language') }}</th>
              <th>{{ t('admin.users.columns.verified') }}</th>
              <th>{{ t('admin.users.columns.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="data-table__empty">{{ t('common.loading') }}</td>
            </tr>
            <tr v-else-if="!users.length">
              <td colspan="6" class="data-table__empty">{{ t('admin.users.empty') }}</td>
            </tr>
            <tr v-for="user in users" :key="user.id">
              <td>
                <input v-model="drafts[user.id].displayName" class="table-input" type="text" />
              </td>
              <td>{{ user.email }}</td>
              <td>
                <select v-model="drafts[user.id].role" class="table-select">
                  <option value="user">{{ t('roles.user') }}</option>
                  <option value="admin">{{ t('roles.admin') }}</option>
                </select>
              </td>
              <td>
                <select v-model="drafts[user.id].language" class="table-select">
                  <option value="de">DE</option>
                  <option value="en">EN</option>
                </select>
              </td>
              <td>
                <StatusTag :variant="user.emailVerified ? 'success' : 'warning'">
                  {{ user.emailVerified ? t('common.yes') : t('common.no') }}
                </StatusTag>
              </td>
              <td class="actions-cell">
                <button
                  class="btn btn--ghost"
                  type="button"
                  :disabled="savingId === user.id || !isDirty(user)"
                  @click="save(user)"
                >
                  {{ savingId === user.id ? t('common.saving') : t('common.save') }}
                </button>
                <button
                  class="btn btn--ghost btn--danger"
                  type="button"
                  :disabled="deletingId === user.id || user.id === currentUserId"
                  @click="remove(user)"
                >
                  {{ deletingId === user.id ? t('admin.users.deleting') : t('admin.users.delete') }}
                </button>
              </td>
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
import { useAuthStore } from '../../stores/authStore';
import { adminApi } from '../../services/adminApi';
import StatusTag from '../../components/StatusTag.vue';

const { t } = useI18n();
const auth = useAuthStore();

const users = ref([]);
const drafts = reactive({});
const loading = ref(false);
const savingId = ref(null);
const deletingId = ref(null);
const creating = ref(false);
const error = ref('');
const success = ref('');

const createForm = reactive({
  email: '',
  password: '',
  displayName: '',
  role: 'user',
  language: 'de',
});

const currentUserId = computed(() => auth.user?.id);

function syncDrafts(list) {
  for (const user of list) {
    drafts[user.id] = {
      displayName: user.displayName || user.email,
      role: user.role,
      language: user.language || 'de',
    };
  }
}

function isDirty(user) {
  const draft = drafts[user.id];
  return (
    draft.displayName !== (user.displayName || user.email) ||
    draft.role !== user.role ||
    draft.language !== (user.language || 'de')
  );
}

function resetCreateForm() {
  createForm.email = '';
  createForm.password = '';
  createForm.displayName = '';
  createForm.role = 'user';
  createForm.language = 'de';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await adminApi.getUsers();
    users.value = data.users;
    syncDrafts(data.users);
  } catch (err) {
    error.value = err.response?.data?.error || t('admin.users.loadError');
  } finally {
    loading.value = false;
  }
}

async function createUser() {
  creating.value = true;
  error.value = '';
  success.value = '';
  try {
    await adminApi.createUser({ ...createForm });
    success.value = t('admin.users.createSuccess');
    resetCreateForm();
    await load();
  } catch (err) {
    error.value = err.response?.data?.error || t('admin.users.createError');
  } finally {
    creating.value = false;
  }
}

async function save(user) {
  savingId.value = user.id;
  error.value = '';
  success.value = '';
  try {
    const draft = drafts[user.id];
    const { data } = await adminApi.updateUser(user.id, draft);
    const index = users.value.findIndex((entry) => entry.id === user.id);
    if (index >= 0) users.value[index] = data.user;
    syncDrafts(users.value);
    success.value = t('admin.users.saveSuccess');
  } catch (err) {
    error.value = err.response?.data?.error || t('admin.users.saveError');
  } finally {
    savingId.value = null;
  }
}

async function remove(user) {
  if (!window.confirm(t('admin.users.deleteConfirm', { email: user.email }))) {
    return;
  }

  deletingId.value = user.id;
  error.value = '';
  success.value = '';
  try {
    await adminApi.deleteUser(user.id);
    success.value = t('admin.users.deleteSuccess');
    await load();
  } catch (err) {
    error.value = err.response?.data?.error || t('admin.users.deleteError');
  } finally {
    deletingId.value = null;
  }
}

onMounted(load);
</script>

<style scoped>
.create-form {
  display: grid;
  gap: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem 1rem;
}

.actions-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
</style>
