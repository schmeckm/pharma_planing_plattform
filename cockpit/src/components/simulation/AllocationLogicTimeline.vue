<template>
  <div class="allocation-timeline">
    <div class="allocation-timeline__overview">
      <div class="allocation-timeline__axis-label">Execution flow</div>
      <div class="allocation-timeline__mini-rail" aria-hidden="true">
        <template v-for="(step, index) in steps" :key="step.key">
          <div
            class="allocation-timeline__mini-node"
            :class="`allocation-timeline__mini-node--${step.status}`"
            :title="step.label"
          >
            <span>{{ step.shortLabel }}</span>
          </div>
          <div
            v-if="index < steps.length - 1"
            class="allocation-timeline__mini-connector"
            :class="{ 'allocation-timeline__mini-connector--blocked': step.status === 'failed' || step.status === 'blocked' }"
          />
        </template>
      </div>
      <div class="allocation-timeline__legend">
        <span class="allocation-timeline__legend-item allocation-timeline__legend-item--gate">Gates</span>
        <span class="allocation-timeline__legend-item allocation-timeline__legend-item--assign">Assignment</span>
      </div>
    </div>

    <div class="allocation-timeline__track">
      <div
        v-for="(step, index) in steps"
        :key="step.key"
        class="allocation-timeline__segment"
      >
        <div v-if="step.showAssignmentMarker" class="allocation-timeline__boundary">
          <span class="allocation-timeline__boundary-line" />
          <span class="allocation-timeline__boundary-label">Batch assignment from here</span>
          <span class="allocation-timeline__boundary-line" />
        </div>

        <div class="allocation-timeline__step" :class="`allocation-timeline__step--${step.status}`">
          <div class="allocation-timeline__rail" aria-hidden="true">
            <div class="allocation-timeline__node" :class="`allocation-timeline__node--${step.status}`">
              {{ step.stepNumber }}
            </div>
            <div
              v-if="index < steps.length - 1"
              class="allocation-timeline__connector"
              :class="connectorClass(step)"
            />
          </div>

          <div class="allocation-timeline__card" :class="cardClass(step)">
            <div class="allocation-timeline__card-head">
              <div class="allocation-timeline__card-title">
                <strong>{{ step.label }}</strong>
                <span v-if="step.isGate" class="allocation-timeline__badge allocation-timeline__badge--gate">Gate</span>
                <span v-if="step.isAssignmentStep" class="allocation-timeline__badge allocation-timeline__badge--assign">Assign</span>
              </div>
              <StatusTag :status="statusForTag(step.status)" />
            </div>

            <p class="allocation-timeline__hint">{{ step.hint }}</p>

            <p v-if="step.emptyNote" class="allocation-timeline__empty">{{ step.emptyNote }}</p>

            <ul v-if="step.checks.length" class="allocation-timeline__checks">
              <li
                v-for="(check, checkIndex) in step.checks"
                :key="checkIndex"
                :class="check.result === 'FAILED' ? 'allocation-timeline__check allocation-timeline__check--failed' : 'allocation-timeline__check'"
              >
                <StatusTag :status="check.result || 'PASSED'" />
                <span>
                  <strong>{{ ruleLabel(check.ruleName) }}</strong>
                  <span v-if="check.message"> — {{ plannerText(check.message) }}</span>
                </span>
              </li>
            </ul>

            <div
              v-if="step.isAssignmentStep && recommendedBatchId && step.status === 'success'"
              class="allocation-timeline__assignment"
            >
              <span>Assigned batch</span>
              <strong>{{ recommendedBatchId }}</strong>
              <span v-if="allocatedQuantity" class="allocation-timeline__assignment-qty">
                {{ allocatedQuantity.toLocaleString() }} EA
              </span>
            </div>

            <ul v-if="step.failures?.length" class="allocation-timeline__failures">
              <li v-for="(failure, failureIndex) in step.failures" :key="failureIndex">
                {{ plannerText(failure) }}
              </li>
            </ul>

            <p v-if="step.status === 'blocked'" class="allocation-timeline__blocked">
              Not reached — earlier gate failed
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import StatusTag from '@/components/shared/StatusTag.vue';
import { ruleLabel, plannerText } from '@/utils/plannerTerminology';

defineProps({
  steps: { type: Array, default: () => [] },
  recommendedBatchId: { type: String, default: null },
  allocatedQuantity: { type: Number, default: null },
});

function statusForTag(status) {
  if (status === 'failed') return 'FAILED';
  if (status === 'blocked') return 'SKIPPED';
  if (status === 'success') return 'PASSED';
  return 'PENDING';
}

function connectorClass(step) {
  if (step.status === 'failed') return 'allocation-timeline__connector--failed';
  if (step.status === 'blocked') return 'allocation-timeline__connector--blocked';
  return 'allocation-timeline__connector--passed';
}

function cardClass(step) {
  if (step.isGate) return 'allocation-timeline__card--gate';
  if (step.isAssignmentStep) return 'allocation-timeline__card--assign';
  return '';
}
</script>

<style scoped>
.allocation-timeline {
  margin-top: 8px;
}

.allocation-timeline__overview {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel, #fafafa);
}

.allocation-timeline__axis-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: 10px;
}

.allocation-timeline__mini-rail {
  display: flex;
  align-items: center;
  gap: 0;
  overflow-x: auto;
  padding-bottom: 4px;
}

.allocation-timeline__mini-node {
  flex: 0 0 auto;
  min-width: 52px;
  padding: 4px 6px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border: 1px solid var(--color-border);
  background: #fff;
  color: var(--color-text-muted);
}

.allocation-timeline__mini-node--success {
  border-color: #b7dfc4;
  background: #e8f5e9;
  color: var(--color-success);
}

.allocation-timeline__mini-node--failed {
  border-color: #f0b8b8;
  background: #ffebee;
  color: var(--color-error);
}

.allocation-timeline__mini-node--blocked {
  border-style: dashed;
  background: #f5f5f5;
  color: #9e9e9e;
}

.allocation-timeline__mini-connector {
  flex: 1 1 12px;
  min-width: 12px;
  height: 2px;
  background: var(--color-success);
}

.allocation-timeline__mini-connector--blocked {
  background: #e0e0e0;
}

.allocation-timeline__legend {
  display: flex;
  gap: 12px;
  margin-top: 10px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.allocation-timeline__legend-item::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.allocation-timeline__legend-item--gate::before {
  background: var(--color-info);
}

.allocation-timeline__legend-item--assign::before {
  background: var(--color-success);
}

.allocation-timeline__track {
  display: flex;
  flex-direction: column;
}

.allocation-timeline__boundary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 14px 18px;
  color: var(--color-warning);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.allocation-timeline__boundary-line {
  flex: 1;
  height: 0;
  border-top: 2px dashed #f0c987;
}

.allocation-timeline__boundary-label {
  flex: 0 0 auto;
  white-space: nowrap;
}

.allocation-timeline__step {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 12px;
  margin-bottom: 4px;
}

.allocation-timeline__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
}

.allocation-timeline__node {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  border: 2px solid var(--color-border);
  background: #fff;
  color: var(--color-text-muted);
  z-index: 1;
}

.allocation-timeline__node--success {
  border-color: var(--color-success);
  background: #e8f5e9;
  color: var(--color-success);
}

.allocation-timeline__node--failed {
  border-color: var(--color-error);
  background: #ffebee;
  color: var(--color-error);
}

.allocation-timeline__node--blocked {
  border-style: dashed;
  background: #f5f5f5;
  color: #9e9e9e;
}

.allocation-timeline__connector {
  flex: 1;
  width: 2px;
  min-height: 16px;
  margin: 4px 0;
  background: var(--color-success);
}

.allocation-timeline__connector--failed,
.allocation-timeline__connector--blocked {
  background: #e0e0e0;
}

.allocation-timeline__card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fff;
}

.allocation-timeline__card--gate {
  border-left: 3px solid var(--color-info);
}

.allocation-timeline__card--assign {
  border-left: 3px solid var(--color-success);
  background: #f8fcf9;
}

.allocation-timeline__step--failed .allocation-timeline__card {
  border-color: #f0b8b8;
  background: #fff8f8;
}

.allocation-timeline__step--blocked .allocation-timeline__card {
  border-style: dashed;
  background: #fafafa;
  opacity: 0.85;
}

.allocation-timeline__card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.allocation-timeline__card-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 0.9375rem;
}

.allocation-timeline__badge {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 4px;
}

.allocation-timeline__badge--gate {
  background: #e3f2fd;
  color: var(--color-info);
}

.allocation-timeline__badge--assign {
  background: #e8f5e9;
  color: var(--color-success);
}

.allocation-timeline__hint {
  margin: 0 0 8px;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}

.allocation-timeline__empty,
.allocation-timeline__blocked {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  font-style: italic;
}

.allocation-timeline__checks {
  margin: 0;
  padding: 0;
  list-style: none;
}

.allocation-timeline__check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.8125rem;
  line-height: 1.45;
  margin-bottom: 8px;
}

.allocation-timeline__check--failed {
  color: var(--color-error);
}

.allocation-timeline__assignment {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  background: #e8f5e9;
  color: var(--color-success);
  font-size: 0.875rem;
}

.allocation-timeline__assignment-qty {
  margin-left: auto;
  font-weight: 600;
}

.allocation-timeline__failures {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--color-error);
  font-size: 0.8125rem;
}
</style>
