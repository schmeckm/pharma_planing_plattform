<template>
  <div class="swimlane-gantt">
    <div class="sg-header">
      <span class="sg-corner">{{ lineColumnLabel }}</span>
      <div class="sg-dates">
        <span>{{ timelineStart }}</span>
        <span>{{ timelineEnd }}</span>
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
      <div class="sg-track">
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
          <span class="sg-bar-label">{{ task.operationNo ? `Op${task.operationNo}` : task.destinationCountry }} · {{ task.packagingOrderId || task.id }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { addDays, daysBetween } from '@/utils/dateHelpers';

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  timelineStart: { type: String, default: '2026-09-01' },
  timelineEnd: { type: String, default: '2026-09-15' },
  selectedId: String,
  movedOrderIds: { type: Array, default: () => [] },
  movedOrderDetails: { type: Object, default: () => ({}) },
  lineColumnLabel: { type: String, default: 'Verpackungslinie' },
});

const emit = defineEmits(['select', 'move']);

const dragTask = ref(null);

const movedSet = computed(() => new Set(props.movedOrderIds));

const lineCounts = computed(() => {
  const counts = {};
  for (const t of props.tasks) {
    const line = t.productionLine;
    if (line) counts[line] = (counts[line] || 0) + 1;
  }
  return counts;
});

const totalDays = computed(() =>
  Math.max(1, daysBetween(props.timelineStart, props.timelineEnd) + 1)
);

function tasksForLine(lineId) {
  return props.tasks.filter((t) => (t.workCenterId || t.productionLine) === lineId);
}

function isMoved(task) {
  return movedSet.value.has(task.id);
}

function barClasses(task) {
  return [
    statusClass(task),
    {
      selected: props.selectedId === task.id,
      moved: isMoved(task),
      bottleneck: !!task.isBottleneck,
    },
  ];
}

function barStyle(task) {
  if (task.leftPercent != null && task.widthPercent != null) {
    return { left: `${task.leftPercent}%`, width: `${Math.max(task.widthPercent, 4)}%` };
  }
  const startOffset = daysBetween(props.timelineStart, task.start || task.plannedStartDate);
  const duration = Math.max(
    1,
    daysBetween(task.start || task.plannedStartDate, task.end || task.plannedEndDate) + 1
  );
  return {
    left: `${(startOffset / totalDays.value) * 100}%`,
    width: `${Math.max((duration / totalDays.value) * 100, 4)}%`,
  };
}

function statusClass(task) {
  if ((task.riskScore || 0) >= 30) return 'risk-high';
  if (task.allocationStatus === 'AT_RISK') return 'risk-medium';
  return 'risk-ok';
}

function tooltip(task) {
  const riskLevel = (task.riskScore || 0) >= 30 ? 'HIGH' : (task.riskScore || 0) >= 15 ? 'MEDIUM' : 'LOW';
  const parts = [
    task.operationNo ? `Op ${task.operationNo} · ${task.packagingOrderId || task.id}` : task.id,
    task.operationName ? task.operationName : null,
    task.priority ? `Priority: ${task.priority}` : null,
    task.destinationCountry ? `Country: ${task.destinationCountry}` : null,
    task.recommendedBatchId ? `Batch: ${task.recommendedBatchId}` : null,
    task.expectedOee != null ? `OEE: ${task.expectedOee}%` : null,
    `Risk: ${riskLevel}`,
  ];
  if (task.isBottleneck) parts.push('Bottleneck operation');
  if (task.durationHours) parts.push(`Duration: ${task.durationHours}h`);
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
  const dayOffset = Math.floor(ratio * totalDays.value);
  const newStart = addDays(props.timelineStart, dayOffset);

  emit('move', {
    taskId: dragTask.value.id,
    productionLine: lineId,
    plannedStartDate: newStart,
  });
  dragTask.value = null;
}
</script>

<style scoped>
.swimlane-gantt {
  border: 1px solid var(--surface-border, #ddd);
  border-radius: 8px;
  overflow: hidden;
  font-size: 0.75rem;
  background: var(--surface-0, #fff);
}
.sg-header {
  display: flex;
  background: var(--surface-100, #f5f5f5);
  border-bottom: 1px solid var(--surface-border, #ddd);
  font-weight: 600;
}
.sg-corner { width: 120px; padding: 8px; flex-shrink: 0; }
.sg-dates { flex: 1; display: flex; justify-content: space-between; padding: 8px 12px; color: var(--text-color-secondary); }
.sg-row { display: flex; border-bottom: 1px solid var(--surface-border, #eee); min-height: 48px; }
.sg-line-label {
  width: 120px; flex-shrink: 0; padding: 8px; font-weight: 600;
  background: var(--surface-50, #fafafa); border-right: 1px solid var(--surface-border, #eee);
  display: flex; align-items: center; justify-content: space-between; gap: 4px;
}
.sg-line-id { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sg-line-count {
  font-size: 0.65rem; font-weight: 700; color: #475569;
  background: #e2e8f0; border-radius: 10px; padding: 1px 6px; flex-shrink: 0;
}
.sg-track { flex: 1; position: relative; min-height: 48px; background: repeating-linear-gradient(
  90deg, transparent, transparent calc(100% / 14 - 1px), rgba(0,0,0,.04) calc(100% / 14 - 1px), rgba(0,0,0,.04) calc(100% / 14)
); }
.sg-bar {
  position: absolute; top: 8px; height: 32px; border-radius: 4px;
  cursor: grab; color: #fff; display: flex; align-items: center;
  padding: 0 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.15);
  transition: box-shadow 0.15s, outline 0.15s;
}
.sg-bar:active { cursor: grabbing; }
.sg-bar.selected { outline: 2px solid #000; outline-offset: 1px; }
.sg-bar.moved {
  outline: 2px dashed #16a34a;
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.25);
}
.sg-bar.bottleneck {
  box-shadow: inset 0 0 0 2px #fbbf24, 0 1px 3px rgba(0,0,0,.15);
}
.sg-bar.risk-ok { background: #0070f2; }
.sg-bar.risk-medium { background: #e9730c; }
.sg-bar.risk-high { background: #bb0000; }
.sg-bar-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.625rem; font-weight: 600; }
</style>
