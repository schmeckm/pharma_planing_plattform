/** SAP-style operation time colors (setup · production · teardown). */

export const OP_TIME_COLORS = {
  setup: '#e9730c',
  production: '#0a6ed1',
  teardown: '#7b4fbf',
};

export const OP_TIME_LABELS = {
  setup: 'Rüstzeit',
  production: 'Produktionszeit',
  teardown: 'Abrüstzeit',
};

export function hasOperationTimeBreakdown(task) {
  return task?.operationNo != null
    && (task.setupHours != null || task.productionHours != null || task.teardownHours != null);
}

export function operationTimeSegments(task) {
  const setup = Number(task.setupHours) || 0;
  const production = Number(task.productionHours) || 0;
  const teardown = Number(task.teardownHours) || 0;
  const total = setup + production + teardown;
  if (total <= 0) return [];

  return [
    { key: 'setup', label: OP_TIME_LABELS.setup, hours: setup, color: OP_TIME_COLORS.setup, pct: (setup / total) * 100 },
    { key: 'production', label: OP_TIME_LABELS.production, hours: production, color: OP_TIME_COLORS.production, pct: (production / total) * 100 },
    { key: 'teardown', label: OP_TIME_LABELS.teardown, hours: teardown, color: OP_TIME_COLORS.teardown, pct: (teardown / total) * 100 },
  ].filter((s) => s.hours > 0);
}
