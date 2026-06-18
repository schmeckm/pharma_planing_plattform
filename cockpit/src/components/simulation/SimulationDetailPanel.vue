<template>

  <div class="simulation-panel panel">

    <div class="panel-header">

      <h2>Allocation Decision</h2>

      <el-button text :icon="Close" @click="$emit('close')" />

    </div>

    <div class="panel-body" v-if="order">

      <div class="detail-section">

        <h3 class="detail-section__title">Order Header</h3>

        <div class="detail-row">

          <span class="detail-row__label">Packaging Order</span>

          <span class="detail-row__value">{{ order.packagingOrderId }}</span>

        </div>

        <div class="detail-row">

          <span class="detail-row__label">Destination Country</span>

          <span class="detail-row__value">{{ order.destinationCountry }}</span>

        </div>

        <div class="detail-row">

          <span class="detail-row__label">Quantity</span>

          <span class="detail-row__value">{{ order.quantity?.toLocaleString() }} {{ order.unit }}</span>

        </div>

      </div>



      <div class="detail-section" v-if="result">

        <h3 class="detail-section__title">Allocation Timeline</h3>

        <p v-if="result.executionStrategy" class="detail-hint">

          Strategy: <strong>{{ strategyLabel(result.executionStrategy) }}</strong>

          <span v-if="result.ruleSetVersion"> · Rule set {{ result.ruleSetVersion }}</span>

        </p>

        <AllocationLogicTimeline
          v-if="algorithmSteps.length"
          :steps="algorithmSteps"
          :recommended-batch-id="result.recommendedBatchId"
          :allocated-quantity="result.allocatedQuantity"
        />

        <p v-else class="detail-empty">No process steps recorded for this order.</p>

      </div>



      <div class="detail-section">

        <h3 class="detail-section__title">Applicable Rules</h3>

        <div v-if="countryRule" class="detail-row">

          <span class="detail-row__label">Country</span>

          <span class="detail-row__value">{{ countryRule.countryName || countryRule.countryCode }}</span>

        </div>

        <div class="detail-row">

          <span class="detail-row__label">Minimum Shelf-Life</span>

          <span class="detail-row__value">{{ countryRule?.rmslThresholdMonths ?? '—' }} months</span>

        </div>

        <div class="detail-row">

          <span class="detail-row__label">Batch Split</span>

          <span class="detail-row__value">{{ countryRule?.allowBatchSplit ? 'Allowed' : 'Not allowed' }}</span>

        </div>

        <div class="detail-row">

          <span class="detail-row__label">Sequence Rule</span>

          <span class="detail-row__value">{{ countryRule?.requiresContinuousSequence ? 'Continuous' : 'None' }}</span>

        </div>

        <ul v-if="activeRules.length" class="rule-list">
          <li v-for="rule in activeRules" :key="rule.ruleId" class="rule-list__item">
            <div class="rule-list__head">
              <span class="rule-list__name">{{ ruleLabel(rule.ruleName) }}</span>
              <el-tag size="small" type="info" effect="plain">{{ rule.ruleType }}</el-tag>
            </div>
            <p class="rule-list__desc">{{ rule.description }}</p>
          </li>
        </ul>

      </div>



      <div class="detail-section" v-if="result?.ruleChecks?.length">

        <h3 class="detail-section__title">Rule Evaluations</h3>

        <ul class="eval-list">
          <li v-for="(check, i) in sortedRuleChecks" :key="i" class="eval-list__item">
            <div class="eval-list__head">
              <StatusTag :status="check.result" />
              <span class="eval-list__name">{{ ruleLabel(check.ruleName) }}</span>
            </div>
            <p class="eval-list__msg">{{ plannerText(check.message) }}</p>
          </li>
        </ul>

      </div>



      <div class="detail-section" v-if="result">

        <h3 class="detail-section__title">Result</h3>

        <div class="detail-row">

          <span class="detail-row__label">Assigned Batch</span>

          <span class="detail-row__value">

            {{ result.recommendedBatchId || '—' }}

            <span v-if="batch?.materialNumber" class="detail-sub">({{ batch.materialNumber }})</span>

          </span>

        </div>

        <div class="detail-row">

          <span class="detail-row__label">Shelf-Life Risk</span>

          <span class="detail-row__value">{{ batch?.remainingShelfLifeMonths ?? '—' }} months</span>

        </div>

        <div class="detail-row">

          <span class="detail-row__label">Risk Score</span>

          <span class="detail-row__value">

            <RiskBadge v-if="result?.risk" :level="result.risk.level" :score="result.risk.score" />

            <span v-else>—</span>

          </span>

        </div>

        <div class="detail-row">

          <span class="detail-row__label">Status</span>

          <span class="detail-row__value"><StatusTag :status="result.status" /></span>

        </div>

        <div v-if="result.alternativeBatches?.length" class="detail-row">

          <span class="detail-row__label">Alternatives</span>

          <span class="detail-row__value">{{ result.alternativeBatches.join(', ') }}</span>

        </div>

      </div>



      <div v-if="!result" class="detail-empty-box">

        No simulation yet. Run <strong>Simulate</strong> to see how the algorithm selects a batch.

      </div>



      <div v-if="result?.failureReasons?.length" class="failure-box">

        <div v-for="(msg, i) in result.failureReasons" :key="i">{{ plannerText(msg) }}</div>

      </div>



      <div class="panel-actions">

        <el-button v-if="!result" type="primary" :loading="loading" @click="$emit('simulate')">

          Simulate

        </el-button>

        <el-button
          type="success"
          :loading="loading"
          :disabled="!canExecute"
          :title="executeDisabledReason"
          @click="$emit('execute')"
        >

          Execute Allocation

        </el-button>

        <el-button

          type="warning"

          plain

          :loading="loading"

          :disabled="!canUnallocate"

          @click="$emit('unallocate')"

        >

          Unallocate

        </el-button>

        <el-button @click="$emit('close')">Close</el-button>

      </div>

    </div>

    <div v-else class="panel-body panel-empty">

      Select an order and click <strong>Weiter</strong> to review the allocation decision.

    </div>

  </div>

</template>



<script setup>

import { computed } from 'vue';

import { Close } from '@element-plus/icons-vue';

import StatusTag from '@/components/shared/StatusTag.vue';

import RiskBadge from '@/components/shared/RiskBadge.vue';

import AllocationLogicTimeline from '@/components/simulation/AllocationLogicTimeline.vue';

import { ruleLabel, plannerText } from '@/utils/plannerTerminology';

import { buildAlgorithmSteps, visibleRuleChecks, allGatesPassed } from '@/utils/simulationResult';
import { getApplicableGateRules } from '@/utils/ruleDefinitions';



const props = defineProps({

  order: Object,

  countryRule: Object,

  result: Object,

  batch: Object,

  ruleDefinitions: { type: Array, default: () => [] },

  loading: Boolean,

});



defineEmits(['close', 'simulate', 'execute', 'unallocate']);



const algorithmSteps = computed(() => buildAlgorithmSteps(props.result));

const sortedRuleChecks = computed(() => visibleRuleChecks(props.result?.ruleChecks || [], props.ruleDefinitions));

const canExecute = computed(() => allGatesPassed(props.result));

const executeDisabledReason = computed(() => {
  if (!props.result) return 'Run Simulate first';
  if (!props.result.recommendedBatchId) return 'No batch passed all gates';
  if (!allGatesPassed(props.result)) return 'One or more gates failed — re-simulate';
  if (props.result.status !== 'SIMULATED') return 'Order is not in simulated state';
  return '';
});

const activeRules = computed(() => getApplicableGateRules(props.ruleDefinitions || []));



const canUnallocate = computed(() => {

  if (props.result?.recommendedBatchId) return true;

  if (['SIMULATED', 'ALLOCATED', 'SUCCESS'].includes(props.result?.status)) return true;

  return Boolean(props.order?.allocatedBatchId);

});



function strategyLabel(strategy) {

  if (strategy === 'COMPLIANCE_FIRST') return 'Compliance-first';

  return strategy;

}

</script>



<style scoped>
.simulation-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-size: 0.9375rem;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section__title {
  margin: 0 0 10px;
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
}

.detail-hint {
  margin: 0 0 12px;
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.rule-list,
.eval-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rule-list__item,
.eval-list__item {
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
}

.rule-list__item:last-child,
.eval-list__item:last-child {
  border-bottom: none;
}

.rule-list__head,
.eval-list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.rule-list__name,
.eval-list__name {
  font-weight: 600;
  font-size: 0.9375rem;
  line-height: 1.35;
}

.rule-list__desc,
.eval-list__msg {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--color-text-secondary, #4a5568);
}

.detail-empty {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.45;
}

.detail-empty-box {
  background: var(--color-bg-subtle, #f5f7fa);
  padding: 14px;
  border-radius: 6px;
  font-size: 0.9375rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}

.detail-sub {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-left: 4px;
}

.failure-box {
  background: #ffebee;
  color: var(--color-error);
  padding: 12px 14px;
  border-radius: 6px;
  font-size: 0.9375rem;
  line-height: 1.45;
  margin-bottom: 16px;
}

.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
}

.panel-actions .el-button {
  width: 100%;
  margin: 0;
  font-size: 0.9375rem;
}

.panel-empty {
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1.5;
  text-align: center;
  padding-top: 40px;
}

.simulation-panel :deep(.detail-row) {
  font-size: 0.9375rem;
  padding: 11px 0;
}

.simulation-panel :deep(.panel-header h2) {
  font-size: 1.125rem;
}
</style>


