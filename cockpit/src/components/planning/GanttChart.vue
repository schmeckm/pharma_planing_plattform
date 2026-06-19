<template>
  <div class="gantt-chart">
    <div class="gantt-header">
      <span v-for="d in dateLabels" :key="d" class="gantt-date">{{ d }}</span>
    </div>
    <div v-for="bar in bars" :key="bar.id" class="gantt-row">
      <div class="gantt-label" :title="bar.label">{{ bar.id }}</div>
      <div class="gantt-track">
        <div
          class="gantt-bar"
          :class="`priority-${(bar.priority || 'medium').toLowerCase()}`"
          :style="{ left: bar.leftPercent + '%', width: bar.widthPercent + '%' }"
          :title="`${bar.startDate} → ${bar.endDate}`"
        >
          {{ bar.market || bar.id }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  gantt: { type: Object, default: () => ({ bars: [] }) },
});

const bars = computed(() => props.gantt?.bars || []);

const dateLabels = computed(() => {
  if (!props.gantt?.timelineStart) return [];
  const labels = [props.gantt.timelineStart];
  if (props.gantt.timelineEnd && props.gantt.timelineEnd !== props.gantt.timelineStart) {
    labels.push(props.gantt.timelineEnd);
  }
  return labels;
});
</script>

<style scoped>
.gantt-chart { font-size: 0.75rem; overflow-x: auto; }
.gantt-header { display: flex; justify-content: space-between; padding: 0 120px 8px 120px; color: var(--text-color-secondary); }
.gantt-row { display: flex; align-items: center; margin-bottom: 6px; }
.gantt-label { width: 110px; flex-shrink: 0; padding-right: 8px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.gantt-track { flex: 1; position: relative; height: 28px; background: var(--surface-100); border-radius: 4px; min-width: 300px; }
.gantt-bar {
  position: absolute; top: 4px; height: 20px; border-radius: 4px;
  background: var(--color-risk-ok); color: var(--color-bar-text); font-size: 0.625rem;
  display: flex; align-items: center; justify-content: center; min-width: 24px;
}
.gantt-bar.priority-high { background: var(--color-risk-high); }
.gantt-bar.priority-medium { background: var(--color-risk-medium); }
.gantt-bar.priority-low { background: var(--color-capacity-ok); }
</style>
