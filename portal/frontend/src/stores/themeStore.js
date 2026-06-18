import { defineStore } from 'pinia';

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: localStorage.getItem('theme') || 'dark',
  }),
  actions: {
    init() {
      document.documentElement.dataset.theme = this.mode;
    },
    toggle() {
      this.mode = this.mode === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', this.mode);
      document.documentElement.dataset.theme = this.mode;
    },
  },
});
