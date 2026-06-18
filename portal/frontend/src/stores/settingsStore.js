import { defineStore } from 'pinia';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    loaded: false,
    flags: {},
  }),
  actions: {
    async load() {
      this.loaded = true;
    },
  },
});
