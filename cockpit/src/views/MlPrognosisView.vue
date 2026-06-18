<template>

  <div class="prognosis">

    <p class="page-subtitle">

      {{ t('mlPrognosis.subtitle') }}

    </p>



    <div class="toolbar">

      <el-radio-group v-model="horizon" size="small">

        <el-radio-button :value="7">T+7</el-radio-button>

        <el-radio-button :value="30">T+30</el-radio-button>

        <el-radio-button :value="90">T+90</el-radio-button>

      </el-radio-group>

      <el-button size="small" :loading="loading" @click="load">{{ t('common.refresh') }}</el-button>

    </div>



    <div v-if="data" class="kpi-grid">

      <KpiCard

        :label="t('mlPrognosis.trainedOn')"

        :value="data.trainedOn?.completedOrders ?? 0"

        :suffix="t('mlPrognosis.completedOrdersSuffix')"

        icon="Finished"

      />

      <KpiCard

        :label="t('mlPrognosis.openOrders')"

        :value="data.trainedOn?.openOrders ?? 0"

        icon="List"

        accent="neutral"

      />

      <KpiCard

        :label="t('mlPrognosis.onTimeRate')"

        :value="pct(data.methodology?.onTimeRate)"

        icon="TrendCharts"

        accent="neutral"

      />

      <KpiCard

        :label="t('mlPrognosis.bottleneckRisk')"

        :value="capacity?.bottleneckLikely ? t('common.yes') : t('common.no')"

        icon="Warning"

        :accent="capacity?.bottleneckLikely ? 'warning' : 'success'"

      />

      <KpiCard

        :label="t('mlPrognosis.highRiskOrders')"

        :value="highRiskCount"

        icon="Warning"

        accent="warning"

      />

    </div>



    <div v-if="data" class="panel algorithm-panel">

      <div class="panel-header">

        <h2>{{ t('mlPrognosis.algorithmTitle') }}</h2>

        <el-tag size="small" effect="plain">{{ data.engine }}</el-tag>

      </div>

      <div class="panel-body">

        <p class="algorithm-intro">

          {{ data.modelType }} — {{ t('mlPrognosis.referenceDate') }} <strong>{{ data.referenceDate }}</strong>.

          {{ t('mlPrognosis.advisorNote') }}

        </p>

        <div v-if="capacity" class="capacity-block">

          <div class="capacity-strip">

            <span>{{ t('mlPrognosis.capacityT', { horizon }) }}</span>

            <strong>{{ capacity.projectedUtilizationPercent }} %</strong> {{ t('mlPrognosis.utilization') }}

            <span class="muted">

              ({{ capacity.recentCompletedQuantity }} / {{ capacity.theoreticalCapacity }} {{ t('common.units') }})

            </span>

          </div>

          <MlCapacityChart :capacity="capacity" :horizon="horizon" />

        </div>

        <el-collapse class="algorithm-collapse">

          <el-collapse-item

            v-for="mod in data.methodology?.modules || []"

            :key="mod.id"

            :title="moduleTitle(mod.id)"

            :name="mod.id"

          >

            <dl class="algo-detail">

              <dt>{{ t('common.method') }}</dt>

              <dd>{{ moduleMethod(mod.id) }}</dd>

              <dt v-if="moduleFormula(mod.id)">{{ t('common.formula') }}</dt>

              <dd v-if="moduleFormula(mod.id)"><code>{{ moduleFormula(mod.id) }}</code></dd>

              <dt v-if="moduleThresholds(mod.id)">{{ t('common.thresholds') }}</dt>

              <dd v-if="moduleThresholds(mod.id)">{{ moduleThresholds(mod.id) }}</dd>

            </dl>

          </el-collapse-item>

        </el-collapse>

      </div>

    </div>



    <div class="panel-grid">

      <div class="panel">

        <div class="panel-header"><h2>{{ t('mlPrognosis.demandForecast') }}</h2></div>

        <div class="panel-body">

          <MlDemandForecastChart :rows="demandChartRows" />

          <el-table :data="demandRows" stripe size="small" max-height="320">

            <el-table-column prop="materialNumber" :label="t('common.material')" width="110" />

            <el-table-column prop="trend" :label="t('common.trend')" width="90">

              <template #default="{ row }">

                <el-tag size="small" :type="trendType(row.trend)">{{ trendLabel(row.trend) }}</el-tag>

              </template>

            </el-table-column>

            <el-table-column prop="projectedWeeklyQuantity" :label="t('mlPrognosis.forecastPerWeek')" width="120" />

            <el-table-column prop="lastWeeklyQuantity" :label="t('mlPrognosis.lastWeek')" width="100" />

            <el-table-column prop="historicalWeeks" :label="t('common.weeks')" width="70" />

            <el-table-column label="R²" width="70">

              <template #default="{ row }">{{ row.modelR2 ?? '—' }}</template>

            </el-table-column>

            <el-table-column prop="openOrderQuantity" :label="t('common.open')" width="80" />

            <el-table-column :label="t('common.confidence')" width="90">

              <template #default="{ row }">{{ pct(row.confidence) }}</template>

            </el-table-column>

          </el-table>

        </div>

      </div>



      <div class="panel">

        <div class="panel-header"><h2>{{ t('mlPrognosis.oeeForecast') }}</h2></div>

        <div class="panel-body">

          <MlOeeForecastChart :rows="oeeChartRows" />

          <el-table :data="oeeRows" stripe size="small" max-height="320">

            <el-table-column prop="lineId" :label="t('common.line')" width="120" />

            <el-table-column prop="shiftId" :label="t('common.shift')" width="100">

              <template #default="{ row }">{{ shiftLabel(row.shiftId) }}</template>

            </el-table-column>

            <el-table-column :label="t('mlPrognosis.histOee')" width="90">

              <template #default="{ row }">{{ row.historicalOee ?? '—' }}%</template>

            </el-table-column>

            <el-table-column :label="t('common.forecast')" width="90">

              <template #default="{ row }">{{ row.projectedOee ?? '—' }}%</template>

            </el-table-column>

            <el-table-column :label="t('common.confidence')" width="90">

              <template #default="{ row }">{{ pct(row.confidence) }}</template>

            </el-table-column>

            <el-table-column prop="runs" :label="t('common.runs')" width="70" />

          </el-table>

        </div>

      </div>

    </div>



    <div class="panel">

      <div class="panel-header"><h2>{{ t('mlPrognosis.orderRisk') }}</h2></div>

      <div class="panel-body">

        <MlRiskCharts :rows="riskChartRows" />

        <el-table :data="riskRows" stripe size="small">

          <el-table-column prop="packagingOrderId" :label="t('common.order')" width="120" />

          <el-table-column prop="destinationCountry" :label="t('common.market')" width="70" />

          <el-table-column :label="t('mlPrognosis.overall')" width="80">

            <template #default="{ row }">{{ pct(row.overallRiskProbability) }}</template>

          </el-table-column>

          <el-table-column :label="t('mlPrognosis.delay')" width="80">

            <template #default="{ row }">{{ pct(row.delayProbability) }}</template>

          </el-table-column>

          <el-table-column label="RMSL" width="80">

            <template #default="{ row }">{{ pct(row.rmslViolationProbability) }}</template>

          </el-table-column>

          <el-table-column prop="suggestedTier" :label="t('common.tier')" width="90">

            <template #default="{ row }">

              <el-tag size="small" :type="tierType(row.suggestedTier)">{{ row.suggestedTier }}</el-tag>

            </template>

          </el-table-column>

        </el-table>

        <p class="hint">{{ t('mlPrognosis.riskHint') }}</p>

      </div>

    </div>



    <div v-if="data?.forecastReconciliation?.length" class="panel">

      <div class="panel-header"><h2>{{ t('mlPrognosis.sapVsMl') }}</h2></div>

      <div class="panel-body panel-body--flush">

        <el-table :data="data.forecastReconciliation" stripe size="small">

          <el-table-column prop="materialNumber" :label="t('common.material')" width="110" />

          <el-table-column prop="sapForecastQuantity" :label="t('mlPrognosis.sapForecast')" width="110" />

          <el-table-column prop="mlProjectedMonthlyQuantity" :label="t('mlPrognosis.mlMonth')" width="100" />

          <el-table-column prop="alignment" :label="t('mlPrognosis.reconciliation')" width="110">

            <template #default="{ row }">{{ alignmentLabel(row.alignment) }}</template>

          </el-table-column>

        </el-table>

      </div>

    </div>

  </div>

</template>



<script setup>

import { ref, computed, onMounted } from 'vue';

import { ElMessage } from 'element-plus';

import KpiCard from '@/components/dashboard/KpiCard.vue';

import MlDemandForecastChart from '@/components/charts/MlDemandForecastChart.vue';

import MlOeeForecastChart from '@/components/charts/MlOeeForecastChart.vue';

import MlRiskCharts from '@/components/charts/MlRiskCharts.vue';

import MlCapacityChart from '@/components/charts/MlCapacityChart.vue';

import { apiV3 } from '@/api/v3';

import { useI18n } from '@/composables/useI18n';



const { t } = useI18n();



const loading = ref(false);

const horizon = ref(30);

const data = ref(null);



const horizonBlock = computed(() =>

  data.value?.horizons?.find((h) => h.horizonDays === horizon.value),

);



const demandChartRows = computed(() => horizonBlock.value?.demandForecasts || []);

const oeeChartRows = computed(() => horizonBlock.value?.oeeForecasts || []);

const riskChartRows = computed(() => horizonBlock.value?.riskProbabilities || []);

const demandRows = computed(() => demandChartRows.value.slice(0, 15));

const oeeRows = computed(() => oeeChartRows.value.slice(0, 15));

const riskRows = computed(() => riskChartRows.value.slice(0, 20));

const capacity = computed(() => horizonBlock.value?.capacityOutlook || null);



const highRiskCount = computed(() =>

  (horizonBlock.value?.riskProbabilities || []).filter((r) => r.suggestedTier === 'HIGH').length,

);



function moduleTitle(id) {

  return t(`mlPrognosis.modules.${id}.title`);

}



function moduleMethod(id) {

  return t(`mlPrognosis.modules.${id}.method`);

}



function moduleFormula(id) {

  const val = t(`mlPrognosis.modules.${id}.formula`);

  return val === `mlPrognosis.modules.${id}.formula` ? null : val;

}



function moduleThresholds(id) {

  const val = t(`mlPrognosis.modules.${id}.thresholds`);

  return val === `mlPrognosis.modules.${id}.thresholds` ? null : val;

}



function trendLabel(trend) {

  return t(`common.trends.${trend}`) !== `common.trends.${trend}` ? t(`common.trends.${trend}`) : trend;

}



function shiftLabel(shiftId) {

  return t(`common.shifts.${shiftId}`) !== `common.shifts.${shiftId}` ? t(`common.shifts.${shiftId}`) : shiftId;

}



function alignmentLabel(alignment) {

  return t(`common.alignment.${alignment}`) !== `common.alignment.${alignment}` ? t(`common.alignment.${alignment}`) : alignment;

}



function pct(v) {

  if (v == null) return '—';

  return `${Math.round(v * 100)}%`;

}



function trendType(trend) {

  return { UP: 'success', DOWN: 'danger', STABLE: 'info' }[trend] || 'info';

}



function tierType(tier) {

  return { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' }[tier] || 'info';

}



async function load() {

  loading.value = true;

  try {

    data.value = await apiV3.mlPrognosis([7, 30, 90]);

  } catch (e) {

    ElMessage.error(e.message);

  } finally {

    loading.value = false;

  }

}



onMounted(load);

</script>



<style scoped>

.prognosis .toolbar {

  display: flex;

  gap: 12px;

  margin-bottom: 16px;

  align-items: center;

}

.kpi-grid {

  display: grid;

  grid-template-columns: repeat(5, 1fr);

  gap: 12px;

  margin-bottom: 16px;

}

.algorithm-panel {

  margin-bottom: 16px;

}

.algorithm-intro {

  margin: 0 0 12px;

  font-size: 0.875rem;

  line-height: 1.55;

  color: var(--color-text-muted);

}

.capacity-block {

  margin-bottom: 12px;

}

.capacity-strip {

  display: flex;

  flex-wrap: wrap;

  gap: 8px;

  align-items: baseline;

  margin-bottom: 8px;

  padding: 10px 12px;

  border-radius: 8px;

  background: var(--color-surface, #f4f7fb);

  font-size: 0.8125rem;

}

.capacity-strip .muted {

  color: var(--color-text-muted);

}

.algo-detail {

  margin: 0;

  font-size: 0.8125rem;

  line-height: 1.5;

}

.algo-detail dt {

  font-weight: 600;

  margin-top: 8px;

  color: var(--color-text);

}

.algo-detail dt:first-child {

  margin-top: 0;

}

.algo-detail dd {

  margin: 4px 0 0;

  color: var(--color-text-muted);

}

.algo-detail code {

  display: block;

  margin-top: 4px;

  padding: 8px 10px;

  border-radius: 6px;

  background: #0a254008;

  font-size: 0.75rem;

  word-break: break-word;

}

.algorithm-collapse {

  border: none;

}

.panel-grid {

  display: grid;

  grid-template-columns: 1fr 1fr;

  gap: 16px;

  margin-bottom: 16px;

}

.hint {

  font-size: 0.8125rem;

  color: var(--color-text-muted);

  padding: 8px 12px;

}

@media (max-width: 900px) {

  .kpi-grid, .panel-grid { grid-template-columns: 1fr; }

}

@media (max-width: 1200px) {

  .kpi-grid { grid-template-columns: repeat(2, 1fr); }

}

</style>

