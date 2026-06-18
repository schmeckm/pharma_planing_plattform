import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiV2 } from '@/api/v2';

export const useCopilotStore = defineStore('copilot', () => {
  const messages = ref([]);
  const loading = ref(false);

  async function ask(question, packagingOrderId) {
    loading.value = true;
    messages.value.push({ role: 'user', text: question, time: new Date() });
    try {
      const response = await apiV2.copilotAsk({ question, packagingOrderId });
      messages.value.push({ role: 'copilot', ...response, time: new Date() });
      return response;
    } finally {
      loading.value = false;
    }
  }

  function clear() {
    messages.value = [];
  }

  return { messages, loading, ask, clear };
});
