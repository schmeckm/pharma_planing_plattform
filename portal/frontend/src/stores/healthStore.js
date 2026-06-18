import { defineStore } from 'pinia';
import api from '../services/api';

const POLL_INTERVAL_MS = 30_000;

export const useHealthStore = defineStore('health', {
  state: () => ({
    status: 'unknown',
    version: '0.1.0',
    services: [],
    checkedAt: null,
    timer: null,
  }),
  actions: {
    async fetchHealth() {
      try {
        const { data } = await api.get('/api/health/detailed');
        this.status = data.status || 'unknown';
        this.version = data.version || '0.1.0';
        this.services = data.services || [];
        this.checkedAt = data.checkedAt || new Date().toISOString();
      } catch {
        this.status = 'error';
        this.services = [
          { id: 'backend', label: 'Backend', status: 'offline' },
          { id: 'frontend', label: 'Frontend', status: 'online' },
        ];
        this.checkedAt = new Date().toISOString();
      }
    },
    startPolling() {
      this.fetchHealth();
      if (this.timer) return;
      this.timer = setInterval(() => this.fetchHealth(), POLL_INTERVAL_MS);
    },
    stopPolling() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    },
  },
});
