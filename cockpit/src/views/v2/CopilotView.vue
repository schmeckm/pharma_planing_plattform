<template>
  <div class="v2-page copilot">
    <p class="page-subtitle">Explain allocation decisions, planning exceptions, and recommended sequences</p>

    <div class="copilot-grid">
      <Card class="chat-panel">
        <template #title>Allocation Copilot</template>
        <template #content>
          <div class="suggestions">
            <Chip v-for="q in suggestions" :key="q" :label="q" @click="ask(q)" class="suggestion-chip" />
          </div>
          <div class="messages">
            <div v-for="(msg, i) in store.messages" :key="i" :class="['msg', msg.role]">
              <strong>{{ msg.role === 'user' ? 'You' : 'Copilot' }}</strong>
              <p>{{ plannerText(msg.text || msg.answer) }}</p>
              <ul v-if="msg.evidence?.length">
                <li v-for="(e, j) in msg.evidence" :key="j">{{ plannerText(e) }}</li>
              </ul>
              <ul v-if="msg.suggestions?.length" class="hints">
                <li v-for="(s, j) in msg.suggestions" :key="j">{{ plannerText(s) }}</li>
              </ul>
            </div>
          </div>
          <div class="input-row">
            <InputText v-model="orderId" placeholder="Order ID (optional)" class="order-input" />
            <InputText v-model="question" placeholder="Ask a question…" class="flex-1" @keyup.enter="submit" />
            <Button icon="pi pi-send" @click="submit" :loading="store.loading" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Chip from 'primevue/chip';
import { useCopilotStore } from '@/stores/copilot';
import { plannerText } from '@/utils/plannerTerminology';

const store = useCopilotStore();
const question = ref('');
const orderId = ref('FG-20001');

const suggestions = [
  'Why was this batch selected?',
  'Why is this order blocked?',
  'What happens if I move this order?',
  'Which batch is recommended?',
];

async function ask(q) {
  question.value = q;
  await submit();
}

async function submit() {
  if (!question.value) return;
  await store.ask(question.value, orderId.value || undefined);
  question.value = '';
}
</script>

<style scoped>
.suggestions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.suggestion-chip { cursor: pointer; }
.messages { max-height: 400px; overflow-y: auto; margin-bottom: 16px; }
.msg { padding: 12px; margin-bottom: 8px; border-radius: 8px; font-size: 0.875rem; }
.msg.user { background: #e3f2fd; }
.msg.copilot { background: #f5f5f5; }
.msg p { margin: 6px 0 0; }
.hints { color: var(--color-text-muted); font-size: 0.8125rem; }
.input-row { display: flex; gap: 8px; }
.order-input { width: 140px; }
.flex-1 { flex: 1; }
</style>
