<template>
  <div class="analytics">
    <p class="page-subtitle">
      Leistungsgrad-Analyse aus abgeschlossenen Verpackungsaufträgen — OEE, Durchsatz, Planungsfaktoren
    </p>

    <div class="toolbar">
      <el-radio-group v-model="horizon" size="small">
        <el-radio-button value="short">Kurzfrist ({{ shortDaysLabel }})</el-radio-button>
        <el-radio-button value="long">Langfrist ({{ longDaysLabel }})</el-radio-button>
      </el-radio-group>
      <el-select v-model="shiftFilter" size="small" class="shift-filter">
        <el-option label="Alle Schichten" value="" />
        <el-option label="Frühschicht" value="SHIFT_1" />
        <el-option label="Spätschicht" value="SHIFT_2" />
      </el-select>
      <el-button size="small" :loading="loading" @click="load">Aktualisieren</el-button>
    </div>

    <div class="kpi-grid">
      <KpiCard
        label="Abgeschlossene Aufträge"
        :value="analysis?.completedOrderCount ?? 0"
        icon="Finished"
      />
      <KpiCard
        label="Im Horizont"
        :value="horizonOrderCount"
        icon="Calendar"
        accent="neutral"
      />
      <KpiCard
        label="Ø OEE (Linien)"
        :value="avgOee"
        suffix="%"
        icon="TrendCharts"
        accent="success"
      />
      <KpiCard
        label="Schwächste Linie"
        :value="weakestLine?.lineId?.replace('PACK_', '') || '—'"
        icon="Warning"
        accent="warning"
      />
    </div>

    <div class="panel-grid">
      <div class="panel">
        <div class="panel-header"><h2>OEE & Leistungsfaktor pro Linie</h2></div>
        <div class="panel-body">
          <LineOeeBarChart v-if="analysis?.byLine?.length" :lines="analysis.byLine" :horizon="horizon" />
          <el-empty v-else description="Keine Analysedaten — Demo-Daten regenerieren" />
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Linien-Übersicht</h2></div>
        <div class="panel-body panel-body--flush">
          <el-table :data="analysis?.byLine || []" stripe size="small" max-height="280">
            <el-table-column prop="lineId" label="Linie" width="120" />
            <el-table-column label="OEE" width="70">
              <template #default="{ row }">{{ pct(horizon === 'short' ? row.shortTermOee : row.longTermOee) }}</template>
            </el-table-column>
            <el-table-column label="Faktor" width="80">
              <template #default="{ row }">{{ factor(horizon === 'short' ? row.shortTermFactor : row.longTermFactor) }}</template>
            </el-table-column>
            <el-table-column label="Runs" width="70">
              <template #default="{ row }">{{ horizon === 'short' ? row.historicalRunsShort : row.historicalRunsLong }}</template>
            </el-table-column>
            <el-table-column label="Planung" min-width="120">
              <template #default="{ row }">
                <el-tag size="small" type="info">{{ horizon === 'short' ? 'Sequenz / Tag' : 'Kapazität / Programm' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><h2>Material × Linie × Schicht (historisch)</h2></div>
      <div class="panel-body panel-body--flush">
        <el-table :data="filteredMaterialLineShift" stripe size="small">
          <el-table-column prop="materialNumber" label="Material" width="110" />
          <el-table-column prop="lineId" label="Linie" width="120" />
          <el-table-column prop="shiftName" label="Schicht" width="110" />
          <el-table-column prop="runs" label="Runs" width="70" />
          <el-table-column label="OEE" width="70">
            <template #default="{ row }">{{ pct(row.averageOee) }}</template>
          </el-table-column>
          <el-table-column label="Durchsatz/h" width="100">
            <template #default="{ row }">{{ row.averageThroughput ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="Faktor" width="80">
            <template #default="{ row }">{{ factor(row.derivedPerformanceFactor) }}</template>
          </el-table-column>
          <el-table-column label="Pünktlich" width="90">
            <template #default="{ row }">{{ pct(row.onTimeDeliveryPercent) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><h2>Material × Linie (alle Schichten)</h2></div>
      <div class="panel-body panel-body--flush">
        <el-table :data="analysis?.byMaterialLine || []" stripe size="small">
          <el-table-column prop="materialNumber" label="Material" width="110" />
          <el-table-column prop="lineId" label="Linie" width="120" />
          <el-table-column prop="runs" label="Runs" width="70" />
          <el-table-column label="OEE" width="70">
            <template #default="{ row }">{{ pct(row.averageOee) }}</template>
          </el-table-column>
          <el-table-column label="Durchsatz/h" width="100">
            <template #default="{ row }">{{ row.averageThroughput ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="Yield" width="70">
            <template #default="{ row }">{{ pct(row.averageYield) }}</template>
          </el-table-column>
          <el-table-column label="Faktor" width="80">
            <template #default="{ row }">{{ factor(row.derivedPerformanceFactor) }}</template>
          </el-table-column>
          <el-table-column label="Pünktlich" width="90">
            <template #default="{ row }">{{ pct(row.onTimeDeliveryPercent) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Schicht-Historie (Zeitreihe)</h2>
        <span v-if="shiftHistory" class="meta">
          {{ shiftHistory.totalEntries }} Einträge · {{ shiftHistory.shiftMismatchCount }} Schicht-Abweichungen
        </span>
      </div>
      <div class="panel-body panel-body--flush">
        <el-table :data="shiftHistory?.byPeriodShift?.slice(0, 24) || []" stripe size="small">
          <el-table-column prop="period" label="Monat" width="90" />
          <el-table-column prop="lineId" label="Linie" width="120" />
          <el-table-column prop="shiftName" label="Schicht" width="110" />
          <el-table-column prop="runs" label="Runs" width="70" />
          <el-table-column label="OEE" width="70">
            <template #default="{ row }">{{ pct(row.averageOee) }}</template>
          </el-table-column>
          <el-table-column label="Pünktlich" width="90">
            <template #default="{ row }">{{ pct(row.onTimePercent) }}</template>
          </el-table-column>
          <el-table-column prop="qty" label="Menge" width="90" />
        </el-table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Historische Verpackungsaufträge</h2>
        <span class="meta">{{ historicalOrders.length }} abgeschlossen</span>
      </div>
      <div class="panel-body panel-body--flush">
        <el-table :data="filteredHistoricalOrders" stripe size="small">
          <el-table-column prop="packagingOrderId" label="Auftrag" width="120" />
          <el-table-column prop="productionLine" label="Linie" width="120" />
          <el-table-column prop="shiftName" label="Schicht" width="100" />
          <el-table-column prop="materialNumber" label="Material" width="100" />
          <el-table-column prop="quantity" label="Menge" width="80" />
          <el-table-column prop="plannedStartDate" label="Plan Start" width="110" />
          <el-table-column prop="actualEndDate" label="Ist Ende" width="110" />
          <el-table-column label="Plan h" width="70">
            <template #default="{ row }">{{ row.plannedDurationHours ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="Ist h" width="70">
            <template #default="{ row }">{{ row.actualDurationHours ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="Δ Leistung" width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.plannedDurationHours && row.actualDurationHours"
                size="small"
                :type="varianceTag(row)"
              >
                {{ variancePct(row) }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <p v-if="historicalOrders.length > 50" class="hint">
          Zeigt 50 von {{ historicalOrders.length }} — vollständige Liste über API
          <code>GET /api/v1/orders?status=COMPLETED</code>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import LineOeeBarChart from '@/components/charts/LineOeeBarChart.vue';
import { fetchHistoricalAnalysis, fetchShiftHistory } from '@/api/performance';
import { fetchOrders } from '@/api';
import { useHorizonSettingsStore } from '@/stores/horizonSettings';

const horizonSettings = useHorizonSettingsStore();
const loading = ref(false);
const horizon = ref('long');
const shiftFilter = ref('');
const analysis = ref(null);
const shiftHistory = ref(null);
const historicalOrders = ref([]);

const shortDaysLabel = computed(() => `${horizonSettings.performanceShortDays} Tage`);
const longDaysLabel = computed(() => `${horizonSettings.performanceLongDays} Tage`);

const filteredMaterialLineShift = computed(() => {
  const rows = analysis.value?.byMaterialLineShift || [];
  if (!shiftFilter.value) return rows;
  return rows.filter((r) => r.shiftId === shiftFilter.value);
});

const filteredHistoricalOrders = computed(() => {
  let rows = historicalOrders.value;
  if (shiftFilter.value) {
    rows = rows.filter((o) => o.shiftId === shiftFilter.value);
  }
  return rows.slice(0, 50);
});

const horizonOrderCount = computed(() => {
  if (!analysis.value) return 0;
  return horizon.value === 'short'
    ? analysis.value.horizons?.short?.orderCount ?? 0
    : analysis.value.horizons?.long?.orderCount ?? 0;
});

const avgOee = computed(() => {
  const rows = analysis.value?.byLine || [];
  if (!rows.length) return 0;
  const key = horizon.value === 'short' ? 'shortTermOee' : 'longTermOee';
  const vals = rows.map((r) => r[key]).filter((v) => v != null);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
});

const weakestLine = computed(() => {
  const rows = analysis.value?.byLine || [];
  if (!rows.length) return null;
  const key = horizon.value === 'short' ? 'shortTermOee' : 'longTermOee';
  return [...rows].sort((a, b) => (a[key] ?? 100) - (b[key] ?? 100))[0];
});

function pct(v) {
  return v == null ? '—' : `${v}%`;
}

function factor(v) {
  return v == null ? '—' : Number(v).toFixed(2);
}

function variancePct(row) {
  const pctVal = Math.round((row.plannedDurationHours / row.actualDurationHours) * 100);
  return `${pctVal}%`;
}

function varianceTag(row) {
  const ratio = row.plannedDurationHours / row.actualDurationHours;
  if (ratio >= 0.95) return 'success';
  if (ratio >= 0.85) return 'warning';
  return 'danger';
}

async function load() {
  loading.value = true;
  try {
    const [analysisData, orders, shiftData] = await Promise.all([
      fetchHistoricalAnalysis(),
      fetchOrders({ status: 'COMPLETED' }),
      fetchShiftHistory(365),
    ]);
    analysis.value = analysisData;
    shiftHistory.value = shiftData;
    historicalOrders.value = [...orders].sort(
      (a, b) => (b.actualEndDate || '').localeCompare(a.actualEndDate || ''),
    );
  } catch (err) {
    ElMessage.error(err.message || 'Analyse konnte nicht geladen werden');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await horizonSettings.load();
  await load();
});
</script>

<style scoped>
.analytics {
  max-width: 1400px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.shift-filter {
  width: 160px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.panel-body--flush {
  padding: 0 0 12px;
}

.meta {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.hint {
  padding: 8px 16px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

@media (max-width: 1100px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .panel-grid {
    grid-template-columns: 1fr;
  }
}
</style>
