<template>
  <section v-if="plan" class="cp-detail">
    <h3 class="cp-detail-title">Forward/backward windows</h3>
    <div class="cp-bars">
      <div class="cp-bar-row">
        <span class="cp-bar-label">Backward</span>
        <div class="cp-bar-track">
          <div
            v-if="plan.backward?.latestPackagingStart"
            class="cp-bar cp-bar-backward"
            :style="barStyle(plan.backward.latestPackagingStart, plan.backward.latestPackagingEnd)"
            :title="`Latest: ${plan.backward.latestPackagingStart} – ${plan.backward.latestPackagingEnd}`"
          />
        </div>
        <span class="cp-bar-dates" v-if="plan.backward?.latestPackagingStart">
          {{ plan.backward.latestPackagingStart }} → {{ plan.backward.latestPackagingEnd }}
        </span>
        <span v-else class="cp-muted">No delivery date</span>
      </div>
      <div class="cp-bar-row">
        <span class="cp-bar-label">Forward</span>
        <div class="cp-bar-track">
          <div
            v-if="plan.forward?.earliestPackagingStart"
            class="cp-bar cp-bar-forward"
            :style="barStyle(plan.forward.earliestPackagingStart, plan.forward.earliestPackagingEnd)"
            :title="`Earliest: ${plan.forward.earliestPackagingStart} – ${plan.forward.earliestPackagingEnd}`"
          />
        </div>
        <span class="cp-bar-dates">
          {{ plan.forward?.earliestPackagingStart }} → {{ plan.forward?.earliestPackagingEnd }}
        </span>
      </div>
      <div class="cp-bar-row">
        <span class="cp-bar-label">Combined</span>
        <div class="cp-bar-track">
          <div
            class="cp-bar cp-bar-planned"
            :style="barStyle(plan.plannedStartDate, plan.plannedEndDate)"
            :title="`Plan: ${plan.plannedStartDate} – ${plan.plannedEndDate}`"
          />
        </div>
        <span class="cp-bar-dates"><strong>{{ plan.plannedStartDate }} → {{ plan.plannedEndDate }}</strong></span>
      </div>
      <div v-if="plan.requestedDeliveryDate" class="cp-delivery">
        Delivery: {{ plan.requestedDeliveryDate }}
        <span v-if="plan.slackDaysToDelivery != null"> · Slack {{ plan.slackDaysToDelivery }} days</span>
      </div>
    </div>
    <dl class="cp-meta">
      <dt>Method</dt><dd>{{ plan.planningMethod }}</dd>
      <dt>Duration</dt><dd>{{ plan.durationDays }} days ({{ plan.durationHours }} h)</dd>
      <dt>Batch (pre-check)</dt><dd>{{ plan.recommendedBatchId || '—' }}</dd>
      <dt>ATP/TRIC/RMSL</dt>
      <dd>
        <Tag :severity="plan.masterData?.eligible ? 'success' : 'danger'" :value="plan.masterData?.eligible ? 'Executable' : 'Blocked'" />
      </dd>
    </dl>
    <ul v-if="plan.issues?.length" class="cp-issues">
      <li v-for="(iss, i) in plan.issues" :key="i">{{ iss.message }}</li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import Tag from 'primevue/tag';

const props = defineProps({
  plan: { type: Object, default: null },
  horizonStart: { type: String, default: '' },
  horizonEnd: { type: String, default: '' },
});

const rangeStart = computed(() => props.horizonStart || props.plan?.forward?.anchorDate || props.plan?.plannedStartDate);
const rangeEnd = computed(() => {
  const dates = [
    props.horizonEnd,
    props.plan?.requestedDeliveryDate,
    props.plan?.plannedEndDate,
    props.plan?.backward?.latestPackagingEnd,
    props.plan?.forward?.earliestPackagingEnd,
  ].filter(Boolean);
  return dates.sort().pop() || props.plan?.plannedEndDate;
});

function dayIndex(dateStr) {
  if (!dateStr || !rangeStart.value) return 0;
  const a = new Date(rangeStart.value);
  const b = new Date(dateStr);
  return Math.round((b - a) / 86400000);
}

function barStyle(start, end) {
  const total = Math.max(1, dayIndex(rangeEnd.value) - dayIndex(rangeStart.value) + 1);
  const left = (dayIndex(start) / total) * 100;
  const width = Math.max(4, ((dayIndex(end) - dayIndex(start) + 1) / total) * 100);
  return { left: `${left}%`, width: `${Math.min(100 - left, width)}%` };
}
</script>

<style scoped>
.cp-detail {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border, #eee);
}
.cp-detail-title {
  margin: 0 0 10px;
  font-size: 0.8125rem;
  font-weight: 600;
}
.cp-bars { display: flex; flex-direction: column; gap: 8px; }
.cp-bar-row {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 0.75rem;
}
.cp-bar-label { color: var(--text-color-secondary); }
.cp-bar-track {
  position: relative;
  height: 10px;
  background: var(--color-bg-muted, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
}
.cp-bar {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 3px;
  min-width: 4px;
}
.cp-bar-backward { background: #6c757d; opacity: 0.85; }
.cp-bar-forward { background: #0d6efd; opacity: 0.85; }
.cp-bar-planned { background: #198754; opacity: 0.9; }
.cp-bar-dates { white-space: nowrap; font-size: 0.6875rem; }
.cp-delivery {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  margin-top: 4px;
}
.cp-meta {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 4px 10px;
  font-size: 0.75rem;
  margin: 12px 0 0;
}
.cp-meta dt { color: var(--text-color-secondary); }
.cp-issues {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 0.75rem;
  color: #bb0000;
}
.cp-muted { color: var(--text-color-secondary); font-size: 0.75rem; }
</style>
