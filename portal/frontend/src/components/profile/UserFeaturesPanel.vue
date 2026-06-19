<template>
  <div class="features-panel">
    <p class="muted features-panel__intro">{{ t('profile.featuresHint') }}</p>

    <div v-if="loading" class="features-panel__loading">{{ t('common.loading') }}</div>

    <template v-else-if="groups.length">
      <div class="features-panel__toolbar">
        <span class="features-panel__badge" :class="{ 'features-panel__badge--custom': usesCustom }">
          {{ usesCustom ? t('profile.featuresCustom') : t('profile.featuresRoleDefault') }}
        </span>
        <span class="features-panel__count">
          {{ t('profile.featuresSelectedCount', { count: optionalSelectedCount, total: optionalTotalCount }) }}
        </span>
        <div class="features-panel__actions">
          <button type="button" class="btn btn--ghost" @click="resetToRoleDefault">
            {{ t('profile.featuresResetDefault') }}
          </button>
          <button type="button" class="btn" :disabled="saving" @click="save">
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>

      <div v-for="group in groups" :key="group.id" class="features-panel__group">
        <div class="features-panel__group-head">
          <h3>{{ featureSectionLabel(group.titleKey) }}</h3>
          <button type="button" class="features-panel__section-toggle" @click="toggleSection(group, true)">
            {{ t('profile.featuresSectionAll') }}
          </button>
          <button type="button" class="features-panel__section-toggle" @click="toggleSection(group, false)">
            {{ t('profile.featuresSectionNone') }}
          </button>
        </div>

        <div class="features-panel__grid">
          <label v-for="feature in group.features" :key="feature.id" class="features-panel__item">
            <input
              type="checkbox"
              :checked="checkedIds.has(feature.id)"
              @change="toggleFeature(feature.id, $event.target.checked)"
            />
            <span>{{ featureLabel(feature.labelKey) }}</span>
          </label>
        </div>
      </div>
    </template>

    <p v-else class="muted">{{ t('profile.featuresEmpty') }}</p>

    <p v-if="saveMessage" class="features-panel__message">{{ saveMessage }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { t as cockpitT } from '../../../../../cockpit/src/i18n/index.js';
import { useAuthStore } from '../../stores/authStore';
import { useLocaleStore } from '../../stores/localeStore';

const { t } = useI18n();
const auth = useAuthStore();
const localeStore = useLocaleStore();

const loading = ref(true);
const saving = ref(false);
const saveMessage = ref('');
const groups = ref([]);
const defaultFeatureIds = ref([]);
const checkedIds = ref(new Set());
const usesCustom = ref(false);

const optionalFeatureIds = computed(() => {
  const ids = new Set();
  for (const group of groups.value) {
    for (const feature of group.features) {
      ids.add(feature.id);
    }
  }
  return ids;
});

const optionalSelectedCount = computed(() =>
  [...optionalFeatureIds.value].filter((id) => checkedIds.value.has(id)).length
);

const optionalTotalCount = computed(() => optionalFeatureIds.value.size);

function featureSectionLabel(titleKey) {
  return cockpitT(localeStore.locale, titleKey);
}

function featureLabel(labelKey) {
  return cockpitT(localeStore.locale, labelKey);
}

function applyProfile(profile) {
  groups.value = profile.groups || [];
  defaultFeatureIds.value = profile.defaultFeatureIds || [];
  usesCustom.value = profile.usesCustomFeatures === true;
  checkedIds.value = new Set(profile.enabledFeatureIds || []);
}

async function loadProfile() {
  loading.value = true;
  saveMessage.value = '';
  try {
    const profile = await auth.fetchFeatureProfile();
    applyProfile(profile);
  } catch {
    saveMessage.value = t('profile.featuresLoadError');
  } finally {
    loading.value = false;
  }
}

function toggleFeature(featureId, enabled) {
  const next = new Set(checkedIds.value);
  if (enabled) {
    next.add(featureId);
  } else {
    next.delete(featureId);
  }
  checkedIds.value = next;
}

function toggleSection(group, enabled) {
  const next = new Set(checkedIds.value);
  for (const feature of group.features) {
    if (enabled) {
      next.add(feature.id);
    } else {
      next.delete(feature.id);
    }
  }
  checkedIds.value = next;
}

function resetToRoleDefault() {
  checkedIds.value = new Set(defaultFeatureIds.value);
  usesCustom.value = false;
}

async function save() {
  saving.value = true;
  saveMessage.value = '';
  try {
    const selected = [...checkedIds.value].sort();
    const defaults = [...defaultFeatureIds.value].sort();
    const enabledFeatures =
      selected.length === defaults.length && selected.every((id, index) => id === defaults[index])
        ? null
        : selected;

    await auth.updateEnabledFeatures(enabledFeatures);
    const profile = await auth.fetchFeatureProfile();
    applyProfile(profile);
    saveMessage.value = t('profile.featuresSaved');
  } catch {
    saveMessage.value = t('profile.featuresSaveError');
  } finally {
    saving.value = false;
  }
}

onMounted(loadProfile);
</script>

<style scoped>
.features-panel__intro {
  margin-top: 0;
}

.features-panel__loading {
  padding: 0.5rem 0;
  color: var(--color-muted);
}

.features-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem 1rem;
  margin: 1rem 0 1.25rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.features-panel__badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(127, 127, 127, 0.12);
  color: var(--color-muted);
}

.features-panel__badge--custom {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.features-panel__count {
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.features-panel__actions {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.features-panel__group {
  margin-bottom: 1.25rem;
}

.features-panel__group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.65rem;
}

.features-panel__group-head h3 {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted);
}

.features-panel__section-toggle {
  border: none;
  background: transparent;
  color: var(--color-accent);
  font-size: 0.78rem;
  cursor: pointer;
  padding: 0;
}

.features-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.45rem 1rem;
}

.features-panel__item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.features-panel__item input {
  margin-top: 0.15rem;
}

.features-panel__message {
  margin: 0.85rem 0 0;
  color: var(--color-accent);
  font-size: 0.875rem;
}
</style>
