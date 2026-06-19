<template>
  <section class="page">
    <h1>{{ t('nav.dashboard') }}</h1>
    <p class="muted">{{ t('dashboard.welcome', { name: auth.user?.displayName || '' }) }}</p>

    <div class="kpi-grid">
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('dashboard.role') }}</p>
        <p class="kpi-card__value">{{ roleLabel }}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('dashboard.email') }}</p>
        <p class="kpi-card__value kpi-card__value--small">{{ auth.user?.email }}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-card__label">{{ t('dashboard.status') }}</p>
        <p class="kpi-card__value">{{ health.status }}</p>
      </article>
    </div>

    <div class="panel profile-panel">
      <div class="panel__header">
        <h2>{{ t('profile.title') }}</h2>
      </div>
      <div class="panel__body">
        <p class="muted profile-panel__intro">{{ t('profile.accentHint') }}</p>

        <div class="profile-panel__presets">
          <button
            v-for="preset in ACCENT_PRESETS"
            :key="preset.id"
            type="button"
            class="profile-panel__swatch"
            :class="{ 'profile-panel__swatch--active': theme.accentColor === preset.color }"
            :style="{ '--swatch-color': preset.color }"
            :title="t(preset.labelKey)"
            @click="selectPreset(preset.color)"
          >
            <span class="profile-panel__swatch-dot" />
            <span>{{ t(preset.labelKey) }}</span>
          </button>
        </div>

        <div class="profile-panel__custom">
          <label for="accent-color">{{ t('profile.customColor') }}</label>
          <div class="profile-panel__custom-row">
            <input id="accent-color" v-model="customColor" type="color" @change="saveCustomColor" />
            <input
              v-model="customColor"
              type="text"
              maxlength="7"
              spellcheck="false"
              @keyup.enter="saveCustomColor"
            />
            <button type="button" class="btn" :disabled="saving" @click="saveCustomColor">
              {{ saving ? t('common.saving') : t('common.save') }}
            </button>
          </div>
        </div>

        <p v-if="saveMessage" class="profile-panel__message">{{ saveMessage }}</p>
      </div>
    </div>

    <div class="panel profile-panel">
      <div class="panel__header">
        <h2>{{ t('profile.featuresTitle') }}</h2>
      </div>
      <div class="panel__body">
        <UserFeaturesPanel />
      </div>
    </div>

    <div class="panel">
      <div class="panel__header">
        <h2>{{ t('dashboard.placeholderTitle') }}</h2>
      </div>
      <div class="panel__body">
        <p class="muted">{{ t('dashboard.placeholder') }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/authStore';
import { useHealthStore } from '../stores/healthStore';
import { useThemeStore } from '../stores/themeStore';
import { ACCENT_PRESETS, normalizeAccentColor } from '../config/accentPresets';
import UserFeaturesPanel from '../components/profile/UserFeaturesPanel.vue';

const { t } = useI18n();
const auth = useAuthStore();
const health = useHealthStore();
const theme = useThemeStore();

const customColor = ref(theme.accentColor);
const saving = ref(false);
const saveMessage = ref('');

const roleLabel = computed(() =>
  auth.user?.role === 'admin' ? t('roles.admin') : t('roles.user')
);

watch(
  () => theme.accentColor,
  (value) => {
    customColor.value = value;
  }
);

onMounted(() => {
  health.fetchHealth();
  customColor.value = theme.accentColor;
});

async function persistColor(color) {
  saving.value = true;
  saveMessage.value = '';
  try {
    await auth.updateAccentColor(color);
    saveMessage.value = t('profile.accentSaved');
  } catch {
    saveMessage.value = t('profile.accentSaveError');
  } finally {
    saving.value = false;
  }
}

async function selectPreset(color) {
  customColor.value = color;
  await persistColor(color);
}

async function saveCustomColor() {
  const normalized = normalizeAccentColor(customColor.value);
  customColor.value = normalized;
  await persistColor(normalized);
}
</script>

<style scoped>
.kpi-card__value--small {
  font-size: 0.95rem;
  word-break: break-all;
}

.profile-panel__intro {
  margin-top: 0;
}

.profile-panel__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin: 1rem 0 1.25rem;
}

.profile-panel__swatch {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}

.profile-panel__swatch--active {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent-soft);
}

.profile-panel__swatch-dot {
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 50%;
  background: var(--swatch-color);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.profile-panel__custom {
  display: grid;
  gap: 0.5rem;
}

.profile-panel__custom label {
  font-size: 0.875rem;
  color: var(--color-muted);
}

.profile-panel__custom-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.profile-panel__custom-row input[type='color'] {
  width: 3rem;
  height: 2.5rem;
  padding: 0.15rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.profile-panel__custom-row input[type='text'] {
  min-width: 7rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: ui-monospace, monospace;
}

.profile-panel__message {
  margin: 0.85rem 0 0;
  color: var(--color-accent);
  font-size: 0.875rem;
}
</style>
