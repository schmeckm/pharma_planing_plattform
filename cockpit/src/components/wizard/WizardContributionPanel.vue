<template>
  <div class="wizard-contribution">
    <div v-if="summary" class="wizard-contribution__summary panel">
      <p class="wizard-contribution__title">Letzter Planungsbeitrag (Before/After)</p>
      <div class="wizard-contribution__chips">
        <span v-for="chip in summaryChips" :key="chip.label">{{ chip.label }}: {{ chip.value }}</span>
      </div>
    </div>

    <div v-if="executability" class="wizard-contribution__exec panel">
      <p class="wizard-contribution__title">Ausführbarkeit Grobplan</p>
      <div class="wizard-contribution__exec-grid">
        <div><span>Ausführbar</span><strong>{{ executability.executable }}/{{ executability.total }}</strong></div>
        <div><span>Blockiert</span><strong>{{ executability.blocked }}</strong></div>
        <div><span>Quote</span><strong>{{ executability.executableRate }}%</strong></div>
      </div>
    </div>

    <div class="wizard-contribution__form">
      <label for="contribution-note">Ihr Planungsbeitrag heute</label>
      <Textarea
        id="contribution-note"
        v-model="note"
        rows="4"
        placeholder="Was haben Sie verbessert? (Verspätungen, RMSL, Sequenz, Linie …)"
        :disabled="saving"
      />
      <Button
        label="Beitrag dokumentieren"
        icon="pi pi-check"
        :loading="saving"
        :disabled="!note.trim()"
        @click="submit"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import { planningApi } from '@/api/planning';

const props = defineProps({
  comparison: { type: Object, default: null },
  items: { type: Array, default: () => [] },
  executability: { type: Object, default: null },
});

const emit = defineEmits(['saved']);

const note = ref('');
const saving = ref(false);

const summary = computed(() => props.comparison);

const summaryChips = computed(() => {
  const c = props.comparison;
  if (!c) return [];
  return [
    { label: 'Late', value: `${c.lateOrders?.before ?? '—'} → ${c.lateOrders?.after ?? '—'}` },
    { label: 'RMSL', value: `${c.rmslViolations?.before ?? '—'} → ${c.rmslViolations?.after ?? '—'}` },
    { label: 'Moved', value: c.ordersMoved ?? 0 },
  ];
});

async function submit() {
  saving.value = true;
  try {
    const event = await planningApi.recordPlanningContribution({
      note: note.value.trim(),
      comparison: props.comparison,
      items: props.items,
    });
    emit('saved', event);
    note.value = '';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.wizard-contribution {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1rem 0;
}

.wizard-contribution__title {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.wizard-contribution__summary,
.wizard-contribution__exec {
  padding: 0.75rem 1rem;
}

.wizard-contribution__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.wizard-contribution__exec-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  font-size: 0.85rem;
}

.wizard-contribution__exec-grid span {
  display: block;
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.wizard-contribution__form label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.85rem;
  font-weight: 500;
}

.wizard-contribution__form :deep(textarea) {
  width: 100%;
  margin-bottom: 0.75rem;
}
</style>
