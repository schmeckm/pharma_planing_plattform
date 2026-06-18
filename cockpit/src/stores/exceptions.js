import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiV2 } from '@/api/v2';

export const useExceptionsStore = defineStore('exceptions', () => {
  const items = ref([]);
  const loading = ref(false);

  async function load(params = {}) {
    loading.value = true;
    try {
      items.value = await apiV2.getExceptions(params);
    } finally {
      loading.value = false;
    }
  }

  async function addComment(id, text) {
    await apiV2.addComment(id, text);
    await load();
  }

  async function escalate(id, assignTo, reason) {
    await apiV2.escalate(id, { assignTo, reason });
    await load();
  }

  async function resolve(id, resolution) {
    await apiV2.resolve(id, resolution);
    await load();
  }

  async function review(id) {
    await apiV2.review(id);
    await load();
  }

  return { items, loading, load, addComment, escalate, resolve, review };
});
