<template>

  <div class="v2-page">

    <p class="page-subtitle">Compare original vs optimized production sequences, or simulate allocation rule overrides</p>



    <TabView>

      <TabPanel :header="`Sequence ${PLANNER_LABELS.WHAT_IF_SIMULATION}`">

        <div class="seq-toolbar">

          <Button

            :label="`Build ${PLANNER_LABELS.RECOMMENDED_SEQUENCE}`"

            icon="pi pi-sliders-h"

            :loading="store.loading"

            @click="store.runRecommendedSequence()"

          />

          <Button

            :label="PLANNER_LABELS.WHAT_IF_SIMULATION"

            icon="pi pi-play"

            severity="secondary"

            outlined

            :loading="store.loading"

            @click="store.runWhatIf()"

          />

          <Button label="Open Production Sequencing" icon="pi pi-external-link" text @click="$router.push('/line-optimization')" />

        </div>



        <SwimlaneGantt

          v-if="store.ganttTasks.length"

          :tasks="store.ganttTasks"

          :lines="store.lines"

          :timeline-start="store.timelineStart"

          :timeline-end="store.timelineEnd"

          @move="onMove"

        />

        <p v-else class="empty">Load sequence from Production Sequencing or build a recommended sequence</p>



        <Card v-if="scenarios.length" class="mt-4">
          <template #title>Saved Scenarios</template>
          <template #content>
            <DataTable :value="scenarios" size="small" stripedRows>
              <Column field="scenarioId" header="Scenario" />
              <Column field="packagingOrderId" header="Order" />
              <Column field="scenarioType" header="Type" />
              <Column field="createdAt" header="Created">
                <template #body="{ data }">{{ data.createdAt?.slice(0, 10) }}</template>
              </Column>
            </DataTable>
          </template>
        </Card>

        <Card v-if="store.comparison" class="mt-4">

          <template #title>Original vs Optimized</template>

          <template #content>

            <p>{{ plannerText(store.comparison.summary) }}</p>

            <div class="compare-grid">

              <div><strong>Late orders</strong><br>{{ store.comparison.lateOrders?.before }} → {{ store.comparison.lateOrders?.after }}</div>

              <div><strong>Shelf-Life violations</strong><br>{{ store.comparison.rmslViolations?.before }} → {{ store.comparison.rmslViolations?.after }}</div>

              <div><strong>Risk score</strong><br>{{ store.comparison.riskDelta?.before }} → {{ store.comparison.riskDelta?.after }}</div>

              <div><strong>Orders moved</strong><br>{{ store.comparison.ordersMoved }}</div>

            </div>

          </template>

        </Card>

      </TabPanel>



      <TabPanel header="Allocation Rule Override">

        <div class="whatif-grid">

          <Card>

            <template #title>Scenario Parameters</template>

            <template #content>

              <div class="form-field">

                <label>Packaging Order</label>

                <InputText v-model="orderId" placeholder="FG-20001" class="w-full" />

              </div>

              <div class="form-field">

                <label>Country</label>

                <InputText v-model="overrides.countryCode" placeholder="DE" class="w-full" />

              </div>

              <div class="form-field">

                <label>Shelf-Life Threshold Override (months)</label>

                <InputNumber v-model="overrides.rmslThresholdMonths" class="w-full" />

              </div>

              <div class="form-field">

                <label>Forced Batch ID</label>

                <InputText v-model="overrides.forcedBatchId" placeholder="BATCH-DE-001" class="w-full" />

              </div>

              <div class="form-field">

                <label>Allow Batch Split</label>

                <ToggleSwitch v-model="overrides.allowBatchSplit" />

              </div>

              <Button label="Run What-If" icon="pi pi-play" @click="runAllocationWhatIf" :loading="allocLoading" class="w-full" />

            </template>

          </Card>



          <Card v-if="allocResult">

            <template #title>Impact Analysis</template>

            <template #content>

              <p class="summary">{{ allocResult.comparison?.summary }}</p>

              <div class="compare-row">

                <span>Status</span>

                <span>{{ allocResult.comparison?.baselineStatus }} → {{ allocResult.comparison?.scenarioStatus }}</span>

              </div>

              <div class="compare-row">

                <span>Batch</span>

                <span>{{ allocResult.comparison?.baselineBatch }} → {{ allocResult.comparison?.scenarioBatch }}</span>

              </div>

            </template>

          </Card>

        </div>

      </TabPanel>

    </TabView>

  </div>

</template>



<script setup>

import { ref, reactive, onMounted } from 'vue';

import TabView from 'primevue/tabview';

import TabPanel from 'primevue/tabpanel';

import Card from 'primevue/card';

import Button from 'primevue/button';

import InputText from 'primevue/inputtext';

import InputNumber from 'primevue/inputnumber';

import ToggleSwitch from 'primevue/toggleswitch';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

import SwimlaneGantt from '@/components/lineOptimization/SwimlaneGantt.vue';

import { useDailyPlanningStore } from '@/stores/dailyPlanning';

import { apiV2 } from '@/api/v2';

import { plannerText, PLANNER_LABELS } from '@/utils/plannerTerminology';



const store = useDailyPlanningStore();

const orderId = ref('FG-20001');

const overrides = reactive({ countryCode: 'DE', rmslThresholdMonths: null, forcedBatchId: '', allowBatchSplit: null });

const allocResult = ref(null);
const allocLoading = ref(false);
const scenarios = ref([]);

onMounted(async () => {
  store.loadDashboard();
  try {
    scenarios.value = await apiV2.getWhatIfScenarios();
  } catch { /* optional */ }
});



async function onMove({ taskId, productionLine, plannedStartDate }) {

  store.updateTaskPosition(taskId, productionLine, plannedStartDate);

  await store.runWhatIf();

}



async function runAllocationWhatIf() {

  allocLoading.value = true;

  try {

    const payload = { packagingOrderId: orderId.value, overrides: { ...overrides } };

    if (!payload.overrides.rmslThresholdMonths) delete payload.overrides.rmslThresholdMonths;

    if (!payload.overrides.forcedBatchId) delete payload.overrides.forcedBatchId;

    allocResult.value = await apiV2.whatIfSimulate(payload);

  } finally {

    allocLoading.value = false;

  }

}

</script>



<style scoped>

.seq-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }

.whatif-grid { display: grid; grid-template-columns: 360px 1fr; gap: 20px; }

.form-field { margin-bottom: 14px; }

.form-field label { display: block; font-size: 0.8125rem; margin-bottom: 4px; color: var(--color-text-muted); }

.w-full { width: 100%; }

.summary { font-weight: 600; margin-bottom: 12px; }

.compare-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--color-border); font-size: 0.875rem; }

.compare-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 12px; font-size: 0.875rem; }

.empty { color: var(--color-text-muted); font-size: 0.875rem; }

.mt-4 { margin-top: 16px; }

@media (max-width: 900px) {

  .whatif-grid, .compare-grid { grid-template-columns: 1fr; }

}

</style>

