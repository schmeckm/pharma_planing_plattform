<template>

  <div class="swimlane-gantt">

    <div v-if="showZoom" class="sg-zoom-bar">

      <span class="sg-zoom-label">Zoom</span>

      <SelectButton

        v-model="localGranularity"

        :options="GRANULARITY_OPTIONS"

        option-label="label"

        option-value="value"

        size="small"

      />

      <span v-if="hasDateTimeTasks" class="sg-zoom-hint">Hour precision available</span>

    </div>



    <div class="sg-header">

      <span class="sg-corner">{{ lineColumnLabel }}</span>

      <div class="sg-timeline-head">

        <div class="sg-timeline-rail">

          <span

            v-for="tick in ticks"

            :key="tick.index"

            class="sg-tick"

            :style="{ left: `${tick.leftPercent}%` }"

          >

            {{ tick.label }}

          </span>

        </div>

        <div class="sg-dates-range">

          <span>{{ rangeLabelStart }}</span>

          <span>{{ rangeLabelEnd }}</span>

        </div>

      </div>

    </div>



    <div

      v-for="line in lines"

      :key="line.lineId"

      class="sg-row"

      @dragover.prevent

      @drop="onDropLine($event, line.lineId)"

    >

      <div class="sg-line-label" :title="line.lineName">

        <span class="sg-line-id">{{ line.lineId }}</span>

        <span v-if="lineCounts[line.lineId]" class="sg-line-count">{{ lineCounts[line.lineId] }}</span>

      </div>

      <div class="sg-track" :style="trackStyle">

        <div

          v-for="task in tasksForLine(line.lineId)"

          :key="task.id"

          class="sg-bar"

          :class="barClasses(task)"

          draggable="true"

          :style="barStyle(task)"

          :title="tooltip(task)"

          @dragstart="onDragStart($event, task)"

          @click="$emit('select', task)"

        >

          <div v-if="timeSegments(task).length" class="sg-bar-segments">

            <span

              v-for="seg in timeSegments(task)"

              :key="seg.key"

              class="sg-bar-seg"

              :style="{ width: `${seg.pct}%`, background: seg.color }"

              :title="`${seg.label}: ${fmtSegHours(seg.hours)}`"

            />

          </div>

          <span class="sg-bar-label">{{ barLabel(task) }}</span>

        </div>

      </div>

    </div>



    <div v-if="showTimeLegend" class="sg-time-legend">

      <span class="sg-time-legend__title">{{ timeLegendTitle }}</span>

      <span

        v-for="item in legendItems"

        :key="item.key"

        class="sg-time-legend__item"

      >

        <span class="sg-time-legend__swatch" :style="{ background: item.color }" />

        {{ item.label }}

      </span>

    </div>

  </div>

</template>



<script setup>

import { ref, computed, watch } from 'vue';

import SelectButton from 'primevue/selectbutton';

import {

  GRANULARITY_OPTIONS,

  timelineWindow,

  computeBarMetrics,

  buildTimelineTicks,

  offsetToDateTime,

  tasksHaveDateTime,

  resolveTaskStart,

  resolveTaskEnd,

  parseGanttInstant,

  DAY_START_HOUR,

} from '@/utils/ganttTimeScale';

import {

  OP_TIME_COLORS,

  OP_TIME_LABELS,

  hasOperationTimeBreakdown,

  operationTimeSegments,

} from '@/utils/operationTimeColors';



const props = defineProps({

  tasks: { type: Array, default: () => [] },

  lines: { type: Array, default: () => [] },

  timelineStart: { type: String, default: '2026-09-01' },

  timelineEnd: { type: String, default: '2026-09-15' },

  selectedId: String,

  movedOrderIds: { type: Array, default: () => [] },

  movedOrderDetails: { type: Object, default: () => ({}) },

  lineColumnLabel: { type: String, default: 'Verpackungslinie' },

  showTimeLegend: { type: Boolean, default: false },

  timeLegendTitle: { type: String, default: 'Vorgangszeiten (SAP)' },

  granularity: { type: String, default: 'day' },

  showZoom: { type: Boolean, default: true },

});



const emit = defineEmits(['select', 'move', 'update:granularity']);



const legendItems = [

  { key: 'setup', label: OP_TIME_LABELS.setup, color: OP_TIME_COLORS.setup },

  { key: 'production', label: OP_TIME_LABELS.production, color: OP_TIME_COLORS.production },

  { key: 'teardown', label: OP_TIME_LABELS.teardown, color: OP_TIME_COLORS.teardown },

];



const dragTask = ref(null);

const localGranularity = ref(props.granularity);



watch(() => props.granularity, (v) => { localGranularity.value = v; });

watch(localGranularity, (v) => emit('update:granularity', v));



const hasDateTimeTasks = computed(() => tasksHaveDateTime(props.tasks));

const hasHourDurationTasks = computed(() =>
  (props.tasks || []).some((t) => t.durationHours != null && t.durationHours > 0),
);

watch([hasDateTimeTasks, hasHourDurationTasks], ([hasDt, hasDur]) => {
  if (localGranularity.value !== 'day') return;
  if (hasDt) localGranularity.value = 'hour';
  else if (hasDur) localGranularity.value = 'shift';
}, { immediate: true });



const movedSet = computed(() => new Set(props.movedOrderIds));



const window = computed(() =>

  timelineWindow(props.timelineStart, props.timelineEnd, localGranularity.value),

);



const ticks = computed(() =>

  buildTimelineTicks(props.timelineStart, props.timelineEnd, localGranularity.value, 20),

);



const trackStyle = computed(() => ({

  '--sg-ticks': window.value.totalUnits,

}));



const rangeLabelStart = computed(() => {

  if (localGranularity.value === 'day') return props.timelineStart;

  const dt = parseGanttInstant(props.timelineStart, DAY_START_HOUR);

  return `${dt.toISOString().slice(0, 10)} ${String(dt.getHours()).padStart(2, '0')}:00`;

});



const rangeLabelEnd = computed(() => {

  if (localGranularity.value === 'day') return props.timelineEnd;

  const w = window.value;

  return `${props.timelineEnd.slice(0, 10)} ${String(w.timelineEndDt.getHours()).padStart(2, '0')}:00`;

});



const lineCounts = computed(() => {

  const counts = {};

  for (const t of props.tasks) {

    const line = t.productionLine || t.workCenterId;

    if (line) counts[line] = (counts[line] || 0) + 1;

  }

  return counts;

});



function tasksForLine(lineId) {

  return props.tasks.filter((t) => (t.workCenterId || t.productionLine) === lineId);

}



function isMoved(task) {

  return movedSet.value.has(task.id);

}



function barClasses(task) {

  const hasTimes = hasOperationTimeBreakdown(task);

  return [

    hasTimes ? 'sg-bar--operation' : statusClass(task),

    {

      selected: props.selectedId === task.id,

      moved: isMoved(task),

      bottleneck: !!task.isBottleneck,

    },

  ];

}



function timeSegments(task) {

  return operationTimeSegments(task);

}



function fmtSegHours(hours) {

  return `${Math.round(hours * 10) / 10} h`;

}



function barLabel(task) {

  const prefix = task.operationNo ? `Op${task.operationNo}` : task.destinationCountry;

  return `${prefix} · ${task.packagingOrderId || task.id}`;

}



function barStyle(task) {

  if (localGranularity.value === 'day' && task.leftPercent != null && task.widthPercent != null) {

    return { left: `${task.leftPercent}%`, width: `${Math.max(task.widthPercent, 4)}%` };

  }

  const metrics = computeBarMetrics(

    task,

    props.timelineStart,

    props.timelineEnd,

    localGranularity.value,

  );

  return {

    left: `${metrics.leftPercent}%`,

    width: `${metrics.widthPercent}%`,

  };

}



function statusClass(task) {

  if ((task.riskScore || 0) >= 30) return 'risk-high';

  if (task.allocationStatus === 'AT_RISK') return 'risk-medium';

  return 'risk-ok';

}



function tooltip(task) {

  const riskLevel = (task.riskScore || 0) >= 30 ? 'HIGH' : (task.riskScore || 0) >= 15 ? 'MEDIUM' : 'LOW';

  const start = resolveTaskStart(task);

  const end = resolveTaskEnd(task);

  const parts = [

    task.operationNo ? `Op ${task.operationNo} · ${task.packagingOrderId || task.id}` : task.id,

    start && end ? `${start} → ${end}` : null,

    task.operationName ? task.operationName : null,

    task.priority ? `Priority: ${task.priority}` : null,

    task.destinationCountry ? `Country: ${task.destinationCountry}` : null,

    task.recommendedBatchId ? `Batch: ${task.recommendedBatchId}` : null,

    task.expectedOee != null ? `OEE: ${task.expectedOee}%` : null,

    `Risk: ${riskLevel}`,

  ];

  if (task.isBottleneck) parts.push('Bottleneck operation');

  if (task.setupHours != null) parts.push(`${OP_TIME_LABELS.setup}: ${fmtSegHours(task.setupHours)}`);

  if (task.productionHours != null) parts.push(`${OP_TIME_LABELS.production}: ${fmtSegHours(task.productionHours)}`);

  if (task.teardownHours != null) parts.push(`${OP_TIME_LABELS.teardown}: ${fmtSegHours(task.teardownHours)}`);

  else if (task.durationHours) parts.push(`Duration: ${task.durationHours}h`);

  const moved = props.movedOrderDetails[task.packagingOrderId || task.id];

  if (moved) {

    if (moved.lineChange) parts.push(`Line: ${moved.lineChange}`);

    if (moved.startChange) parts.push(`Date: ${moved.startChange}`);

  } else if (isMoved(task)) {

    parts.push('Changed by optimization');

  }

  return parts.filter(Boolean).join(' | ');

}



function onDragStart(e, task) {

  dragTask.value = task;

  e.dataTransfer.effectAllowed = 'move';

}



function onDropLine(e, lineId) {

  if (!dragTask.value) return;

  const track = e.currentTarget.querySelector('.sg-track');

  const rect = track.getBoundingClientRect();

  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

  const unitOffset = Math.floor(ratio * window.value.totalUnits);

  const { plannedStartDate, plannedStartDateTime } = offsetToDateTime(

    props.timelineStart,

    unitOffset,

    localGranularity.value,

  );



  emit('move', {

    taskId: dragTask.value.id,

    productionLine: lineId,

    plannedStartDate,

    plannedStartDateTime,

    granularity: localGranularity.value,

  });

  dragTask.value = null;

}

</script>



<style scoped>

.swimlane-gantt {

  border: 1px solid var(--color-border);

  border-radius: var(--radius);

  overflow: hidden;

  font-size: 0.75rem;

  background: var(--color-panel);

}



.sg-zoom-bar {

  display: flex;

  align-items: center;

  gap: 0.75rem;

  padding: 6px 12px;

  border-bottom: 1px solid var(--color-border);

  background: var(--help-surface-strong);

}



.sg-zoom-label {

  font-weight: 600;

  color: var(--color-text-muted);

  font-size: 0.6875rem;

  text-transform: uppercase;

  letter-spacing: 0.03em;

}



.sg-zoom-hint {

  font-size: 0.625rem;

  color: var(--color-primary, #2563eb);

  margin-left: auto;

}



.sg-header {

  display: flex;

  background: var(--help-surface-strong);

  border-bottom: 1px solid var(--color-border);

  font-weight: 600;

}



.sg-corner {

  width: 120px;

  padding: 8px;

  flex-shrink: 0;

  border-right: 1px solid var(--color-border);

}



.sg-timeline-head {

  flex: 1;

  min-width: 0;

  padding: 4px 0 6px;

}



.sg-timeline-rail {

  position: relative;

  height: 1.25rem;

  margin: 0 8px;

}



.sg-tick {

  position: absolute;

  transform: translateX(-50%);

  font-size: 0.5625rem;

  font-weight: 500;

  color: var(--color-text-muted);

  white-space: nowrap;

  max-width: 5rem;

  overflow: hidden;

  text-overflow: ellipsis;

}



.sg-dates-range {

  display: flex;

  justify-content: space-between;

  padding: 0 12px;

  font-size: 0.625rem;

  color: var(--color-text-muted);

}



.sg-row {

  display: flex;

  border-bottom: 1px solid var(--color-border);

  min-height: 48px;

}



.sg-line-label {

  width: 120px;

  flex-shrink: 0;

  padding: 8px;

  font-weight: 600;

  background: var(--color-panel);

  border-right: 1px solid var(--color-border);

  display: flex;

  align-items: center;

  justify-content: space-between;

  gap: 4px;

}



.sg-line-id {

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

}



.sg-line-count {

  font-size: 0.65rem;

  font-weight: 700;

  color: var(--color-text-muted);

  background: var(--color-border);

  border-radius: 10px;

  padding: 1px 6px;

  flex-shrink: 0;

}



.sg-track {

  flex: 1;

  position: relative;

  min-height: 48px;

  --sg-ticks: 14;

  background: repeating-linear-gradient(

    90deg,

    transparent,

    transparent calc(100% / var(--sg-ticks) - 1px),

    rgba(0, 0, 0, 0.04) calc(100% / var(--sg-ticks) - 1px),

    rgba(0, 0, 0, 0.04) calc(100% / var(--sg-ticks))

  );

}



.sg-bar {

  position: absolute;

  top: 8px;

  height: 32px;

  min-width: 4px;

  border-radius: 4px;

  cursor: grab;

  color: var(--color-bar-text);

  display: flex;

  align-items: center;

  padding: 0 6px;

  overflow: hidden;

  box-shadow: var(--shadow-sm);

  transition: box-shadow 0.15s, outline 0.15s;

}



.sg-bar:active { cursor: grabbing; }

.sg-bar.selected { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }

.sg-bar.moved {

  outline: 2px dashed var(--color-accent);

  outline-offset: 2px;

  box-shadow: 0 0 0 3px var(--color-accent-soft);

}

.sg-bar.bottleneck {

  box-shadow: inset 0 0 0 2px var(--color-warning), var(--shadow-sm);

}

.sg-bar--operation {

  background: var(--color-panel);

  border: 1px solid var(--color-border);

  padding: 0;

  overflow: hidden;

}

.sg-bar-segments {

  position: absolute;

  inset: 0;

  display: flex;

  border-radius: 4px;

  overflow: hidden;

}

.sg-bar-seg {

  display: block;

  height: 100%;

  min-width: 2px;

}

.sg-bar--operation .sg-bar-label {

  position: relative;

  z-index: 1;

  text-shadow: 0 0 4px rgba(255, 255, 255, 0.9), 0 1px 2px rgba(0, 0, 0, 0.35);

  color: #1a1a1a;

  padding: 0 6px;

}

.sg-time-legend {

  display: flex;

  flex-wrap: wrap;

  align-items: center;

  gap: 8px 16px;

  padding: 8px 12px;

  border-top: 1px solid var(--color-border);

  background: var(--help-surface-strong);

  font-size: 0.6875rem;

}

.sg-time-legend__title {

  font-weight: 600;

  color: var(--color-text-muted);

}

.sg-time-legend__item {

  display: inline-flex;

  align-items: center;

  gap: 6px;

}

.sg-time-legend__swatch {

  width: 12px;

  height: 12px;

  border-radius: 2px;

  flex-shrink: 0;

}

.sg-bar.risk-ok { background: var(--color-risk-ok); }

.sg-bar.risk-medium { background: var(--color-risk-medium); }

.sg-bar.risk-high { background: var(--color-risk-high); }

.sg-bar-label {

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

  font-size: 0.625rem;

  font-weight: 600;

}

</style>


