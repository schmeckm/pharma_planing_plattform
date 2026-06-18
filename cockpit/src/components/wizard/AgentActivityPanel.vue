<template>

  <div class="agent-panel">

    <div class="agent-panel__toolbar">
      <AgentEngineToggle />
      <CopilotLauncher />
    </div>

    <div class="agent-panel__header">

      <h3>Ihre Assistenten</h3>

      <el-tag v-if="orchestratorState === 'RUNNING'" type="warning" effect="dark" size="small">

        Analyse läuft…

      </el-tag>

      <el-tag v-else-if="orchestratorState === 'COMPLETED'" type="success" effect="plain" size="small">

        Fertig

      </el-tag>

      <el-tag v-else-if="orchestratorState === 'DISABLED'" type="info" size="small">

        Pausiert

      </el-tag>

      <el-tag v-else type="info" effect="plain" size="small">Bereit</el-tag>

    </div>



    <p class="agent-panel__mode-hint">
      {{ modeHint }}
    </p>

    <p class="agent-panel__note">

      {{ advisorNote || 'Alle Vorschläge brauchen Ihre Freigabe — nichts wird automatisch ausgeführt.' }}

    </p>



    <div v-if="degradedLines?.length" class="agent-panel__factor-hint">

      <strong>Leistungsfaktor:</strong>

      <span v-for="l in degradedLines.slice(0, 2)" :key="l.lineId">

        {{ shortLineName(l) }} {{ Math.round(l.performanceFactor * 100) }} %

      </span>

      <span v-if="degradedLines.length > 2">+{{ degradedLines.length - 2 }} weitere</span>

      — Laufzeiten sind angepasst.

    </div>



    <div class="agent-grid">

      <div

        v-for="agent in agentCards"

        :key="agent.id"

        class="agent-card"

        :class="`agent-card--${agent.status.toLowerCase()}`"

      >

        <div class="agent-card__head">

          <el-icon class="agent-card__icon"><component :is="agent.icon" /></el-icon>

          <div>

            <strong>{{ agent.label }}</strong>

          </div>

          <el-tag size="small" :type="statusType(agent.status)">{{ statusLabel(agent.status) }}</el-tag>

        </div>

        <p class="agent-card__desc">{{ agent.desc }}</p>

        <p v-if="agent.recommendationCount != null" class="agent-card__count">

          {{ agent.recommendationCount }} Empfehlung(en)

        </p>

      </div>

    </div>



    <div v-if="briefing?.summary?.scheduling" class="scheduling-kpis">

      <div class="scheduling-kpis__head">

        <strong>Planungs-Engine</strong>

        <el-tag size="small" effect="plain">{{ briefing.summary.scheduling.engine }}</el-tag>

        <el-tag size="small" :type="solverTagType(briefing.summary.scheduling.solverStatus)">

          {{ briefing.summary.scheduling.solverStatus }}

        </el-tag>

      </div>

      <div class="scheduling-kpis__grid">

        <div><span>Eligible</span><strong>{{ briefing.summary.scheduling.eligible ?? '—' }}</strong></div>

        <div><span>Blockiert</span><strong>{{ briefing.summary.scheduling.blocked ?? '—' }}</strong></div>

        <div><span>QA</span><strong>{{ briefing.summary.scheduling.qaBlocked ?? '—' }}</strong></div>

        <div><span>Auslastung</span><strong>{{ formatUtil(briefing.summary.scheduling.peakUtilization) }}</strong></div>

      </div>

    </div>



    <div v-if="scheduleExplanation" class="schedule-explanation">

      <strong>Plan-Erklärung</strong>

      <p>{{ scheduleExplanation }}</p>

    </div>



    <div v-if="briefing?.summary" class="briefing-kpis">

      <div><span>Offen</span><strong>{{ briefing.summary.openOrders }}</strong></div>

      <div><span>Allokierbar</span><strong>{{ briefing.summary.allocatableOrders }}</strong></div>

      <div><span>Mit Risiko</span><strong>{{ briefing.summary.ordersAtRisk }}</strong></div>

      <div><span>Inventar</span><strong>{{ briefing.summary.inventoryRisks }}</strong></div>

      <div><span>Sequenz</span><strong>{{ briefing.summary.japanSequenceRisks }}</strong></div>

      <div><span>QA offen</span><strong>{{ briefing.summary.pendingInspectionLots }}</strong></div>

    </div>



    <DataTable

      v-if="recommendations.length"

      :value="recommendations"

      size="small"

      striped-rows

      class="rec-table"

      paginator

      :rows="5"

    >

      <Column field="agent" header="Assistent" />

      <Column field="packagingOrderId" header="Auftrag" />

      <Column field="action" header="Empfehlung" />

      <Column field="priority" header="Priorität">

        <template #body="{ data }">

          <Tag :severity="prioritySeverity(data.priority)" :value="priorityLabel(data.priority)" />

        </template>

      </Column>

      <Column header="">

        <template #body="{ data }">

          <Button

            v-if="data.status === 'PENDING_APPROVAL' || data.status === 'NEEDS_REVIEW'"

            icon="pi pi-check"

            text

            size="small"

            severity="success"

            v-tooltip="'Freigeben'"

            @click="$emit('approve', data.recommendationId)"

          />

          <Button

            v-if="data.status === 'PENDING_APPROVAL' || data.status === 'NEEDS_REVIEW'"

            icon="pi pi-times"

            text

            size="small"

            severity="secondary"

            v-tooltip="'Ablehnen'"

            @click="$emit('dismiss', data.recommendationId)"

          />

        </template>

      </Column>

    </DataTable>

  </div>

</template>



<script setup>

import { computed } from 'vue';

import DataTable from 'primevue/datatable';

import Column from 'primevue/column';

import Tag from 'primevue/tag';

import Button from 'primevue/button';

import { WIZARD_AGENTS } from '@/utils/dailyWizardSteps';
import AgentEngineToggle from '@/components/shared/AgentEngineToggle.vue';
import CopilotLauncher from '@/components/shared/CopilotLauncher.vue';
import { useAgentModeStore } from '@/stores/agentMode';
import { useLocaleStore } from '@/stores/locale';

const agentMode = useAgentModeStore();
const localeStore = useLocaleStore();

const modeHint = computed(() => {
  const loc = localeStore.locale;
  if (agentMode.engineMode === 'llm') {
    return {
      de: 'Hybrid-Modus: Regel-Agenten + LLM-Anreicherung. Copilot jederzeit über den Button oben.',
      en: 'Hybrid mode: rule agents + LLM enrichment. Copilot always available via the button above.',
      fr: 'Mode hybride : agents règles + enrichissement LLM. Copilot accessible via le bouton ci-dessus.',
    }[loc];
  }
  return {
    de: 'Regel-Modus: deterministische Agenten. Für freie Fragen jederzeit Copilot nutzen.',
    en: 'Rules mode: deterministic agents. Use Copilot anytime for free-form questions.',
    fr: 'Mode règles : agents déterministes. Utilisez Copilot à tout moment pour des questions libres.',
  }[loc];
});



const props = defineProps({

  agentStatuses: { type: Object, default: () => ({}) },

  orchestratorState: { type: String, default: 'IDLE' },

  briefing: { type: Object, default: null },

  recommendations: { type: Array, default: () => [] },

  advisorNote: { type: String, default: '' },

  agentOutputs: { type: Array, default: () => [] },

  degradedLines: { type: Array, default: () => [] },

});



defineEmits(['approve', 'dismiss']);



const scheduleExplanation = computed(() =>

  props.briefing?.scheduleExplanation || props.briefing?.llmSummary || '',

);



function solverTagType(status) {

  if (!status) return 'info';

  if (status === 'OPTIMAL' || status === 'SAVED') return 'success';

  if (status === 'NOT_OPTIMIZED' || status === 'NO_SCHEDULE') return 'warning';

  return 'info';

}



function formatUtil(value) {

  if (value == null) return '—';

  return `${value} %`;

}



const agentCards = computed(() =>

  WIZARD_AGENTS.map((a) => {

    const output = props.agentOutputs.find((o) => o.agentId === `${a.id}-agent` || o.agentId?.includes(a.id));

    return {

      ...a,

      status: props.agentStatuses[a.id] || 'IDLE',

      recommendationCount: output?.count ?? null,

    };

  }),

);



function shortLineName(line) {

  return (line.lineName || line.lineId || '').replace(/^Packaging Line \d+ — /, 'Linie ');

}



function statusType(status) {

  return { RUNNING: 'warning', COMPLETED: 'success', FAILED: 'danger', DISABLED: 'info' }[status] || 'info';

}



function statusLabel(status) {

  return {

    IDLE: 'Bereit',

    RUNNING: 'Läuft',

    COMPLETED: 'Fertig',

    FAILED: 'Fehler',

    DISABLED: 'Aus',

  }[status] || status;

}



function prioritySeverity(p) {

  return { HIGH: 'danger', MEDIUM: 'warn', LOW: 'success' }[p] || 'info';

}



function priorityLabel(p) {

  return { HIGH: 'Hoch', MEDIUM: 'Mittel', LOW: 'Niedrig' }[p] || p;

}

</script>



<style scoped>

.agent-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.agent-panel__mode-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 8px;
}

.agent-panel__header {

  display: flex;

  align-items: center;

  gap: 10px;

  margin-bottom: 8px;

}



.agent-panel__header h3 {

  margin: 0;

  font-size: 1rem;

}



.agent-panel__note {

  font-size: 0.875rem;

  color: var(--color-text-muted);

  margin: 0 0 12px;

}



.agent-panel__factor-hint {

  font-size: 0.8125rem;

  padding: 8px 12px;

  margin-bottom: 12px;

  background: #fdf6ec;

  border-radius: var(--radius);

  color: #b88230;

  display: flex;

  flex-wrap: wrap;

  gap: 6px;

  align-items: center;

}



.agent-grid {

  display: grid;

  grid-template-columns: repeat(2, 1fr);

  gap: 12px;

  margin-bottom: 16px;

}



.agent-card {

  border: 1px solid var(--color-border);

  border-radius: var(--radius);

  padding: 12px;

  background: #fff;

  transition: border-color 0.2s, box-shadow 0.2s;

}



.agent-card--running {

  border-color: #e6a23c;

  box-shadow: 0 0 0 1px rgba(230, 162, 60, 0.2);

}



.agent-card--completed {

  border-color: #67c23a;

}



.agent-card__head {

  display: flex;

  align-items: center;

  gap: 10px;

  margin-bottom: 6px;

}



.agent-card__icon {

  font-size: 1.25rem;

  color: var(--color-accent);

}



.agent-card__desc {

  margin: 0;

  font-size: 0.8125rem;

  color: var(--color-text-muted);

  line-height: 1.4;

}



.agent-card__count {

  margin: 6px 0 0;

  font-size: 0.75rem;

  font-weight: 600;

}



.scheduling-kpis {
  padding: 12px;
  margin-bottom: 12px;
  background: #ecf5ff;
  border-radius: var(--radius);
  font-size: 0.8125rem;
}

.scheduling-kpis__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.scheduling-kpis__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.scheduling-kpis__grid span {
  display: block;
  color: var(--color-text-muted);
  font-size: 0.6875rem;
}

.schedule-explanation {
  padding: 12px 14px;
  margin-bottom: 16px;
  background: #f0f9eb;
  border-left: 3px solid #67c23a;
  border-radius: var(--radius);
  font-size: 0.875rem;
}

.schedule-explanation p {
  margin: 6px 0 0;
  line-height: 1.45;
  color: #303133;
}



.briefing-kpis {

  display: grid;

  grid-template-columns: repeat(6, 1fr);

  gap: 12px;

  padding: 12px;

  background: #f5f6f7;

  border-radius: var(--radius);

  margin-bottom: 16px;

  font-size: 0.8125rem;

}



.briefing-kpis span {

  display: block;

  color: var(--color-text-muted);

  font-size: 0.6875rem;

}



.rec-table {

  margin-top: 8px;

}



@media (max-width: 900px) {

  .agent-grid,

  .briefing-kpis {

    grid-template-columns: 1fr 1fr;

  }

}

</style>


