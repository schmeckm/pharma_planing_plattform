<template>
  <div class="planning-horizon-bar panel">
    <div class="panel-header">
      <div class="title-row">
        <h2>Planning horizon</h2>
        <button
          type="button"
          class="info-btn"
          :title="oeeTooltip"
          aria-label="OEE note"
        >
          <i class="pi pi-info-circle" />
        </button>
      </div>
      <span class="horizon-preview">{{ previewLabel }}</span>
    </div>
    <div class="panel-body horizon-fields">
      <div class="horizon-field">
        <span>Quick select</span>
        <SelectButton
          v-model="selectedPreset"
          :options="presetOptions"
          option-label="label"
          option-value="value"
          :disabled="store.loading"
          @change="onPresetChange"
        />
      </div>
      <label class="horizon-field horizon-field-custom">
        <span>Custom days</span>
        <InputNumber
          v-model="localHorizon"
          :min="store.horizonDaysMin"
          :max="store.horizonDaysMax"
          show-buttons
          :disabled="store.loading"
          @blur="applyCustomHorizon"
        />
      </label>
      <label class="horizon-field">
        <span>Planning start</span>
        <div class="start-row">
          <input
            v-model="localStart"
            type="date"
            class="date-input"
            :disabled="autoStart || store.loading"
            @change="applyStart"
          />
          <Checkbox v-model="autoStart" binary input-id="horizon-auto-start" @change="toggleAutoStart" />
          <label for="horizon-auto-start" class="auto-label">Auto (rough plan)</label>
        </div>
      </label>
      <Button
        label="Recalculate"
        icon="pi pi-sync"
        :loading="store.loading"
        @click="recalculate"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputNumber from 'primevue/inputnumber';
import SelectButton from 'primevue/selectbutton';
import { useDailyPlanningStore } from '@/stores/dailyPlanning';
import { useHorizonSettingsStore } from '@/stores/horizonSettings';
import { addDays } from '@/utils/dateHelpers';

const emit = defineEmits(['recalculate']);

const PRESET_DAYS = [7, 14, 28];

const store = useDailyPlanningStore();
const horizonSettings = useHorizonSettingsStore();

const presetOptions = [
  { label: '1 week', value: 7 },
  { label: '2 weeks', value: 14 },
  { label: '4 weeks', value: 28 },
];

const localHorizon = ref(store.horizonDays);
const localStart = ref(store.effectivePlanningStart);
const autoStart = ref(!store.planningStartAnchorOverride);
const selectedPreset = ref(
  PRESET_DAYS.includes(store.horizonDays) ? store.horizonDays : null,
);

onMounted(() => {
  if (!horizonSettings.loaded) horizonSettings.load();
});

watch(() => store.horizonDays, (v) => {
  localHorizon.value = v;
  selectedPreset.value = PRESET_DAYS.includes(v) ? v : null;
});
watch(() => store.effectivePlanningStart, (v) => {
  if (autoStart.value) localStart.value = v;
});

const previewLabel = computed(() => {
  const start = store.effectivePlanningStart;
  const end = addDays(start, store.horizonDays - 1);
  return `${start} → ${end}`;
});

const oeeMode = computed(() => horizonSettings.resolvePerformanceMode(store.horizonDays));
const oeeTooltip = computed(() => {
  const mode = horizonSettings.performanceModeLabel(oeeMode.value);
  const threshold = horizonSettings.performanceLongThreshold;
  return `Performance data: ${mode}. Horizons above ${threshold + 1} days use long-term OEE.`;
});

function onPresetChange() {
  if (selectedPreset.value == null) return;
  localHorizon.value = selectedPreset.value;
  store.setPlanningHorizon(selectedPreset.value);
}

function applyCustomHorizon() {
  if (localHorizon.value == null) return;
  store.setPlanningHorizon(localHorizon.value);
  selectedPreset.value = PRESET_DAYS.includes(localHorizon.value) ? localHorizon.value : null;
}

function applyStart() {
  if (autoStart.value) return;
  store.setPlanningHorizon(localHorizon.value, localStart.value || null);
}

function toggleAutoStart() {
  if (autoStart.value) {
    store.setPlanningHorizon(localHorizon.value, null);
    localStart.value = store.effectivePlanningStart;
  } else {
    localStart.value = store.effectivePlanningStart;
  }
}

function recalculate() {
  applyCustomHorizon();
  emit('recalculate');
}
</script>

<style scoped>
.planning-horizon-bar {
  margin-bottom: 1rem;
}

.panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.panel-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-text-muted-color, #64748b);
  cursor: help;
  border-radius: 50%;
}

.info-btn:hover {
  color: var(--p-primary-color, #0070f2);
}

.horizon-preview {
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #64748b);
}

.horizon-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem 1.25rem;
  padding: 0.75rem 1rem 1rem;
}

.horizon-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color, #64748b);
}

.horizon-field-custom {
  max-width: 8rem;
}

.start-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-input {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--p-content-border-color, #cbd5e1);
  border-radius: 6px;
  font: inherit;
}

.auto-label {
  font-size: 0.8rem;
  cursor: pointer;
  user-select: none;
}
</style>
