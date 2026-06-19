<template>
  <div class="order-detail">
    <section v-if="selectedOperation" class="detail-section detail-section--operation">
      <h3 class="detail-section__title">{{ SEQ_LABELS.OPERATION_DETAIL }}</h3>
      <div class="detail-row">
        <span class="detail-row__label">Operation</span>
        <span class="detail-row__value">
          Op {{ selectedOperation.operationNo }} · {{ selectedOperation.operationName || selectedOperation.workCenterId }}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Packaging order</span>
        <span class="detail-row__value">{{ selectedOperation.packagingOrderId || selectedOperation.packagingOrder }}</span>
      </div>
      <div v-if="selectedOperation.workCenterId" class="detail-row">
        <span class="detail-row__label">Work center</span>
        <span class="detail-row__value">{{ selectedOperation.workCenterId }}</span>
      </div>
      <div v-if="selectedOperation.plannedStartDate && selectedOperation.plannedEndDate" class="detail-row">
        <span class="detail-row__label">Planned</span>
        <span class="detail-row__value">
          {{ selectedOperation.plannedStartDate }} → {{ selectedOperation.plannedEndDate }}
        </span>
      </div>
      <div v-if="selectedOperation.isBottleneck" class="detail-row">
        <span class="detail-row__label">Capacity</span>
        <span class="detail-row__value"><Tag severity="warn" value="Bottleneck" /></span>
      </div>

      <div v-if="operationTimeSegmentList.length" class="op-time-block">
        <h4 class="op-time-block__title">{{ SEQ_LABELS.OP_TIME_LEGEND }}</h4>
        <div class="op-time-bar" aria-hidden="true">
          <span
            v-for="seg in operationTimeSegmentList"
            :key="seg.key"
            class="op-time-bar__seg"
            :style="{ width: `${seg.pct}%`, background: seg.color }"
          />
        </div>
        <div
          v-for="seg in operationTimeSegmentList"
          :key="`row-${seg.key}`"
          class="op-time-row"
        >
          <span class="op-time-row__label">
            <span class="op-time-row__swatch" :style="{ background: seg.color }" />
            {{ seg.label }}
          </span>
          <span class="op-time-row__value">{{ fmtHours(seg.hours) }}</span>
        </div>
        <div class="op-time-row op-time-row--total">
          <span class="op-time-row__label">{{ SEQ_LABELS.OP_TIME_TOTAL }}</span>
          <span class="op-time-row__value">{{ operationTotalHours }}</span>
        </div>
      </div>
    </section>

    <section class="detail-section">
      <h3 class="detail-section__title">Order</h3>
      <div class="detail-row">
        <span class="detail-row__label">Packaging order</span>
        <span class="detail-row__value">{{ orderId }}</span>
      </div>
      <div v-if="task.destinationCountry" class="detail-row">
        <span class="detail-row__label">Country</span>
        <span class="detail-row__value">{{ task.destinationCountry }}</span>
      </div>
      <div v-if="task.productionLine" class="detail-row">
        <span class="detail-row__label">Line</span>
        <span class="detail-row__value">{{ task.productionLine }}</span>
      </div>
      <div v-if="task.plannedStartDate && task.plannedEndDate" class="detail-row">
        <span class="detail-row__label">Planned</span>
        <span class="detail-row__value">{{ task.plannedStartDate }} → {{ task.plannedEndDate }}</span>
      </div>
      <div v-if="task.requestedDeliveryDate" class="detail-row">
        <span class="detail-row__label">Delivery</span>
        <span class="detail-row__value">{{ task.requestedDeliveryDate }}</span>
      </div>
      <div v-if="durationLabel" class="detail-row">
        <span class="detail-row__label">Duration</span>
        <span class="detail-row__value">{{ durationLabel }}</span>
      </div>
      <div v-if="task.priority" class="detail-row">
        <span class="detail-row__label">Priority</span>
        <span class="detail-row__value">{{ task.priority }}</span>
      </div>
      <div v-if="task.recommendedBatchId" class="detail-row">
        <span class="detail-row__label">Batch</span>
        <span class="detail-row__value">{{ task.recommendedBatchId }}</span>
      </div>
    </section>

    <section v-if="hasRuntime" class="detail-section">
      <h3 class="detail-section__title">Runtime breakdown</h3>
      <div v-if="task.estimatedRuntimeHours != null" class="detail-row">
        <span class="detail-row__label">Runtime</span>
        <span class="detail-row__value">{{ fmtHours(task.estimatedRuntimeHours) }}</span>
      </div>
      <div v-if="task.estimatedSetupHours != null" class="detail-row">
        <span class="detail-row__label">Setup</span>
        <span class="detail-row__value">{{ fmtHours(task.estimatedSetupHours) }}</span>
      </div>
      <div v-if="task.estimatedDowntimeHours != null" class="detail-row">
        <span class="detail-row__label">Downtime</span>
        <span class="detail-row__value">{{ fmtHours(task.estimatedDowntimeHours) }}</span>
      </div>
      <div v-if="task.estimatedTeardownHours != null" class="detail-row">
        <span class="detail-row__label">Teardown</span>
        <span class="detail-row__value">{{ fmtHours(task.estimatedTeardownHours) }}</span>
      </div>
    </section>

    <section class="detail-section">
      <h3 class="detail-section__title">Risk &amp; performance</h3>
      <div class="detail-row">
        <span class="detail-row__label">Risk</span>
        <span class="detail-row__value">
          <RiskBadge :level="riskLevel" :score="task.riskScore" />
        </span>
      </div>
      <div v-if="task.riskScore != null" class="detail-row">
        <span class="detail-row__label">Risk score</span>
        <span class="detail-row__value">{{ task.riskScore }}</span>
      </div>
      <div v-if="task.rmslAtStart != null" class="detail-row">
        <span class="detail-row__label">Shelf-life at start</span>
        <span class="detail-row__value">{{ fmtMonths(task.rmslAtStart) }}</span>
      </div>
      <div v-if="task.rmslAtEnd != null" class="detail-row">
        <span class="detail-row__label">Shelf-life at end</span>
        <span class="detail-row__value">{{ fmtMonths(task.rmslAtEnd) }}</span>
      </div>
      <div v-if="task.rmslAtDelivery != null" class="detail-row">
        <span class="detail-row__label">Shelf-life at delivery</span>
        <span class="detail-row__value">{{ fmtMonths(task.rmslAtDelivery) }}</span>
      </div>
      <div v-if="task.expectedOee != null" class="detail-row">
        <span class="detail-row__label">Expected OEE</span>
        <span class="detail-row__value">{{ fmtPct(task.expectedOee) }}</span>
      </div>
      <div v-if="hasValue(task.expectedThroughput)" class="detail-row">
        <span class="detail-row__label">Expected throughput</span>
        <span class="detail-row__value">{{ task.expectedThroughput }}</span>
      </div>
      <div v-if="task.expectedYield != null" class="detail-row">
        <span class="detail-row__label">Expected yield</span>
        <span class="detail-row__value">{{ fmtPct(task.expectedYield) }}</span>
      </div>
      <div v-if="task.lineScore != null" class="detail-row">
        <span class="detail-row__label">Line score</span>
        <span class="detail-row__value">{{ task.lineScore }}</span>
      </div>
      <div v-if="task.lineReliability != null" class="detail-row">
        <span class="detail-row__label">Line reliability</span>
        <span class="detail-row__value">{{ fmtPct(task.lineReliability) }}</span>
      </div>
    </section>

    <section v-if="operations.length" class="detail-section">
      <h3 class="detail-section__title">Operations</h3>
      <ul class="detail-list">
        <li
          v-for="op in operations"
          :key="op.operationId"
          class="detail-list__item"
          :class="{
            'detail-list__item--warn': op.isBottleneck,
            'detail-list__item--selected': selectedOperation?.operationId === op.operationId,
          }"
        >
          <div class="detail-list__head">
            <span class="detail-list__name">Op {{ op.operationNo }} · {{ op.operationName || op.workCenterId }}</span>
            <Tag v-if="op.isBottleneck" severity="warn" value="Bottleneck" />
          </div>
          <p class="detail-list__meta">
            {{ op.workCenterId }}
            <span v-if="op.plannedStartDate && op.plannedEndDate">
              · {{ op.plannedStartDate }} → {{ op.plannedEndDate }}
            </span>
          </p>
          <div v-if="miniSegments(op).length" class="op-time-bar op-time-bar--compact" aria-hidden="true">
            <span
              v-for="seg in miniSegments(op)"
              :key="seg.key"
              class="op-time-bar__seg"
              :style="{ width: `${seg.pct}%`, background: seg.color }"
            />
          </div>
        </li>
      </ul>
    </section>

    <ul v-if="task.issues?.length" class="issue-list">
      <li v-for="(iss, i) in task.issues" :key="i">{{ plannerText(iss.message) }}</li>
    </ul>

    <CombinedPlanningDetail
      :plan="combinedPlan"
      :horizon-start="horizonStart"
      :horizon-end="horizonEnd"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Tag from 'primevue/tag';
import RiskBadge from '@/components/shared/RiskBadge.vue';
import CombinedPlanningDetail from '@/components/lineOptimization/CombinedPlanningDetail.vue';
import { plannerText } from '@/utils/plannerTerminology';
import {
  daysBetween,
  fmtDuration,
  fmtHours,
  fmtMonths,
  fmtPct,
  hasValue,
} from '@/utils/formatters';
import { SEQ_LABELS } from '@/utils/sequencingLabels';
import { operationTimeSegments as buildOperationTimeSegments } from '@/utils/operationTimeColors';

const props = defineProps({
  task: { type: Object, required: true },
  operations: { type: Array, default: () => [] },
  selectedOperation: { type: Object, default: null },
  combinedPlan: { type: Object, default: null },
  horizonStart: { type: String, default: '' },
  horizonEnd: { type: String, default: '' },
});

const orderId = computed(() =>
  props.task.packagingOrder || props.task.packagingOrderId || props.task.id,
);

const durationLabel = computed(() => {
  const fromHours = fmtDuration(null, props.task.durationHours);
  if (fromHours) return fromHours;
  const days = daysBetween(props.task.plannedStartDate, props.task.plannedEndDate);
  return days ? fmtDuration(days, null) : null;
});

const hasRuntime = computed(() =>
  props.task.estimatedRuntimeHours != null
  || props.task.estimatedSetupHours != null
  || props.task.estimatedDowntimeHours != null
  || props.task.estimatedTeardownHours != null,
);

function computeRiskLevel(task) {
  if ((task.riskScore || 0) >= 30) return 'HIGH';
  if (task.allocationStatus === 'AT_RISK') return 'MEDIUM';
  return 'LOW';
}

const riskLevel = computed(() => computeRiskLevel(props.task));

const operationTimeSegmentList = computed(() => {
  if (!props.selectedOperation) return [];
  return buildOperationTimeSegments(props.selectedOperation);
});

const operationTotalHours = computed(() => {
  const segs = operationTimeSegmentList.value;
  if (!segs.length) return null;
  const total = segs.reduce((sum, s) => sum + s.hours, 0);
  return fmtHours(total);
});

function miniSegments(op) {
  return buildOperationTimeSegments(op);
}
</script>

<style scoped>
.detail-section--operation {
  border: 1px solid var(--color-border);
  border-radius: var(--radius, 6px);
  padding: 12px;
  background: var(--help-surface-strong, #f7f8fa);
}
.op-time-block {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.op-time-block__title {
  margin: 0 0 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}
.op-time-bar {
  display: flex;
  height: 10px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  margin-bottom: 10px;
}
.op-time-bar--compact {
  height: 6px;
  margin-top: 6px;
  margin-bottom: 0;
}
.op-time-bar__seg {
  display: block;
  height: 100%;
  min-width: 2px;
}
.op-time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
  padding: 4px 0;
}
.op-time-row--total {
  border-top: 1px solid var(--color-border);
  margin-top: 4px;
  padding-top: 8px;
  font-weight: 600;
}
.op-time-row__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-muted);
}
.op-time-row__swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}
.detail-list__item--selected {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
