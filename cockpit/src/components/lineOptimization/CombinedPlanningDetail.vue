<template>
  <section v-if="plan" class="detail-section planning-windows">
    <h3 class="detail-section__title">Planning windows</h3>
    <div class="planning-windows__bars">
      <div class="planning-windows__row">
        <span class="planning-windows__label">Backward</span>
        <div class="planning-windows__track">
          <div
            v-if="plan.backward?.latestPackagingStart"
            class="planning-windows__bar planning-windows__bar--backward"
            :style="barStyle(plan.backward.latestPackagingStart, plan.backward.latestPackagingEnd)"
            :title="`Latest: ${plan.backward.latestPackagingStart} – ${plan.backward.latestPackagingEnd}`"
          />
        </div>
        <span v-if="plan.backward?.latestPackagingStart" class="planning-windows__dates">
          {{ plan.backward.latestPackagingStart }} → {{ plan.backward.latestPackagingEnd }}
        </span>
        <span v-else class="text-muted text-sm">No delivery date</span>
      </div>
      <div class="planning-windows__row">
        <span class="planning-windows__label">Forward</span>
        <div class="planning-windows__track">
          <div
            v-if="plan.forward?.earliestPackagingStart"
            class="planning-windows__bar planning-windows__bar--forward"
            :style="barStyle(plan.forward.earliestPackagingStart, plan.forward.earliestPackagingEnd)"
            :title="`Earliest: ${plan.forward.earliestPackagingStart} – ${plan.forward.earliestPackagingEnd}`"
          />
        </div>
        <span class="planning-windows__dates">
          {{ plan.forward?.earliestPackagingStart }} → {{ plan.forward?.earliestPackagingEnd }}
        </span>
      </div>
      <div class="planning-windows__row planning-windows__row--highlight">
        <span class="planning-windows__label">Combined</span>
        <div class="planning-windows__track">
          <div
            class="planning-windows__bar planning-windows__bar--planned"
            :style="barStyle(plan.plannedStartDate, plan.plannedEndDate)"
            :title="`Plan: ${plan.plannedStartDate} – ${plan.plannedEndDate}`"
          />
        </div>
        <span class="planning-windows__dates planning-windows__dates--strong">
          {{ plan.plannedStartDate }} → {{ plan.plannedEndDate }}
        </span>
      </div>
      <div v-if="plan.requestedDeliveryDate" class="planning-windows__delivery">
        Delivery {{ plan.requestedDeliveryDate }}
        <span v-if="plan.slackDaysToDelivery != null"> · {{ plan.slackDaysToDelivery }} days slack</span>
      </div>
    </div>

    <div>
      <div v-if="methodLabel" class="detail-row">
        <span class="detail-row__label">Method</span>
        <span class="detail-row__value" :title="plan.planningMethod">{{ methodLabel }}</span>
      </div>
      <div v-if="durationLabel" class="detail-row">
        <span class="detail-row__label">Duration</span>
        <span class="detail-row__value">{{ durationLabel }}</span>
      </div>
      <div v-if="plan.recommendedBatchId" class="detail-row">
        <span class="detail-row__label">Pre-check batch</span>
        <span class="detail-row__value">{{ plan.recommendedBatchId }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Executable</span>
        <span class="detail-row__value">
          <Tag
            :severity="plan.masterData?.eligible ? 'success' : 'danger'"
            :value="plan.masterData?.eligible ? 'Yes' : 'Blocked'"
          />
        </span>
      </div>
    </div>

    <ul v-if="plan.issues?.length" class="issue-list">
      <li v-for="(iss, i) in plan.issues" :key="i">{{ iss.message }}</li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import Tag from 'primevue/tag';
import { fmtDuration, planningMethodLabel } from '@/utils/formatters';

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

const methodLabel = computed(() => planningMethodLabel(props.plan?.planningMethod));
const durationLabel = computed(() =>
  fmtDuration(props.plan?.durationDays, props.plan?.durationHours),
);

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
