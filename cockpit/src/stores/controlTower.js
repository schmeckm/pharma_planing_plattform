import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiV4, connectControlTowerWs } from '@/api/v4';
import { useHorizonSettingsStore } from '@/stores/horizonSettings';

export const useControlTowerStore = defineStore('controlTower', () => {
  const loading = ref(false);
  const dashboard = ref(null);
  const liveKpis = ref(null);
  const liveEvents = ref([]);
  const wsConnected = ref(false);
  let ws = null;

  async function loadDashboard(horizon) {
    const horizonSettings = useHorizonSettingsStore();
    const days = horizon ?? horizonSettings.controlTowerHorizon;
    loading.value = true;
    try {
      dashboard.value = await apiV4.dashboard(days);
    } finally {
      loading.value = false;
    }
  }

  function connectWs() {
    if (ws) ws.close();
    ws = connectControlTowerWs((msg) => {
      if (msg.type === 'CONNECTED') wsConnected.value = true;
      if (msg.type === 'UPDATE' || msg.type === 'SNAPSHOT') {
        liveKpis.value = msg.payload?.executive || msg.payload;
        if (msg.payload?.events) liveEvents.value = msg.payload.events;
      }
      if (msg.type === 'EVENT') {
        liveEvents.value = [msg.payload, ...liveEvents.value].slice(0, 20);
      }
    });
    ws.onclose = () => { wsConnected.value = false; };
  }

  function disconnectWs() {
    ws?.close();
    ws = null;
    wsConnected.value = false;
  }

  return { loading, dashboard, liveKpis, liveEvents, wsConnected, loadDashboard, connectWs, disconnectWs };
});
