<template>
  <div class="v2-page planning-hub">
    <div class="ph-header">
      <p class="page-subtitle">Time-based allocation planning — production scheduling, shelf-life risk forecasting, and capacity</p>
      <div class="ph-toolbar">
        <Dropdown v-model="lineId" :options="lineOptions" option-label="label" option-value="value" @change="load" />
        <Button label="Refresh" icon="pi pi-refresh" outlined :loading="loading" @click="load" />
      </div>
    </div>

    <div v-if="loading && !data" class="loading"><ProgressSpinner /></div>

    <template v-else-if="data">
      <TabView>
        <TabPanel header="Production Timeline">
          <DataTable :value="data.timeline.orders" size="small" striped-rows>
            <Column field="packagingOrderId" header="PO" />
            <Column field="processOrder" header="Process Order" />
            <Column field="productionLine" header="Line" />
            <Column field="plannedStartDate" header="Start" />
            <Column field="plannedEndDate" header="End" />
            <Column field="requestedDeliveryDate" header="Delivery" />
            <Column field="priority" header="Priority">
              <template #body="{ data: row }"><Tag :severity="priSev(row.priority)" :value="row.priority" /></template>
            </Column>
            <Column field="market" header="Market" />
          </DataTable>
        </TabPanel>

        <TabPanel header="Gantt Chart">
          <GanttChart :gantt="data.gantt" />
        </TabPanel>

        <TabPanel header="Capacity Planning">
          <div class="cap-summary">
            <span>Peak: {{ data.capacity.summary.peakUtilization }}%</span>
            <span>Bottleneck days: {{ data.capacity.summary.bottleneckDays }}</span>
            <span>Maintenance: {{ data.capacity.summary.maintenanceDays }} day-slots</span>
          </div>
          <Chart type="bar" :data="capacityChart" :options="capacityChartOpts" class="cap-chart" />
          <DataTable :value="data.capacity.bottlenecks" size="small" striped-rows class="mt-3">
            <Column field="date" header="Date" />
            <Column field="lineId" header="Line" />
            <Column field="utilizationPercent" header="Util %" />
          </DataTable>
        </TabPanel>

        <TabPanel header="Shelf-Life Risk">
          <DataTable :value="data.rmslRisk.orders" size="small" striped-rows>
            <Column field="packagingOrderId" header="PO" />
            <Column field="batchId" header="Batch" />
            <Column header="Start Shelf-Life">
              <template #body="{ data: row }">{{ cp(row, 'PACKAGING_START') }}</template>
            </Column>
            <Column header="End Shelf-Life">
              <template #body="{ data: row }">{{ cp(row, 'PACKAGING_END') }}</template>
            </Column>
            <Column header="Delivery Shelf-Life">
              <template #body="{ data: row }">{{ cp(row, 'CUSTOMER_DELIVERY') }}</template>
            </Column>
            <Column header="Warnings">
              <template #body="{ data: row }">{{ row.warnings?.length || 0 }}</template>
            </Column>
            <Column header="Status">
              <template #body="{ data: row }">
                <Tag :severity="row.overallPassed ? 'success' : 'danger'" :value="row.overallPassed ? 'OK' : 'AT RISK'" />
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <TabPanel header="Market Delivery Risk">
          <div v-for="m in data.marketDelivery.markets" :key="m.market" class="market-block">
            <h4>{{ m.market }} <Tag :severity="riskSev(m.riskLevel)" :value="m.riskLevel" /></h4>
            <DataTable :value="m.orders" size="small">
              <Column field="packagingOrderId" header="PO" />
              <Column field="requestedDeliveryDate" header="Delivery" />
              <Column field="deliveryRmslMonths" header="Shelf-Life (mo)" />
              <Column header="OK"><template #body="{ data: row }"><Tag :severity="row.deliveryPassed ? 'success' : 'danger'" :value="row.deliveryPassed ? 'Yes' : 'No'" /></template></Column>
            </DataTable>
          </div>
        </TabPanel>

        <TabPanel header="Digital Twin">
          <div class="twin-kpis">
            <span>T+{{ twinHorizon }}: {{ data.digitalTwin.summary?.ordersAtRisk }} orders at risk</span>
            <span>{{ data.digitalTwin.summary?.batchesExpiring }} batches expiring</span>
            <span>Projected success: {{ data.digitalTwin.summary?.projectedSuccess }}/{{ data.digitalTwin.summary?.totalOrders }}</span>
          </div>
          <SelectButton v-model="twinHorizon" :options="[7,30,90]" @change="loadTwin" />
        </TabPanel>

        <TabPanel header="What-If Planning">
          <div class="whatif-form">
            <InputText v-model="whatIfOrder" placeholder="FG-20001" />
            <InputNumber v-model="shiftDays" placeholder="Shift days" show-buttons />
            <Dropdown v-model="whatIfLine" :options="lineOptions" option-label="label" option-value="value" placeholder="Production line" />
            <Button label="Simulate" icon="pi pi-play" :loading="whatIfLoading" @click="runWhatIf" />
          </div>
          <Card v-if="whatIfResult" class="mt-3">
            <template #title>Impact Analysis</template>
            <template #content>
              <p>{{ plannerText(whatIfResult.summary) }}</p>
              <ul>
                <li v-for="(item, i) in whatIfResult.impactAnalysis" :key="i">
                  <strong>{{ plannerText(item.area) }}:</strong> {{ item.change }} — {{ plannerText(item.impact) }}
                </li>
              </ul>
            </template>
          </Card>
        </TabPanel>
      </TabView>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import SelectButton from 'primevue/selectbutton';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Chart from 'primevue/chart';
import ProgressSpinner from 'primevue/progressspinner';
import GanttChart from '@/components/planning/GanttChart.vue';
import { apiV5 } from '@/api/v5';
import { plannerText } from '@/utils/plannerTerminology';
import { chartColorAt, mergeChartOptions, qualitativeChartColors } from '@/utils/chartColors';

const loading = ref(false);
const data = ref(null);
const lineId = ref('PACK_LINE_01');
const twinHorizon = ref(7);
const whatIfOrder = ref('FG-20001');
const shiftDays = ref(2);
const whatIfLine = ref(null);
const whatIfLoading = ref(false);
const whatIfResult = ref(null);

const lineOptions = [
  { label: 'Pack Line 01', value: 'PACK_LINE_01' },
  { label: 'Pack Line 02', value: 'PACK_LINE_02' },
];

const capacityChart = computed(() => {
  const util = data.value?.capacity?.lineUtilization || [];
  const labels = util.map((l) => l.lineId);
  return {
    labels,
    datasets: [{
      label: 'Avg Utilization %',
      data: util.map((l) => l.avgUtilizationPercent),
      backgroundColor: labels.length === 1
        ? chartColorAt(5)
        : qualitativeChartColors(labels.length),
    }],
  };
});

const capacityChartOpts = computed(() => mergeChartOptions());

function cp(row, checkpoint) {
  const c = row.checkpoints?.find((x) => x.checkpoint === checkpoint);
  return c ? `${c.rmslMonths} mo (${c.percentOfThreshold}%)` : '—';
}

function priSev(p) { return { HIGH: 'danger', MEDIUM: 'warn', LOW: 'success' }[p] || 'info'; }
function riskSev(l) { return { HIGH: 'danger', MEDIUM: 'warn', LOW: 'success' }[l] || 'info'; }

async function load() {
  loading.value = true;
  try {
    data.value = await apiV5.dashboard(lineId.value, twinHorizon.value);
  } finally {
    loading.value = false;
  }
}

async function loadTwin() {
  if (data.value) {
    data.value.digitalTwin = await apiV5.twin(twinHorizon.value);
  }
}

async function runWhatIf() {
  whatIfLoading.value = true;
  try {
    whatIfResult.value = await apiV5.whatIf({
      packagingOrderId: whatIfOrder.value,
      shiftDays: shiftDays.value,
      productionLine: whatIfLine.value,
    });
  } finally {
    whatIfLoading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.planning-hub { display: flex; flex-direction: column; gap: 16px; }
.ph-header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
.ph-toolbar { display: flex; gap: 8px; }
.loading { display: flex; justify-content: center; padding: 48px; }
.cap-summary { display: flex; gap: 20px; margin-bottom: 12px; font-size: 0.875rem; }
.cap-chart { height: 220px; }
.twin-kpis { display: flex; gap: 24px; margin-bottom: 12px; font-size: 0.875rem; }
.whatif-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.market-block { margin-bottom: 20px; }
.warn-list { margin: 0; padding-left: 20px; font-size: 0.8125rem; }
.mt-3 { margin-top: 16px; }
</style>
