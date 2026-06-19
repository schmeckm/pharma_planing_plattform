/** Planner-facing labels — hide engine-internal names from the UI. */

export const PLANNER_LABELS = {
  SHELF_LIFE_RISK: 'Shelf-Life Risk',
  SHELF_LIFE_COMPLIANCE: 'Shelf-Life Compliance',
  SHELF_LIFE_MONTHS: 'Shelf-Life (mo)',
  MARKET_RELEASE: 'Market Release',
  MARKET_RELEASE_CHECK: 'Market Release Check',
  PLANNING_EXCEPTIONS: 'Planning Exceptions',
  WHAT_IF_SIMULATION: 'What-if Simulation',
  RECOMMENDED_SEQUENCE: 'Recommended Sequence',
  SEQUENCE_CHECK: 'Sequence Check',
  TODAYS_ORDERS: "Today's Orders",
  PRODUCTION_SEQUENCING: 'Production Sequencing',
  DETAILED_SCHEDULING: 'Detailed Scheduling',
  BATCH_RECOMMENDATIONS: 'Batch Recommendations',
  CONFIRMED_BATCH_ASSIGNMENTS: 'Confirmed Batch Assignments',
  DAILY_PLANNING_DASHBOARD: 'Daily Planning Dashboard',
  AUDIT_TRAIL: 'Audit Trail',
  RULES: 'Rules',
  HARD_ALLOCATION: 'Confirmed Batch Assignment',
};

/** Primary planner navigation — flat list kept for compatibility; sidebar uses NAV_BASE in messages.js */
export const PLANNER_NAV = [
  { path: '/wizard', label: 'Daily Wizard', icon: 'Guide' },
  { path: '/detailed-scheduling', label: PLANNER_LABELS.DETAILED_SCHEDULING, icon: 'Calendar' },
  { path: '/line-optimization', label: PLANNER_LABELS.PRODUCTION_SEQUENCING, icon: 'Sort' },
  { path: '/simulation', label: PLANNER_LABELS.BATCH_RECOMMENDATIONS, icon: 'CircleCheck' },
  { path: '/allocations', label: 'Allocations', icon: 'Connection' },
  { path: '/confirmed-assignments', label: PLANNER_LABELS.CONFIRMED_BATCH_ASSIGNMENTS, icon: 'Finished' },
  { path: '/control-tower', label: 'Control Tower', icon: 'Monitor', permission: 'orders:read' },
  { path: '/exceptions', label: PLANNER_LABELS.PLANNING_EXCEPTIONS, icon: 'Warning', permission: 'exceptions:read' },
  { path: '/inventory', label: 'Batch Inventory', icon: 'Box' },
  { path: '/rule-management', label: 'Rule Management', icon: 'Setting', permission: 'rules:read' },
  { path: '/audit', label: PLANNER_LABELS.AUDIT_TRAIL, icon: 'Document' },
];

const RULE_NAME_LABELS = {
  'TRIC Validation': PLANNER_LABELS.MARKET_RELEASE_CHECK,
  'RMSL Validation': 'Shelf-Life Risk Check',
  'Japan Sequence': PLANNER_LABELS.SEQUENCE_CHECK,
  'Sequence Validation': PLANNER_LABELS.SEQUENCE_CHECK,
  'FIFO Selection': PLANNER_LABELS.RECOMMENDED_SEQUENCE,
  'Optimization Engine': PLANNER_LABELS.RECOMMENDED_SEQUENCE,
};

const EXCEPTION_TYPE_LABELS = {
  'Market Release Violation': 'Market Release Exception',
  'Shelf-Life Risk': 'Shelf-Life Risk Exception',
  'Japan Sequence Violation': 'Sequence Check Exception',
  'TRIC Violation': 'Market Release Exception',
  'RMSL Violation': 'Shelf-Life Risk Exception',
};

const RULE_TYPE_LABELS = {
  OPTIMIZATION: PLANNER_LABELS.RECOMMENDED_SEQUENCE,
  SEQUENCING: PLANNER_LABELS.SEQUENCE_CHECK,
};

const TEXT_REPLACEMENTS = [
  [/TRIC Validation/gi, PLANNER_LABELS.MARKET_RELEASE_CHECK],
  [/RMSL Validation/gi, 'Shelf-Life Risk Check'],
  [/Sequence Validation/gi, PLANNER_LABELS.SEQUENCE_CHECK],
  [/Optimization Engine/gi, PLANNER_LABELS.RECOMMENDED_SEQUENCE],
  [/Allocation Simulation/gi, PLANNER_LABELS.WHAT_IF_SIMULATION],
  [/Blocked Orders/gi, PLANNER_LABELS.PLANNING_EXCEPTIONS],
  [/Hard Allocation/gi, PLANNER_LABELS.HARD_ALLOCATION],
  [/Japan Sequence/gi, PLANNER_LABELS.SEQUENCE_CHECK],
  [/FIFO Selection/gi, PLANNER_LABELS.RECOMMENDED_SEQUENCE],
  [/\bRMSL\b/g, PLANNER_LABELS.SHELF_LIFE_RISK],
  [/\bTRIC\b/g, PLANNER_LABELS.MARKET_RELEASE],
];

export function ruleLabel(ruleName) {
  return RULE_NAME_LABELS[ruleName] || ruleName;
}

export function exceptionLabel(typeLabel) {
  return EXCEPTION_TYPE_LABELS[typeLabel] || typeLabel;
}

export function ruleTypeLabel(ruleType) {
  return RULE_TYPE_LABELS[ruleType] || ruleType;
}

export function plannerText(text) {
  if (!text || typeof text !== 'string') return text;
  return TEXT_REPLACEMENTS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
}
