import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const STORAGE_KEY = 'hap_agent_engine_mode';

/** rules = regelbasierte Agenten | llm = Hybrid mit LLM-Anreicherung */
export const useAgentModeStore = defineStore('agentMode', () => {
  const engineMode = ref(readMode());

  const useLlmEnrich = computed(() => engineMode.value === 'llm');

  const modeLabel = computed(() => ({
    rules: { de: 'Regel-Agenten', en: 'Rule agents', fr: 'Agents règles' },
    llm: { de: 'LLM + RAG', en: 'LLM + RAG', fr: 'LLM + RAG' },
  }));

  function setEngineMode(mode) {
    if (mode !== 'rules' && mode !== 'llm') return;
    engineMode.value = mode;
    localStorage.setItem(STORAGE_KEY, mode);
  }

  function agentRunPayload(base = {}) {
    return {
      ...base,
      llmEnrich: useLlmEnrich.value,
    };
  }

  return { engineMode, useLlmEnrich, modeLabel, setEngineMode, agentRunPayload };
});

function readMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'llm' ? 'llm' : 'rules';
  } catch {
    return 'rules';
  }
}
