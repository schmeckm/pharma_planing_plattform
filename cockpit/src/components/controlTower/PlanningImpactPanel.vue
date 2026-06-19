<template>
  <div class="planning-impact-panel">
    <div class="pi-executive">
      <KpiCard
        label="Activations"
        :value="data?.summary?.activationCount ?? 0"
        icon="Check"
        accent="primary"
      />
      <KpiCard
        label="Late avoided"
        :value="data?.summary?.lateOrdersAvoided ?? 0"
        icon="Timer"
        accent="success"
      />
      <KpiCard
        label="RMSL reduced"
        :value="data?.summary?.rmslViolationsReduced ?? 0"
        icon="Shield"
        accent="success"
      />
      <KpiCard
        label="Risk improved"
        :value="data?.summary?.riskScoreImprovement ?? 0"
        icon="TrendCharts"
        accent="info"
      />
      <KpiCard
        v-if="data?.summary?.ordersMoved"
        label="Orders moved"
        :value="data.summary.ordersMoved"
        icon="Sort"
        accent="primary"
      />
    </div>

    <div class="pi-toolbar">
      <SelectButton
        v-model="scope"
        :options="scopeOptions"
        option-label="label"
        option-value="value"
        @change="reload"
      />
      <SelectButton
        v-model="groupBy"
        :options="groupOptions"
        option-label="label"
        option-value="value"
        @change="reload"
      />
      <Dropdown
        v-model="filterPortfolio"
        :options="portfolioOptions"
        placeholder="All portfolios"
        show-clear
        class="pi-filter"
        @change="reload"
      />
      <Dropdown
        v-model="filterMrp"
        :options="mrpOptions"
        placeholder="All MRP"
        show-clear
        class="pi-filter"
        @change="reload"
      />
      <Dropdown
        v-model="filterLine"
        :options="lineOptions"
        placeholder="All lines"
        show-clear
        class="pi-filter"
        @change="reload"
      />
      <Button label="Refresh" icon="pi pi-refresh" size="small" outlined :loading="loading" @click="reload" />
      <RouterLink to="/line-optimization" class="pi-seq-link">→ Open sequencing</RouterLink>
    </div>

    <div v-if="loading && !data" class="loading"><ProgressSpinner style="width: 32px; height: 32px" /></div>

    <template v-else-if="data">
      <Card class="pi-card">
        <template #title>Roll-up: {{ groupLabel }}</template>
        <template #content>
          <DataTable :value="data.groups || []" size="small" striped-rows>
            <Column field="label" header="Area" />
            <Column field="orderCount" header="Orders" />
            <Column field="ordersMoved" header="Moved" />
            <Column field="lateOrdersAvoided" header="Late avoided" />
            <Column field="rmslViolationsReduced" header="RMSL ↓" />
            <Column field="riskScoreImprovement" header="Risk ↓" />
            <Column field="activationCount" header="Runs" />
            <Column header="Drill-down" style="width: 8rem">
              <template #body="{ data: row }">
                <RouterLink :to="drillDownRoute(row)" class="pi-drill-link">Sequencing →</RouterLink>
              </template>
            </Column>
          </DataTable>
          <p v-if="!data.groups?.length" class="empty">No activated plans in this period yet.</p>
        </template>
      </Card>

      <Card class="pi-card">
        <template #title>Recent planning activations</template>
        <template #content>
          <DataTable :value="data.recentEvents || []" size="small" striped-rows>
            <Column field="timestamp" header="Time">
              <template #body="{ data: row }">{{ formatTime(row.timestamp) }}</template>
            </Column>
            <Column field="userName" header="Planner" />
            <Column field="eventType" header="Type" />
            <Column field="itemCount" header="Orders" />
            <Column header="Late">
              <template #body="{ data: row }">
                {{ row.aggregates?.lateOrdersBefore }} → {{ row.aggregates?.lateOrdersAfter }}
              </template>
            </Column>
            <Column header="Risk">
              <template #body="{ data: row }">
                {{ row.aggregates?.riskScoreBefore }} → {{ row.aggregates?.riskScoreAfter }}
              </template>
            </Column>
            <Column field="comparisonSummary" header="Summary" />
          </DataTable>
        </template>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dropdown from 'primevue/dropdown';
import ProgressSpinner from 'primevue/progressspinner';
import SelectButton from 'primevue/selectbutton';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import { apiV4 } from '@/api/v4';

const props = defineProps({
  horizonDays: { type: Number, default: 7 },
  initialData: { type: Object, default: null },
});

const loading = ref(false);
const data = ref(props.initialData);
const scope = ref('all');
const groupBy = ref('productPortfolio');
const filterPortfolio = ref(null);
const filterMrp = ref(null);
const filterLine = ref(null);

const scopeOptions = [
  { label: 'All', value: 'all' },
  { label: 'My area', value: 'mine' },
];

const groupOptions = [
  { label: 'Portfolio', value: 'productPortfolio' },
  { label: 'MRP controller', value: 'mrpController' },
  { label: 'Scheduler', value: 'detailedScheduler' },
  { label: 'Line', value: 'productionLine' },
  { label: 'Planning area', value: 'planningArea' },
];

const groupLabel = computed(() => groupOptions.find((o) => o.value === groupBy.value)?.label || groupBy.value);

const portfolioOptions = computed(() => (data.value?.filterOptions?.productPortfolios || []).map((v) => ({ label: v, value: v })));
const mrpOptions = computed(() => (data.value?.filterOptions?.mrpControllers || []).map((v) => ({ label: v, value: v })));
const lineOptions = computed(() => (data.value?.filterOptions?.productionLines || []).map((v) => ({ label: v, value: v })));

function drillDownRoute(row) {
  const query = {};
  if (groupBy.value === 'productPortfolio') query.portfolio = row.key;
  else if (groupBy.value === 'mrpController') query.mrp = row.key;
  else if (groupBy.value === 'detailedScheduler') query.scheduler = row.key;
  else if (groupBy.value === 'productionLine') query.line = row.key;
  else if (groupBy.value === 'planningArea') query.area = row.key;
  if (filterPortfolio.value) query.portfolio = filterPortfolio.value;
  if (filterMrp.value) query.mrp = filterMrp.value;
  if (filterLine.value) query.line = filterLine.value;
  return { path: '/line-optimization', query };
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

async function reload() {
  loading.value = true;
  try {
    data.value = await apiV4.planningImpact({
      scope: scope.value,
      groupBy: groupBy.value,
      horizonDays: props.horizonDays,
      sinceDays: props.horizonDays,
      productPortfolio: filterPortfolio.value || undefined,
      mrpController: filterMrp.value || undefined,
      productionLine: filterLine.value || undefined,
    });
  } finally {
    loading.value = false;
  }
}

watch(() => props.horizonDays, () => reload());

onMounted(() => {
  if (!data.value) reload();
});

defineExpose({ reload });
</script>

<style scoped>
.planning-impact-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pi-executive {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.pi-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.pi-filter {
  min-width: 9rem;
}

.pi-seq-link {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--color-accent);
  text-decoration: none;
}

.pi-seq-link:hover {
  text-decoration: underline;
}

.pi-drill-link {
  font-size: 0.8rem;
  color: var(--color-accent);
  text-decoration: none;
}

.pi-drill-link:hover {
  text-decoration: underline;
}

.pi-card {
  margin-top: 0;
}

.empty {
  margin: 0.5rem 0 0;
  color: #64748b;
  font-size: 0.85rem;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}
</style>
