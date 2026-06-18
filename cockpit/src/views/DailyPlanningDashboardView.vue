<template>
  <div class="daily-planning">
    <WizardReturnBar />
    <p class="page-subtitle">
      Daily production planning — convert rough planned orders into a detailed packaging line sequence
    </p>

    <div class="dp-toolbar">
      <el-date-picker
        v-model="selectedDate"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="Planning date"
        size="default"
        @change="onDateChange"
      />
      <el-button type="primary" :loading="store.loading" @click="store.loadDashboard()">
        Refresh
      </el-button>
      <el-button @click="$router.push('/line-optimization')">
        Open Production Sequencing →
      </el-button>
    </div>

    <div class="dp-kpis">
      <KpiCard
        v-for="k in store.kpiCards"
        :key="k.label"
        :label="k.label"
        :value="k.value"
        :suffix="k.suffix"
        :accent="k.accent"
      />
    </div>

    <div class="dp-reco panel" v-if="store.recommendations">
      <div class="panel-header">
        <h2>Planner Recommendations</h2>
      </div>
      <div class="panel-body reco-grid">
        <div class="reco-card">
          <h3>{{ PLANNER_LABELS.RECOMMENDED_SEQUENCE }}</h3>
          <ol class="reco-list">
            <li v-for="(item, i) in store.recommendations.sequence?.slice(0, 5)" :key="item.packagingOrder || item.packagingOrderId">
              {{ i + 1 }}. {{ item.packagingOrder || item.packagingOrderId }}
              <span class="reco-meta">{{ item.productionLine }} · {{ item.plannedStartDate }}</span>
            </li>
          </ol>
          <el-button link type="primary" @click="$router.push('/line-optimization')">Open Gantt →</el-button>
        </div>
        <div class="reco-card">
          <h3>Recommended Production Line</h3>
          <ul class="reco-list">
            <li v-for="line in store.recommendations.lines" :key="line.materialNumber">
              <strong>{{ line.materialNumber }}</strong> → {{ line.recommendedLineId || '—' }}
              <span v-if="line.lineScore" class="reco-meta">Score {{ line.lineScore }}</span>
            </li>
          </ul>
        </div>
        <div class="reco-card">
          <h3>Recommended Batch</h3>
          <ul class="reco-list">
            <li v-for="b in store.recommendations.batches?.slice(0, 5)" :key="b.packagingOrderId">
              {{ b.packagingOrderId }} → {{ b.recommendedBatchId || '—' }}
              <RiskBadge v-if="b.riskLevel" :level="b.riskLevel" />
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="panel dp-util" v-if="store.lineUtilization?.length">
      <div class="panel-header"><h2>Line Utilization</h2></div>
      <div class="panel-body util-bars">
        <div v-for="line in store.lineUtilization" :key="line.lineId" class="util-row">
          <span class="util-label">{{ line.lineName || line.lineId }}</span>
          <div class="util-track">
            <div class="util-fill" :style="{ width: Math.min(100, line.utilizationPercent || line.avgUtilizationPercent || 0) + '%' }" />
          </div>
          <span class="util-pct">{{ line.utilizationPercent ?? line.avgUtilizationPercent ?? 0 }}%</span>
        </div>
      </div>
    </div>

    <div class="dp-grid">
      <div class="panel dp-orders">
        <div class="panel-header">
          <h2>Rough Planned Orders</h2>
          <span class="badge">{{ store.orders.length }} orders</span>
        </div>
        <div class="panel-body panel-body--flush">
          <el-table :data="store.orders" stripe size="small" @row-click="onRowClick">
            <el-table-column prop="packagingOrder" label="PO" width="110" />
            <el-table-column prop="destinationCountry" label="Country" width="70" />
            <el-table-column prop="productionLine" label="Line" width="130" />
            <el-table-column prop="plannedStartDate" label="Start" width="100" />
            <el-table-column prop="plannedEndDate" label="End" width="100" />
            <el-table-column prop="priority" label="Priority" width="90" />
            <el-table-column prop="durationHours" label="Hours" width="70" />
            <el-table-column label="Risk" width="80">
              <template #default="{ row }">
                <RiskBadge :level="riskLevel(row)" />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div class="panel dp-exceptions">
        <div class="panel-header">
          <h2>{{ PLANNER_LABELS.PLANNING_EXCEPTIONS }}</h2>
          <el-button link type="primary" @click="$router.push('/exceptions')">View all {{ PLANNER_LABELS.PLANNING_EXCEPTIONS }} →</el-button>
        </div>
        <div class="panel-body">
          <ul v-if="store.exceptions.length" class="exc-list">
            <li v-for="ex in store.exceptions.slice(0, 8)" :key="ex.exceptionId">
              <strong>{{ ex.packagingOrderId }}</strong>
              <span>{{ ex.typeLabel || ex.message }}</span>
            </li>
          </ul>
          <p v-else class="empty">No planning exceptions for this date</p>
        </div>
      </div>
    </div>

    <div class="panel dp-gantt">
      <div class="panel-header">
        <h2>Line Schedule Preview</h2>
      </div>
      <div class="panel-body">
        <SwimlaneGantt
          v-if="store.ganttTasks.length"
          :tasks="store.ganttTasks"
          :lines="store.lines"
          :timeline-start="store.timelineStart"
          :timeline-end="store.timelineEnd"
          @select="onGanttSelect"
        />
        <p v-else class="empty">No schedule data — open Production Sequencing to build a sequence</p>
      </div>
    </div>

    <div class="dp-actions">
      <el-button type="primary" @click="$router.push('/line-optimization')">
        Production Sequencing
      </el-button>
      <el-button @click="$router.push('/what-if')">{{ PLANNER_LABELS.WHAT_IF_SIMULATION }}</el-button>
      <el-button @click="$router.push('/simulation')">{{ PLANNER_LABELS.BATCH_RECOMMENDATIONS }}</el-button>
      <el-button @click="$router.push('/confirmed-assignments')">Confirmed Batch Assignments</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import WizardReturnBar from '@/components/wizard/WizardReturnBar.vue';
import RiskBadge from '@/components/shared/RiskBadge.vue';
import SwimlaneGantt from '@/components/lineOptimization/SwimlaneGantt.vue';
import { useDailyPlanningStore } from '@/stores/dailyPlanning';
import { PLANNER_LABELS } from '@/utils/plannerTerminology';

const store = useDailyPlanningStore();
const router = useRouter();
const selectedDate = ref(store.planningDate);

function riskLevel(row) {
  if ((row.riskScore || 0) >= 30) return 'HIGH';
  if (row.allocationStatus === 'AT_RISK') return 'MEDIUM';
  return 'LOW';
}

function onDateChange(val) {
  store.loadDashboard(val);
}

function onRowClick(row) {
  router.push('/line-optimization');
  store.selectTask({ id: row.packagingOrder || row.packagingOrderId });
}

function onGanttSelect(task) {
  store.selectTask(task);
}

onMounted(() => store.loadDashboard(selectedDate.value));
</script>

<style scoped>
.daily-planning { display: flex; flex-direction: column; gap: 16px; }
.dp-toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.dp-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.dp-grid { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
.panel { background: var(--color-bg, #fff); border: 1px solid var(--color-border, #ddd); border-radius: 8px; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--color-border, #eee); }
.panel-header h2 { margin: 0; font-size: 0.9375rem; }
.panel-body { padding: 16px; }
.panel-body--flush { padding: 0; }
.badge { font-size: 0.75rem; color: var(--text-color-secondary); }
.exc-list { list-style: none; margin: 0; padding: 0; }
.exc-list li { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-bottom: 1px solid var(--color-border, #eee); font-size: 0.8125rem; }
.exc-list li span { color: var(--text-color-secondary); font-size: 0.75rem; }
.empty { color: var(--text-color-secondary); font-size: 0.875rem; margin: 0; }
.reco-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.reco-card h3 { margin: 0 0 8px; font-size: var(--text-sm); color: var(--color-text-muted, #6a6d70); }
.reco-list { margin: 0; padding-left: 18px; font-size: var(--text-base); }
.reco-list li { margin-bottom: 6px; }
.reco-meta { display: block; font-size: var(--text-xs); color: var(--color-text-muted, #6a6d70); }
.util-bars { display: flex; flex-direction: column; gap: 10px; }
.util-row { display: grid; grid-template-columns: 140px 1fr 48px; gap: 10px; align-items: center; font-size: var(--text-sm); }
.util-track { height: 8px; background: #eee; border-radius: 4px; overflow: hidden; }
.util-fill { height: 100%; background: var(--color-accent, #0a6ed1); border-radius: 4px; }
.util-pct { text-align: right; font-weight: 600; }
.dp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
@media (max-width: 1100px) {
  .reco-grid { grid-template-columns: 1fr; }
}
@media (max-width: 1100px) {
  .dp-grid { grid-template-columns: 1fr; }
}
</style>
