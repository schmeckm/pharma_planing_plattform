<template>
  <div class="engine-toggle" :title="hint">
    <span v-if="showLabel" class="engine-toggle__label">{{ toggleLabel }}</span>
    <el-segmented
      :model-value="agentMode.engineMode"
      :options="options"
      size="small"
      @change="agentMode.setEngineMode"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAgentModeStore } from '@/stores/agentMode';
import { useLocaleStore } from '@/stores/locale';

defineProps({
  showLabel: { type: Boolean, default: true },
});

const agentMode = useAgentModeStore();
const localeStore = useLocaleStore();

const options = computed(() => {
  const loc = localeStore.locale;
  const L = agentMode.modeLabel;
  return [
    { label: L.rules[loc] || L.rules.de, value: 'rules' },
    { label: L.llm[loc] || L.llm.de, value: 'llm' },
  ];
});

const toggleLabel = computed(() => ({
  de: 'Agenten-Modus',
  en: 'Agent mode',
  fr: 'Mode agents',
}[localeStore.locale] || 'Agenten-Modus'));

const hint = computed(() => ({
  de: 'Regel-Agenten: deterministisch. LLM: Anreicherung mit gelernten Audit-Daten. Copilot ist jederzeit separat erreichbar.',
  en: 'Rule agents: deterministic. LLM: enrichment from audit learning. Copilot is always available separately.',
  fr: 'Agents règles: déterministes. LLM: enrichissement RAG. Copilot reste accessible à tout moment.',
}[localeStore.locale]));
</script>

<style scoped>
.engine-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.engine-toggle__label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}
</style>
