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

    <p class="callout callout--muted wc-hint">
      <strong>Capacity</strong> = hard limit (hours/day per work center).
      <strong>OEE / performance factor</strong> adjusts duration only — it does not replace capacity checks.
    </p>

    <div v-if="utilization.length" class="panel-body wc-bars">
      <div v-for="wc in utilization" :key="wc.workCenterId" class="wc-row">
        <span class="wc-label" :class="{ 'text-emphasis-warning': wc.isBottleneck }">
          {{ wc.isBottleneck ? '⦿ ' : '' }}{{ wc.workCenterName || wc.workCenterId }}
        </span>
        <div class="util-track">
          <div
            class="util-fill"
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
            <td class="wc-hm-label" :class="{ 'text-emphasis-warning': wc.isBottleneck }">
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
  if (!h) return 'cap-cell--empty';
  if (h.status === 'BOTTLENECK') return 'cap-cell--critical';
  if (h.status === 'HIGH') return 'cap-cell--high';
  return 'cap-cell--ok';
}

function cellTitle(wcId, date) {
  const h = heatmapMap.value[`${wcId}|${date}`];
  if (!h) return '';
  return `${h.usedHours}h / ${h.maxHours}h · ${h.operationCount} ops`;
}

function fillClass(pct) {
  if (pct > 90) return 'util-fill--critical';
  if (pct > 75) return 'util-fill--high';
  return 'util-fill--ok';
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
}

.wc-cap-header h2 {
  margin: 0;
  font-size: 0.9375rem;
}

.wc-cap-meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
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
  background: var(--color-error-soft);
  border: 1px solid var(--color-error-border);
  color: var(--color-error-text);
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

.wc-pct, .wc-avg {
  font-size: 0.68rem;
  color: var(--color-text-muted);
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
  border: 1px solid var(--color-border);
  padding: 2px 4px;
  text-align: center;
}

.wc-hm-label {
  text-align: left;
  font-weight: 500;
  white-space: nowrap;
}
</style>
