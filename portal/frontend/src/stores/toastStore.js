import { defineStore } from 'pinia';

export const useToastStore = defineStore('toasts', {
  state: () => ({
    items: [],
  }),
  actions: {
    show(message, type = 'info') {
      const id = crypto.randomUUID();
      this.items.push({ id, message, type });
      setTimeout(() => this.dismiss(id), 4000);
    },
    dismiss(id) {
      this.items = this.items.filter((t) => t.id !== id);
    },
  },
});
