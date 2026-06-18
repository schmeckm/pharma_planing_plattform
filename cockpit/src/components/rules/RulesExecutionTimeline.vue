<template>
  <div class="exec-timeline">
    <h4 v-if="config.title" class="exec-timeline__heading">{{ config.title }}</h4>
    <p v-if="config.caption" class="exec-timeline__caption">{{ config.caption }}</p>

    <div class="exec-timeline__panel">
      <div class="exec-timeline__axis-label">{{ config.axisLabel }}</div>

      <div class="exec-timeline__rail">
        <template v-for="(phase, index) in config.phases" :key="phase.key">
          <div
            v-if="phase.key === 'FIFO'"
            class="exec-timeline__marker"
            :title="config.assignmentMarker"
          >
            <span class="exec-timeline__marker-line" />
            <span class="exec-timeline__marker-text">{{ config.assignmentMarker }}</span>
          </div>

          <div class="exec-timeline__phase" :class="`exec-timeline__phase--${phase.tone}`">
            <div class="exec-timeline__node">{{ phase.shortLabel }}</div>
            <div class="exec-timeline__phase-body">
              <strong>{{ phase.label }}</strong>
              <span class="exec-timeline__hint">{{ phase.hint }}</span>
              <div v-if="phase.rules?.length" class="exec-timeline__rules">
                <code v-for="ruleId in phase.rules" :key="ruleId">{{ ruleId }}</code>
              </div>
            </div>
          </div>

          <div
            v-if="index < config.phases.length - 1"
            class="exec-timeline__connector"
            :class="{ 'exec-timeline__connector--gate': phase.tone === 'gate' }"
            aria-hidden="true"
          />
        </template>
      </div>

      <div class="exec-timeline__legend">
        <span class="exec-timeline__legend-item exec-timeline__legend-item--gate">Gates (müssen passieren)</span>
        <span class="exec-timeline__legend-item exec-timeline__legend-item--assign">Chargenwahl</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  config: { type: Object, required: true },
});
</script>

<style scoped>
.exec-timeline__heading {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
}

.exec-timeline__caption {
  margin: 0 0 12px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.exec-timeline__panel {
  padding: 14px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow-x: auto;
}

.exec-timeline__axis-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  margin-bottom: 12px;
}

.exec-timeline__rail {
  display: flex;
  align-items: flex-start;
  min-width: 720px;
  padding-bottom: 4px;
}

.exec-timeline__marker {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  align-self: stretch;
  width: 28px;
  margin: 0 2px;
}

.exec-timeline__marker-line {
  flex: 1;
  width: 2px;
  min-height: 40px;
  background: repeating-linear-gradient(180deg, #f59e0b 0, #f59e0b 4px, transparent 4px, transparent 8px);
}

.exec-timeline__marker-text {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 9px;
  font-weight: 700;
  color: #b45309;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  margin-top: 6px;
}

.exec-timeline__phase {
  flex: 1 1 0;
  min-width: 88px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.exec-timeline__node {
  width: 100%;
  max-width: 72px;
  padding: 5px 4px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
}

.exec-timeline__phase--setup .exec-timeline__node {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.exec-timeline__phase--gate .exec-timeline__node {
  border-color: #93c5fd;
  background: #dbeafe;
  color: #1d4ed8;
}

.exec-timeline__phase--assign .exec-timeline__node {
  border-color: #86efac;
  background: #dcfce7;
  color: #15803d;
}

.exec-timeline__phase--result .exec-timeline__node {
  border-color: #c4b5fd;
  background: #ede9fe;
  color: #6d28d9;
}

.exec-timeline__phase-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-align: center;
  padding: 0 4px;
}

.exec-timeline__phase-body strong {
  font-size: 11px;
  color: #0f172a;
}

.exec-timeline__hint {
  font-size: 10px;
  color: #64748b;
  line-height: 1.35;
}

.exec-timeline__rules {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
  margin-top: 4px;
}

.exec-timeline__rules code {
  font-size: 9px;
  padding: 1px 4px;
  background: rgb(255 255 255 / 80%);
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  color: #334155;
}

.exec-timeline__connector {
  flex: 0 0 16px;
  height: 2px;
  margin-top: 14px;
  background: #94a3b8;
}

.exec-timeline__connector--gate {
  background: #60a5fa;
}

.exec-timeline__legend {
  display: flex;
  gap: 16px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
  font-size: 10px;
  color: #64748b;
}

.exec-timeline__legend-item::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}

.exec-timeline__legend-item--gate::before {
  background: #3b82f6;
}

.exec-timeline__legend-item--assign::before {
  background: #22c55e;
}
</style>
