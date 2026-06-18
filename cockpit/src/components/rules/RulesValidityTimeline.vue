<template>
  <div class="validity-timeline">
    <h4 v-if="config.title" class="validity-timeline__heading">{{ config.title }}</h4>
    <p v-if="config.caption" class="validity-timeline__caption" v-html="renderMd(config.caption)" />

    <div class="validity-timeline__panel">
      <div class="validity-timeline__scale">
        <span class="validity-timeline__scale-label">{{ formatDate(rangeStart) }}</span>
        <span class="validity-timeline__scale-label validity-timeline__scale-label--end">{{ formatDate(rangeEnd) }}</span>
      </div>

      <div class="validity-timeline__track-wrap">
        <div class="validity-timeline__today" :style="{ left: `${todayPercent}%` }">
          <span class="validity-timeline__today-line" />
          <span class="validity-timeline__today-label">{{ config.todayLabel }}</span>
        </div>

        <div v-if="!rows.length" class="validity-timeline__empty">
          Keine Gate-Regeln in der Tabelle — legen Sie Regeln an oder laden Sie die Seite neu.
        </div>

        <div v-for="row in rows" :key="row.ruleId" class="validity-timeline__row">
          <div class="validity-timeline__row-label">
            <code>{{ row.ruleId }}</code>
            <span>{{ row.ruleName }}</span>
          </div>
          <div class="validity-timeline__row-track">
            <div
              class="validity-timeline__bar"
              :class="`validity-timeline__bar--${row.tone}`"
              :style="barStyle(row)"
              :title="row.tooltip"
            >
              <span class="validity-timeline__bar-text">{{ row.barLabel }}</span>
            </div>
          </div>
          <span class="validity-timeline__status" :class="`validity-timeline__status--${row.tone}`">
            {{ row.statusLabel }}
          </span>
        </div>
      </div>

      <div class="validity-timeline__legend">
        <span
          v-for="item in config.legend"
          :key="item.tone"
          class="validity-timeline__legend-item"
          :class="`validity-timeline__legend-item--${item.tone}`"
        >
          {{ item.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { isGateRuleType, isRuleEffective } from '@/utils/ruleDefinitions';

const props = defineProps({
  config: { type: Object, required: true },
  ruleDefinitions: { type: Array, default: () => [] },
});

const today = new Date();
today.setHours(12, 0, 0, 0);

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  d.setHours(12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function renderMd(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

const gateRules = computed(() =>
  (props.ruleDefinitions || []).filter((r) => isGateRuleType(r.ruleType)),
);

const rangeStart = computed(() => {
  const pad = new Date(today);
  pad.setMonth(pad.getMonth() - 6);
  let min = pad;
  for (const rule of gateRules.value) {
    const from = parseDate(rule.effectiveFrom);
    if (from && from < min) min = from;
    const to = parseDate(rule.effectiveTo);
    if (to && to < min) min = to;
  }
  return min;
});

const rangeEnd = computed(() => {
  const pad = new Date(today);
  pad.setMonth(pad.getMonth() + 12);
  let max = pad;
  for (const rule of gateRules.value) {
    const from = parseDate(rule.effectiveFrom);
    if (from && from > max) max = from;
    const to = parseDate(rule.effectiveTo);
    if (to && to > max) max = to;
  }
  return max;
});

const rangeMs = computed(() => Math.max(rangeEnd.value - rangeStart.value, 1));

const todayPercent = computed(() => {
  const pct = ((today - rangeStart.value) / rangeMs.value) * 100;
  return Math.min(98, Math.max(2, pct));
});

function classifyRule(rule) {
  const from = parseDate(rule.effectiveFrom);
  const to = parseDate(rule.effectiveTo);
  const active = rule.active !== false;

  if (!active) {
    return {
      tone: 'expired',
      statusLabel: 'Inaktiv',
      barLabel: 'inactive',
      tooltip: `${rule.ruleId}: deaktiviert`,
    };
  }

  if (!from && !to) {
    return {
      tone: 'open',
      statusLabel: 'Unbegrenzt',
      barLabel: 'always',
      tooltip: `${rule.ruleId}: keine Gültigkeitsgrenze`,
    };
  }

  if (from && today < from) {
    return {
      tone: 'future',
      statusLabel: `Ab ${formatDate(from)}`,
      barLabel: `${formatDate(from)} →`,
      tooltip: `${rule.ruleId}: startet am ${formatDate(from)}`,
    };
  }

  if (to && today > to) {
    return {
      tone: 'expired',
      statusLabel: `Bis ${formatDate(to)}`,
      barLabel: `→ ${formatDate(to)}`,
      tooltip: `${rule.ruleId}: abgelaufen am ${formatDate(to)}`,
    };
  }

  const effective = isRuleEffective(rule, today);
  const label = [from ? formatDate(from) : '—', to ? formatDate(to) : 'open'].join(' → ');
  return {
    tone: effective ? 'active' : 'expired',
    statusLabel: effective ? 'Heute gültig' : 'Nicht gültig',
    barLabel: label,
    tooltip: `${rule.ruleId}: ${label}`,
  };
}

const rows = computed(() =>
  gateRules.value.map((rule) => {
    const meta = classifyRule(rule);
    const from = parseDate(rule.effectiveFrom) || rangeStart.value;
    const to = parseDate(rule.effectiveTo) || rangeEnd.value;
    return {
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      from,
      to,
      ...meta,
    };
  }),
);

function barStyle(row) {
  const start = Math.max(row.from, rangeStart.value);
  const end = Math.min(row.to, rangeEnd.value);
  const left = ((start - rangeStart.value) / rangeMs.value) * 100;
  const width = Math.max(((end - start) / rangeMs.value) * 100, 2);
  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}
</script>

<style scoped>
.validity-timeline__heading {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
}

.validity-timeline__caption {
  margin: 0 0 12px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.validity-timeline__panel {
  padding: 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.validity-timeline__scale {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  padding: 0 140px 0 0;
  font-size: 10px;
  color: #94a3b8;
}

.validity-timeline__track-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 60px;
}

.validity-timeline__today {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  transform: translateX(-50%);
}

.validity-timeline__today-line {
  flex: 1;
  width: 2px;
  background: #ef4444;
  border-radius: 1px;
}

.validity-timeline__today-label {
  margin-top: 4px;
  font-size: 9px;
  font-weight: 700;
  color: #dc2626;
  white-space: nowrap;
  background: rgb(255 255 255 / 90%);
  padding: 2px 4px;
  border-radius: 4px;
}

.validity-timeline__row {
  display: grid;
  grid-template-columns: 140px 1fr 100px;
  gap: 10px;
  align-items: center;
}

@media (max-width: 640px) {
  .validity-timeline__row {
    grid-template-columns: 1fr;
  }
  .validity-timeline__scale {
    padding-right: 0;
  }
}

.validity-timeline__row-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
}

.validity-timeline__row-label code {
  font-size: 10px;
  color: #475569;
}

.validity-timeline__row-label span {
  color: #64748b;
  font-size: 10px;
}

.validity-timeline__row-track {
  position: relative;
  height: 22px;
  background: #f1f5f9;
  border-radius: 6px;
  overflow: hidden;
}

.validity-timeline__bar {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 4px;
}

.validity-timeline__bar-text {
  font-size: 9px;
  font-weight: 600;
  color: rgb(15 23 42 / 75%);
  padding: 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.validity-timeline__bar--active { background: #86efac; border: 1px solid #4ade80; }
.validity-timeline__bar--future { background: #fde68a; border: 1px solid #fbbf24; }
.validity-timeline__bar--expired { background: #fecaca; border: 1px solid #f87171; }
.validity-timeline__bar--open {
  left: 0 !important;
  width: 100% !important;
  background: repeating-linear-gradient(
    90deg,
    #dbeafe 0,
    #dbeafe 8px,
    #eff6ff 8px,
    #eff6ff 16px
  );
  border: 1px dashed #93c5fd;
}

.validity-timeline__status {
  font-size: 10px;
  font-weight: 600;
  text-align: right;
}

.validity-timeline__status--active { color: #15803d; }
.validity-timeline__status--future { color: #b45309; }
.validity-timeline__status--expired { color: #b91c1c; }
.validity-timeline__status--open { color: #1d4ed8; }

.validity-timeline__empty {
  padding: 12px;
  font-size: 12px;
  color: #64748b;
  font-style: italic;
}

.validity-timeline__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
  font-size: 10px;
  color: #64748b;
}

.validity-timeline__legend-item::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 5px;
  vertical-align: middle;
}

.validity-timeline__legend-item--active::before { background: #86efac; }
.validity-timeline__legend-item--future::before { background: #fde68a; }
.validity-timeline__legend-item--expired::before { background: #fecaca; }
.validity-timeline__legend-item--open::before {
  background: #dbeafe;
  border: 1px dashed #93c5fd;
}
</style>
