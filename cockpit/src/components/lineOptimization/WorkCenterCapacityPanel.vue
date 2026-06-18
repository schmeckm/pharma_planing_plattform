<template>
  <div class="wc-capacity panel">
    <div class="panel-header wc-cap-header">
      <h2>Work center capacity</h2>
      <span v-if="capacity?.summary" class="wc-cap-meta">
        Peak {{ capacity.summary.peakUtilization }}% ·
        {{ capacity.summary.bottleneckDays }} bottleneck day-slots
      </span>
    </div>

    <div v-if="alerts.length" class="wc-alerts">
      <div v-for="(a, i) in alerts" :key="i" class="wc-alert" :class="`wc-alert--${a.severity?.toLowerCase()}`">
        {{ a.message }}
      </div>
    </div>

    <p class="wc-hint">
      <strong>Capacity</strong> = hard limit (hours/day per work center).
      <strong>OEE / performance factor</strong> adjusts duration only — it does not replace capacity checks.
    </p>

    <div v-if="utilization.length" class="panel-body wc-bars">
      <div v-for="wc in utilization" :key="wc.workCenterId" class="wc-row">
        <span class="wc-label" :class="{ 'wc-bn': wc.isBottleneck }">
          {{ wc.isBottleneck ? '⦿ ' : '' }}{{ wc.workCenterName || wc.workCenterId }}
        </span>
        <div class="wc-track">
          <div
            class="wc-fill"
            :class="fillClass(wc.peakUtilizationPercent)"
            :style="{ width: Math.min(100, wc.peakUtilizationPercent || 0) + '%' }"
          />
        </div>
        <span class="wc-pct">peak {{ wc.peakUtilizationPercent ?? 0 }}%</span>
        <span class="wc-avg">avg {{ wc.avgUtilizationPercent ?? 0 }}%</span>
      </div>
    </div>

    <div v-if="heatmapDays.length" class="wc-heatmap-wrap">
      <table class="wc-heatmap">
        <thead>
          <tr>
            <th>Work center</th>
            <th v-for="d in heatmapDays" :key="d">{{ shortDate(d) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="wc in utilization" :key="'hm-' + wc.workCenterId">
            <td class="wc-hm-label" :class="{ 'wc-bn': wc.isBottleneck }">
              {{ wc.workCenterId }}
            </td>
            <td
              v-for="d in heatmapDays"
              :key="wc.workCenterId + d"
              class="wc-cell"
              :class="cellClass(wc.workCenterId, d)"
              :title="cellTitle(wc.workCenterId, d)"
            >
              {{ cellPct(wc.workCenterId, d) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  capacity: { type: Object, default: null },
});

const utilization = computed(() => props.capacity?.workCenterUtilization || []);
const alerts = computed(() => props.capacity?.alerts || []);

const heatmapDays = computed(() => {
  const days = [...new Set((props.capacity?.heatmap || []).map((h) => h.date))];
  return days.slice(0, 14);
});

const heatmapMap = computed(() => {
  const m = {};
  for (const h of props.capacity?.heatmap || []) {
    m[`${h.workCenterId}|${h.date}`] = h;
  }
  return m;
});

function shortDate(iso) {
  if (!iso) return '';
  return iso.slice(5);
}

function cellPct(wcId, date) {
  const h = heatmapMap.value[`${wcId}|${date}`];
  if (!h) return '—';
  return h.utilizationPercent >= 10 ? `${Math.round(h.utilizationPercent)}%` : '';
}

function cellClass(wcId, date) {
  const h = heatmapMap.value[`${wcId}|${date}`];
  if (!h) return 'wc-cell--empty';
  if (h.status === 'BOTTLENECK') return 'wc-cell--bn';
  if (h.status === 'HIGH') return 'wc-cell--high';
  return 'wc-cell--ok';
}

function cellTitle(wcId, date) {
  const h = heatmapMap.value[`${wcId}|${date}`];
  if (!h) return '';
  return `${h.usedHours}h / ${h.maxHours}h · ${h.operationCount} ops`;
}

function fillClass(pct) {
  if (pct > 90) return 'wc-fill--bn';
  if (pct > 75) return 'wc-fill--high';
  return 'wc-fill--ok';
}
</script>

<style scoped>
.wc-capacity {
  margin-top: 8px;
}

.wc-cap-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border, #eee);
}

.wc-cap-header h2 {
  margin: 0;
  font-size: 0.9375rem;
}

.wc-cap-meta {
  font-size: 0.75rem;
  color: var(--p-text-muted-color, #64748b);
}

.wc-hint {
  margin: 0;
  padding: 0.5rem 1rem;
  font-size: 0.72rem;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.wc-alerts {
  padding: 0.5rem 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.wc-alert {
  font-size: 0.78rem;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
}

.wc-alert--high {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.wc-bars {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.wc-row {
  display: grid;
  grid-template-columns: 10rem 1fr 4rem 4rem;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.75rem;
}

.wc-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wc-bn {
  font-weight: 600;
  color: #b45309;
}

.wc-track {
  height: 10px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}

.wc-fill {
  height: 100%;
  border-radius: 4px;
}

.wc-fill--ok { background: #22c55e; }
.wc-fill--high { background: #f59e0b; }
.wc-fill--bn { background: #ef4444; }

.wc-pct, .wc-avg {
  font-size: 0.68rem;
  color: #64748b;
  text-align: right;
}

.wc-heatmap-wrap {
  padding: 0.75rem 1rem 1rem;
  overflow-x: auto;
}

.wc-heatmap {
  border-collapse: collapse;
  font-size: 0.65rem;
  width: 100%;
}

.wc-heatmap th,
.wc-heatmap td {
  border: 1px solid #e2e8f0;
  padding: 2px 4px;
  text-align: center;
}

.wc-hm-label {
  text-align: left;
  font-weight: 500;
  white-space: nowrap;
}

.wc-cell--empty { background: #fafafa; color: #cbd5e1; }
.wc-cell--ok { background: #f0fdf4; }
.wc-cell--high { background: #fffbeb; color: #92400e; }
.wc-cell--bn { background: #fef2f2; color: #991b1b; font-weight: 600; }
</style>
