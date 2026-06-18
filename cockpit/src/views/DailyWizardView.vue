<template>

  <div class="daily-wizard">

    <div class="wizard-intro panel">

      <div>

        <h2>Guten Tag — Ihr Tages-Wizard</h2>

        <p class="wizard-intro__progress">{{ progressLabel }}</p>

        <p class="wizard-intro__anchor">Planungshorizont: {{ planDateLabel }}</p>

      </div>

      <div class="wizard-intro__meta">

        <el-progress :percentage="progressPercent" :stroke-width="8" style="width: 140px" />

      </div>

    </div>



    <div class="wizard-layout">

      <aside class="wizard-steps panel">

        <el-steps direction="vertical" :active="activeStep" finish-status="success">

          <el-step

            v-for="(step, index) in visibleSteps"

            :key="step.id"

            :title="step.speakingTitle"

            class="wizard-step-click"

            @click="goToStep(index)"

          />

        </el-steps>

      </aside>



      <section class="wizard-content panel">

        <div class="wizard-content__head">

          <div>

            <h2>{{ currentStep.speakingTitle }}</h2>

            <p class="step-hint">{{ stepHint }}</p>

          </div>

          <el-tag v-if="isStepDone(currentStep.id)" type="success" effect="plain">Erledigt</el-tag>

        </div>



        <AgentActivityPanel

          v-if="currentStep.id === 'agents'"

          :agent-statuses="agentStatuses"

          :orchestrator-state="orchestratorState"

          :briefing="briefing"

          :recommendations="recommendations"

          :agent-outputs="agentRunResult?.agentOutputs || []"

          :advisor-note="agentRunResult?.advisorNote || briefing?.advisorNote"

          :degraded-lines="wizardCtx.degradedLines"

          @approve="approveRec"

          @dismiss="dismissRec"

        />



        <template v-else>

          <WizardStepEmbed :step-id="currentStep.id" :ctx="wizardCtx" />

          <div class="step-placeholder">

            <el-icon :size="40" color="var(--color-accent)"><component :is="stepIcon" /></el-icon>

            <p class="step-placeholder__text">{{ currentStep.description }}</p>

          </div>

        </template>



        <div class="wizard-actions">

          <Button

            :label="primaryButtonLabel"

            :icon="primaryButtonIcon"

            :loading="agentsLoading && currentStep.id === 'agents'"

            :disabled="currentStep.id === 'agents' && !canRunAgents && !isStepDone('agents')"

            @click="onPrimaryAction"

          />

          <div class="wizard-actions__secondary">

            <CopilotLauncher v-if="currentStep.id === 'agents'" />

            <Button

              v-if="activeStep > 0"

              label="Zurück"

              icon="pi pi-angle-left"

              text

              size="small"

              @click="prevStep"

            />

            <Button

              v-if="activeStep < visibleSteps.length - 1 && isStepDone(currentStep.id)"

              label="Weiter"

              icon="pi pi-angle-right"

              icon-pos="right"

              text

              size="small"

              @click="nextStep"

            />

          </div>

        </div>

      </section>

    </div>

  </div>

</template>



<script setup>

import { computed, onMounted, ref, watch } from 'vue';

import { useRouter } from 'vue-router';

import { useToast } from 'primevue/usetoast';

import Button from 'primevue/button';

import AgentActivityPanel from '@/components/wizard/AgentActivityPanel.vue';

import WizardStepEmbed from '@/components/wizard/WizardStepEmbed.vue';
import CopilotLauncher from '@/components/shared/CopilotLauncher.vue';

import { apiV3 } from '@/api/v3';

import { planningApi } from '@/api/planning';

import { fetchLineFactors } from '@/api/performance';

import { fetchOrders } from '@/api';

import { useAuthStore } from '@/stores/auth';
import { useAgentModeStore } from '@/stores/agentMode';

import {

  DAILY_WIZARD_STEPS,

  WIZARD_AGENTS,

  PLANNING_ANCHOR,

  formatPlanningDate,

  dynamicHint,

  speakingProgress,

  loadWizardProgress,

  saveWizardProgress,

} from '@/utils/dailyWizardSteps';



const router = useRouter();

const toast = useToast();

const auth = useAuthStore();
const agentMode = useAgentModeStore();



const activeStep = ref(0);

const completed = ref([]);

const agentsLoading = ref(false);

const orchestratorState = ref('IDLE');

const agentStatuses = ref({});

const briefing = ref(null);

const agentRunResult = ref(null);

const recommendations = ref([]);

const dashboardKpis = ref(null);

const topSequence = ref([]);

const exceptionCount = ref(null);

const confirmedCount = ref(null);

const openOrders = ref(null);

const lineFactors = ref([]);



const planDateLabel = formatPlanningDate(PLANNING_ANCHOR);



const visibleSteps = computed(() =>

  DAILY_WIZARD_STEPS.filter((s) => !s.permission || auth.hasPermission(s.permission)),

);



const currentStep = computed(() => visibleSteps.value[activeStep.value] || visibleSteps.value[0]);



const canRunAgents = computed(() => auth.hasPermission('agents:run'));



const degradedLines = computed(() =>

  lineFactors.value.filter((l) => l.performanceFactor != null && l.performanceFactor < 1),

);



const wizardCtx = computed(() => ({

  planningDate: PLANNING_ANCHOR,

  briefing: briefing.value,

  dashboardKpis: dashboardKpis.value,

  topSequence: topSequence.value,

  degradedLines: degradedLines.value,

  exceptionCount: exceptionCount.value,

  confirmedCount: confirmedCount.value,

  openOrders: openOrders.value,

}));



const stepHint = computed(() => dynamicHint(currentStep.value.id, wizardCtx.value));



const progressLabel = computed(() =>

  speakingProgress(activeStep.value, visibleSteps.value.length, currentStep.value),

);



const progressPercent = computed(() =>

  Math.round((completed.value.length / visibleSteps.value.length) * 100),

);



const primaryButtonLabel = computed(() => {

  if (currentStep.value.id === 'agents') {

    if (isStepDone('agents')) return currentStep.value.primaryActionDone || 'Weiter zum Tagesplan';

    return canRunAgents.value ? currentStep.value.primaryAction : 'Nur Lagebild (Lesen)';

  }

  if (isStepDone(currentStep.value.id)) return 'Weiter';

  return currentStep.value.primaryAction;

});



const primaryButtonIcon = computed(() => {

  if (currentStep.value.id === 'agents' && !isStepDone('agents')) return 'pi pi-play';

  if (isStepDone(currentStep.value.id) && activeStep.value < visibleSteps.value.length - 1) {

    return 'pi pi-angle-right';

  }

  return 'pi pi-arrow-right';

});



const stepIcon = computed(() => {

  const icons = {

    'daily-plan': 'Calendar',

    sequencing: 'Sort',

    simulation: 'CircleCheck',

    mass: 'Timer',

    confirm: 'Finished',

    exceptions: 'Warning',

    audit: 'Document',

  };

  return icons[currentStep.value.id] || 'List';

});



function isStepDone(id) {

  return completed.value.includes(id);

}



function goToStep(index) {

  activeStep.value = index;

  persistProgress();

}



function prevStep() {

  if (activeStep.value > 0) activeStep.value--;

  persistProgress();

}



function nextStep() {

  if (activeStep.value < visibleSteps.value.length - 1) activeStep.value++;

  persistProgress();

}



function completeStep() {

  const id = currentStep.value.id;

  if (!completed.value.includes(id)) completed.value.push(id);

  persistProgress();

}



function persistProgress() {

  saveWizardProgress({ step: activeStep.value, completed: completed.value });

}



function openStepPage() {

  if (!currentStep.value.path) return;

  router.push({ path: currentStep.value.path, query: { fromWizard: currentStep.value.id } });

}



function onPrimaryAction() {

  const step = currentStep.value;



  if (step.id === 'agents') {

    if (isStepDone('agents')) {

      const idx = visibleSteps.value.findIndex((s) => s.id === 'daily-plan');

      if (idx >= 0) activeStep.value = idx;

      persistProgress();

      return;

    }

    if (canRunAgents.value) {

      runAgents();

    } else {

      loadBriefingOnly();

    }

    return;

  }



  if (isStepDone(step.id)) {

    nextStep();

    return;

  }



  if (step.path) {

    openStepPage();

    return;

  }



  completeStep();

  nextStep();

}



function initAgentStatuses(status = 'IDLE') {

  const map = {};

  for (const a of WIZARD_AGENTS) map[a.id] = status;

  agentStatuses.value = map;

}



async function animateAgentsRunning(agentIds) {

  initAgentStatuses('IDLE');

  orchestratorState.value = 'RUNNING';

  for (const id of agentIds) {

    agentStatuses.value = { ...agentStatuses.value, [id]: 'RUNNING' };

    await new Promise((r) => setTimeout(r, 350));

  }

}



async function loadBriefingOnly() {

  agentsLoading.value = true;

  try {

    briefing.value = await apiV3.morningBriefing(7);

    orchestratorState.value = 'COMPLETED';

    toast.add({ severity: 'info', summary: 'Lagebild geladen', detail: 'Orchestrierung erfordert Rolle Planner oder QA.', life: 4000 });

  } catch (err) {

    toast.add({ severity: 'error', summary: 'Lagebild nicht verfügbar', detail: err.message, life: 5000 });

  } finally {

    agentsLoading.value = false;

  }

}



async function runAgents() {

  if (!canRunAgents.value) {

    loadBriefingOnly();

    return;

  }



  agentsLoading.value = true;

  initAgentStatuses('IDLE');

  orchestratorState.value = 'RUNNING';



  try {

    briefing.value = await apiV3.morningBriefing(7);

    const runPromise = apiV3.runAgents(agentMode.agentRunPayload({ trigger: 'SCHEDULED_DAILY', horizonDays: 7 }));

    await animateAgentsRunning(['planning', 'qa', 'supplyChain', 'compliance']);

    agentRunResult.value = await runPromise;



    if (agentRunResult.value.status === 'DISABLED') {

      orchestratorState.value = 'DISABLED';

      toast.add({ severity: 'warn', summary: 'Assistenten pausiert', detail: 'Server: AGENTS_ENABLED=false', life: 5000 });

      return;

    }



    for (const id of agentRunResult.value.agentsRun || []) {

      agentStatuses.value = { ...agentStatuses.value, [id]: 'COMPLETED' };

    }

    orchestratorState.value = 'COMPLETED';

    recommendations.value = agentRunResult.value.recommendations || [];

    if (agentRunResult.value.dailySummary) briefing.value = agentRunResult.value.dailySummary;



    completeStep();

    toast.add({

      severity: 'success',

      summary: 'Analyse abgeschlossen',

      detail: `${agentRunResult.value.totalRecommendations || 0} Empfehlungen — bitte freigeben.`,

      life: 3000,

    });

  } catch (err) {

    orchestratorState.value = 'FAILED';

    initAgentStatuses('FAILED');

    toast.add({ severity: 'error', summary: 'Analyse fehlgeschlagen', detail: err.message, life: 5000 });

  } finally {

    agentsLoading.value = false;

  }

}



async function loadWizardContext() {

  try {

    const [dash, exc, sched, orders, factors] = await Promise.all([

      planningApi.getPlannerDashboard(PLANNING_ANCHOR).catch(() => null),

      planningApi.getExceptions({ status: 'OPEN' }).catch(() => null),

      planningApi.getConfirmedSchedule().catch(() => null),

      fetchOrders({ status: 'OPEN' }).catch(() => []),

      fetchLineFactors().catch(() => ({ items: [] })),

    ]);



    if (dash?.kpis) dashboardKpis.value = dash.kpis;

    if (dash?.recommendations?.sequence) topSequence.value = dash.recommendations.sequence;

    if (exc?.exceptions) exceptionCount.value = exc.exceptions.length;

    if (sched?.itemCount != null) confirmedCount.value = sched.itemCount;

    openOrders.value = Array.isArray(orders) ? orders.length : null;

    lineFactors.value = factors?.items || [];

  } catch { /* optional */ }

}



async function loadRecommendations() {

  try {

    const data = await apiV3.getRecommendations('PENDING_APPROVAL');

    recommendations.value = data.recommendations || [];

  } catch { /* optional */ }

}



async function approveRec(id) {

  await apiV3.approveRecommendation(id);

  await loadRecommendations();

  toast.add({ severity: 'success', summary: 'Freigegeben', life: 2000 });

}



async function dismissRec(id) {

  await apiV3.dismissRecommendation(id, 'Vom Planer abgelehnt');

  await loadRecommendations();

  toast.add({ severity: 'info', summary: 'Abgelehnt', life: 2000 });

}



onMounted(async () => {

  const saved = loadWizardProgress();

  activeStep.value = Math.min(saved.step || 0, visibleSteps.value.length - 1);

  completed.value = saved.completed || [];

  initAgentStatuses('IDLE');



  await Promise.all([loadWizardContext(), loadRecommendations()]);



  if (currentStep.value.autoRun && !completed.value.includes('agents')) {

    if (canRunAgents.value) {

      runAgents();

    } else {

      loadBriefingOnly();

    }

  }

});



watch(activeStep, persistProgress);

</script>



<style scoped>

.daily-wizard {

  max-width: 1200px;

}



.wizard-intro {

  display: flex;

  justify-content: space-between;

  align-items: center;

  padding: 16px 20px;

  margin-bottom: 20px;

  gap: 16px;

  flex-wrap: wrap;

}



.wizard-intro h2 {

  margin: 0 0 4px;

  font-size: 1.125rem;

}



.wizard-intro__progress {

  margin: 0;

  font-size: 0.9375rem;

  font-weight: 600;

  color: var(--color-accent);

}



.wizard-intro__anchor {

  margin: 4px 0 0;

  font-size: 0.8125rem;

  color: var(--color-text-muted);

}



.wizard-intro__meta {

  display: flex;

  align-items: center;

}



.wizard-layout {

  display: grid;

  grid-template-columns: 220px 1fr;

  gap: 20px;

  align-items: start;

}



.wizard-steps {

  padding: 20px 12px;

  position: sticky;

  top: 0;

}



.wizard-step-click {

  cursor: pointer;

}



.wizard-content {

  padding: 24px;

  min-height: 420px;

  display: flex;

  flex-direction: column;

}



.wizard-content__head {

  display: flex;

  justify-content: space-between;

  align-items: flex-start;

  margin-bottom: 12px;

  gap: 12px;

}



.wizard-content__head h2 {

  margin: 0 0 6px;

  font-size: 1.25rem;

}



.step-hint {

  margin: 0;

  font-size: 1rem;

  line-height: 1.45;

  color: #303133;

}



.step-placeholder {

  flex: 1;

  display: flex;

  flex-direction: column;

  align-items: center;

  justify-content: center;

  text-align: center;

  padding: 24px 16px;

  gap: 12px;

}



.step-placeholder__text {

  margin: 0;

  max-width: 420px;

  color: var(--color-text-muted);

  font-size: 0.9375rem;

}



.wizard-actions {

  display: flex;

  align-items: center;

  justify-content: space-between;

  flex-wrap: wrap;

  gap: 12px;

  margin-top: auto;

  padding-top: 20px;

  border-top: 1px solid var(--color-border);

}



.wizard-actions__secondary {

  display: flex;

  gap: 4px;

}



@media (max-width: 900px) {

  .wizard-layout {

    grid-template-columns: 1fr;

  }

  .wizard-steps {

    position: static;

  }

}

</style>


