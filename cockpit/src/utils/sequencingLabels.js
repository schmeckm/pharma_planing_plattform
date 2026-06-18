/** English — Production Sequencing (planner cockpit) */



export const SEQ_LABELS = {

  PAGE_SUBTITLE: 'Sequence rough-cut packaging orders per packaging line',

  GANTT_TITLE: 'Production Gantt',

  GANTT_HINT: 'Drag orders horizontally to reschedule · Drag to another line to reassign · Risk recalculates after each change',

  GANTT_LEGEND_MOVED: 'Changed by optimization',

  GANTT_FILTER_MOVED: 'Moved orders only',

  GANTT_LINE_IMBALANCE: '{pct}% of orders on {line} — review line load',

  ORDER_DETAIL: 'Order detail',

  SELECT_ORDER: 'Select a packaging order in the Gantt',

  LOADING: 'Loading plan…',

  PRODUCTION_LINE: 'Packaging line',



  TOOLBAR_PLAN: 'Plan',

  TOOLBAR_SIMULATE: 'Simulate',

  TOOLBAR_PUBLISH: 'Publish',

  BUILD_SEQUENCE: 'Build recommended sequence',

  WHAT_IF: 'What-if simulation',

  SAVE_DRAFT: 'Save draft',

  CONFIRM: 'Confirm sequence',

  ACTIVATE: 'Activate plan',

  MORE: 'More',

  REFRESH: 'Refresh dashboard',

  WORKFLOW_SHADOW: 'Flow: build sequence → save draft → confirm → activate plan (allocation).',

  WORKFLOW_DIRECT: 'Flow: build sequence → confirm → batch recommendations on dashboard.',

  ACTIVATE_READY: 'Promotes the draft to the live plan (RULE-014).',

  ACTIVATE_BLOCKED: 'Confirm the sequence first (draft must be READY).',



  KPI_OPEN: 'Open orders',

  KPI_HIGH_RISK: 'High risk',

  KPI_LATE: 'Late',

  KPI_RMSL: 'Shelf-life risk',

  KPI_SEQUENCE: 'Sequence check',

  KPI_EXCEPTIONS: 'Planning exceptions',

  KPI_PEAK_UTIL: 'Peak utilization',

  GANTT_VIEW_PACKAGING: 'Packaging (PO)',
  GANTT_VIEW_OPERATIONS: 'Operations (routing)',
  OPERATIONS_HINT: 'SAP routings + finite scheduling across all work centers (Phase 5).',
  OPERATIONS_SAP_ROUTING: 'SAP routing',
  OPERATIONS_TEMPLATE_ROUTING: 'Template routing',
  OPERATIONS_SOLVER_ORTOOLS: 'Ops OR-Tools',
  OPERATIONS_SOLVER_HEURISTIC: 'Ops heuristic',
  OPERATIONS_SOLVER_FALLBACK: 'Ops fallback',
};

