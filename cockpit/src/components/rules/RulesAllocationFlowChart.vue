<template>
  <div class="rules-flow">
    <h4 v-if="title" class="rules-flow__heading">{{ title }}</h4>
    <p v-if="caption" class="rules-flow__caption">{{ caption }}</p>

    <div class="rules-flow__chart" :aria-label="caption || title">
      <template v-for="(step, index) in steps" :key="step.id">
        <div
          v-if="step.type === 'start' || step.type === 'process' || step.type === 'end'"
          class="flow-box"
          :class="[
            `flow-box--${step.type}`,
            step.tone ? `flow-box--${step.tone}` : '',
          ]"
        >
          <strong>{{ step.label }}</strong>
          <span v-if="step.detail" class="flow-box__detail">{{ step.detail }}</span>
        </div>

        <div v-else-if="step.type === 'decision'" class="flow-decision">
          <div class="flow-decision__diamond">
            <span>{{ step.label }}</span>
          </div>
          <div class="flow-decision__branches">
            <div
              v-for="branch in step.branches"
              :key="branch.outcome"
              class="flow-branch"
              :class="`flow-branch--${branch.tone}`"
            >
              <span class="flow-branch__label">{{ branch.label }}</span>
              <span class="flow-branch__arrow">→</span>
              <span class="flow-branch__target">{{ branch.targetLabel || branchTargetLabel(branch.target) }}</span>
            </div>
          </div>
        </div>

        <div v-else-if="step.type === 'pipeline'" class="flow-pipeline">
          <div
            v-for="(phase, phaseIndex) in step.phases"
            :key="phase"
            class="flow-pipeline__phase"
          >
            <span class="flow-pipeline__text">{{ phase }}</span>
            <span v-if="phaseIndex < step.phases.length - 1" class="flow-pipeline__sep">→</span>
          </div>
        </div>

        <div v-if="showConnector(index)" class="flow-connector" aria-hidden="true">
          <span class="flow-connector__line" />
          <span class="flow-connector__arrow">▼</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  title: { type: String, default: '' },
  caption: { type: String, default: '' },
  steps: { type: Array, default: () => [] },
});

function branchTargetLabel(targetId) {
  const target = props.steps.find((s) => s.id === targetId);
  return target?.label || targetId;
}

function showConnector(index) {
  const step = props.steps[index];
  const next = props.steps[index + 1];
  if (!next) return false;
  if (step.type === 'decision') return false;
  if (step.type === 'end' && step.tone === 'danger') return false;
  if (next.type === 'end' && next.id.startsWith('failed') && step.id.startsWith('failed')) return false;
  return true;
}
</script>

<style scoped>
.rules-flow__heading {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
}

.rules-flow__caption {
  margin: 0 0 14px;
  font-size: 12px;
  color: var(--color-text-muted, #6b7280);
  line-height: 1.5;
}

.rules-flow__chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 16px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid var(--el-border-color-lighter, #e2e8f0);
  border-radius: 10px;
  overflow-x: auto;
}

.flow-box {
  width: min(100%, 420px);
  padding: 10px 14px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #cbd5e1;
  background: #fff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
}

.flow-box strong {
  display: block;
  font-size: 13px;
  color: #0f172a;
}

.flow-box__detail {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
}

.flow-box--start {
  border-color: #93c5fd;
  background: #eff6ff;
}

.flow-box--end.flow-box--success {
  border-color: #86efac;
  background: #f0fdf4;
}

.flow-box--end.flow-box--danger {
  border-color: #fca5a5;
  background: #fef2f2;
}

.flow-decision {
  width: min(100%, 480px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.flow-decision__diamond {
  width: 200px;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  transform: rotate(0deg);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  /* clip-path makes text hard to read — use rounded box instead */
  clip-path: none;
  border-radius: 8px;
}

.flow-decision__branches {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  width: 100%;
}

.flow-branch {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.flow-branch--success { border-color: #bbf7d0; background: #f0fdf4; }
.flow-branch--danger { border-color: #fecaca; background: #fef2f2; }

.flow-branch__label { font-weight: 600; }
.flow-branch__arrow { color: #94a3b8; }
.flow-branch__target { color: #475569; }

.flow-pipeline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px 8px;
  width: min(100%, 560px);
  padding: 10px 12px;
  background: #fff;
  border: 1px dashed #94a3b8;
  border-radius: 8px;
}

.flow-pipeline__phase {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.flow-pipeline__text {
  font-size: 12px;
  font-weight: 600;
  color: #1e40af;
  padding: 4px 10px;
  background: #dbeafe;
  border-radius: 6px;
}

.flow-pipeline__sep {
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
}

.flow-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 28px;
  color: #94a3b8;
}

.flow-connector__line {
  flex: 1;
  width: 2px;
  background: #cbd5e1;
}

.flow-connector__arrow {
  font-size: 10px;
  line-height: 1;
}
</style>
