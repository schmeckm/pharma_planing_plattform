<template>
  <div class="v2-page copilot-v3">
    <p class="page-subtitle">Planning Copilot — explainable business answers (planner retains final approval)</p>

    <Card>
      <template #title>AI Copilot v3</template>
      <template #content>
        <div class="suggestions">
          <Chip v-for="q in suggestions" :key="q" :label="q" @click="ask(q)" class="suggestion-chip" />
        </div>
        <div class="messages">
          <div v-for="(msg, i) in messages" :key="i" :class="['msg', msg.role]">
            <strong>{{ msg.role === 'user' ? 'You' : 'Copilot v3' }}</strong>
            <p>{{ plannerText(msg.text || msg.answer) }}</p>
            <ul v-if="msg.evidence?.length">
              <li v-for="(e, j) in msg.evidence" :key="j">{{ plannerText(e) }}</li>
            </ul>
            <pre v-if="msg.graphContext" class="graph-context">{{ JSON.stringify(msg.graphContext, null, 2) }}</pre>
          </div>
        </div>
        <div class="input-row">
          <InputText v-model="orderId" placeholder="Packaging Order ID" class="order-input" />
          <InputText v-model="question" placeholder="Ask a question…" class="flex-1" @keyup.enter="submit" />
          <Button icon="pi pi-send" :loading="loading" @click="submit" />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Chip from 'primevue/chip';
import { useToast } from 'primevue/usetoast';
import { apiV3 } from '@/api/v3';
import { plannerText } from '@/utils/plannerTerminology';

const toast = useToast();
const question = ref('');
const orderId = ref('FG-20001');
const loading = ref(false);
const messages = ref([]);

const suggestions = [
  'Why was this batch selected?',
  'Why is this order blocked?',
  'Why was this line recommended?',
  'What happens if I move this order?',
  'What happens if I use another batch?',
  'What happens if I move to another line?',
];

async function ask(q) {
  question.value = q;
  await submit();
}

async function submit() {
  if (!question.value) return;
  messages.value.push({ role: 'user', text: question.value });
  loading.value = true;
  try {
    const res = await apiV3.copilotAsk({
      question: question.value,
      packagingOrderId: orderId.value || undefined,
    });
    messages.value.push({ role: 'assistant', ...res });
    question.value = '';
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Copilot error', detail: err.message, life: 4000 });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.suggestions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.messages { max-height: 400px; overflow-y: auto; margin-bottom: 16px; }
.msg { padding: 12px; margin-bottom: 8px; border-radius: 8px; background: var(--surface-100); }
.msg.user { background: var(--primary-50); }
.input-row { display: flex; gap: 8px; }
.order-input { width: 180px; }
.flex-1 { flex: 1; }
.graph-context { font-size: 0.75rem; overflow-x: auto; background: var(--surface-50); padding: 8px; border-radius: 4px; }
</style>
