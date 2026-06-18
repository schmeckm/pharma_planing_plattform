import { defineStore } from 'pinia';

export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    items: [],
  }),
  actions: {
    add(notification) {
      this.items.unshift(notification);
    },
    markRead(id) {
      const item = this.items.find((n) => n.id === id);
      if (item) item.readAt = new Date().toISOString();
    },
  },
});
