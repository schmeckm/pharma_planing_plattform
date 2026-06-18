import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { settingsApi } from '@/api/settings';

const CONTROL_TOWER_KEY = 'hap_control_tower_horizon';

export const useHorizonSettingsStore = defineStore('horizonSettings', () => {
  const loaded = ref(false);
  const modules = ref(null);
  const controlTowerHorizon = ref(7);

  const controlTowerOptions = computed(() => {
    const opts = modules.value?.controlTower?.options || [7, 30, 90];
    return opts.map((value) => ({ label: `${value}d`, value }));
  });

  const schedulingDefault = computed(() => modules.value?.scheduling?.defaultDays ?? 14);
  const schedulingMin = computed(() => modules.value?.scheduling?.minDays ?? 7);
  const schedulingMax = computed(() => modules.value?.scheduling?.maxDays ?? 365);

  const performanceShortDays = computed(() => modules.value?.performance?.shortDays ?? 30);
  const performanceLongDays = computed(() => modules.value?.performance?.longDays ?? 365);
  const performanceLongThreshold = computed(() => modules.value?.performance?.longThresholdDays ?? 14);

  function resolvePerformanceMode(horizonDays) {
    const days = Number(horizonDays) || schedulingDefault.value;
    return days > performanceLongThreshold.value ? 'long' : 'short';
  }

  function performanceModeLabel(mode) {
    return mode === 'long' ? 'Long-term (capacity)' : 'Short-term (sequencing)';
  }

  async function load() {
    try {
      const data = await settingsApi.getHorizons();
      modules.value = data.modules;
    } catch {
      modules.value = null;
    }

    const saved = parseInt(localStorage.getItem(CONTROL_TOWER_KEY), 10);
    const defaultDays = modules.value?.controlTower?.defaultDays ?? 7;
    controlTowerHorizon.value = Number.isFinite(saved) ? saved : defaultDays;
    loaded.value = true;
  }

  function setControlTowerHorizon(days) {
    controlTowerHorizon.value = days;
    localStorage.setItem(CONTROL_TOWER_KEY, String(days));
  }

  return {
    loaded,
    modules,
    controlTowerHorizon,
    controlTowerOptions,
    schedulingDefault,
    schedulingMin,
    schedulingMax,
    performanceShortDays,
    performanceLongDays,
    performanceLongThreshold,
    resolvePerformanceMode,
    performanceModeLabel,
    load,
    setControlTowerHorizon,
  };
});
