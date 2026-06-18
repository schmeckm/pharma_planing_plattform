/** Cockpit-Route-Definitionen für das Portal (Präfix /planning). */
export const COCKPIT_ROUTE_DEFS = [
  { path: 'wizard', name: 'DailyWizard', featureId: 'daily-wizard', component: () => import('../../../../cockpit/src/views/DailyWizardView.vue') },
  { path: 'dashboard', name: 'PlanningDashboard', featureId: 'dashboard', component: () => import('../../../../cockpit/src/views/DashboardView.vue') },
  { path: 'help', name: 'PlanningHelp', featureId: 'help', component: () => import('../../../../cockpit/src/views/HelpView.vue') },
  { path: 'daily-planning', name: 'DailyPlanning', featureId: 'daily-planning', component: () => import('../../../../cockpit/src/views/DailyPlanningDashboardView.vue') },
  { path: 'simulation', name: 'Simulation', featureId: 'simulation', component: () => import('../../../../cockpit/src/views/SimulationView.vue') },
  { path: 'orders', name: 'Orders', featureId: 'orders', component: () => import('../../../../cockpit/src/views/OrdersView.vue') },
  { path: 'allocations', name: 'Allocations', featureId: 'allocations', component: () => import('../../../../cockpit/src/views/AllocationsView.vue') },
  { path: 'confirmed-assignments', name: 'ConfirmedBatchAssignments', featureId: 'confirmed-assignments', component: () => import('../../../../cockpit/src/views/ConfirmedBatchAssignmentsView.vue') },
  { path: 'inventory', name: 'BatchInventory', featureId: 'inventory', component: () => import('../../../../cockpit/src/views/BatchInventoryView.vue') },
  { path: 'rules', name: 'Rules', featureId: 'rules-legacy', component: () => import('../../../../cockpit/src/views/RulesView.vue') },
  { path: 'reports', name: 'Reports', featureId: 'reports', component: () => import('../../../../cockpit/src/views/ReportsView.vue') },
  { path: 'analytics', name: 'PerformanceAnalytics', featureId: 'analytics', component: () => import('../../../../cockpit/src/views/PerformanceAnalyticsView.vue') },
  { path: 'prognosis', name: 'MlPrognosis', featureId: 'ml-prognosis', component: () => import('../../../../cockpit/src/views/MlPrognosisView.vue') },
  { path: 'audit', name: 'PlanningAuditTrail', featureId: 'audit', component: () => import('../../../../cockpit/src/views/AuditTrailView.vue') },
  { path: 'admin', name: 'PlanningAdministration', featureId: 'admin-system', component: () => import('../../../../cockpit/src/views/AdministrationView.vue') },
  { path: 'rule-management', name: 'RuleManagement', featureId: 'rule-management', component: () => import('../../../../cockpit/src/views/v2/RuleManagementView.vue') },
  { path: 'what-if', name: 'WhatIf', featureId: 'what-if', component: () => import('../../../../cockpit/src/views/v2/WhatIfView.vue') },
  { path: 'exceptions', name: 'Exceptions', featureId: 'exceptions', component: () => import('../../../../cockpit/src/views/v2/ExceptionsView.vue') },
  { path: 'mass-jobs', name: 'MassJobs', featureId: 'mass-jobs', component: () => import('../../../../cockpit/src/views/v2/MassJobsView.vue') },
  { path: 'copilot', name: 'Copilot', featureId: 'allocation-copilot', component: () => import('../../../../cockpit/src/views/v2/CopilotView.vue') },
  { path: 'executive', name: 'ExecutiveCockpit', featureId: 'executive-cockpit', component: () => import('../../../../cockpit/src/views/v3/ExecutiveCockpitView.vue') },
  { path: 'agents', name: 'AgentConsole', featureId: 'agent-console', component: () => import('../../../../cockpit/src/views/v3/AgentConsoleView.vue') },
  { path: 'copilot-v3', name: 'CopilotV3', featureId: 'planning-copilot', component: () => import('../../../../cockpit/src/views/v3/CopilotV3View.vue') },
  { path: 'autopilot', name: 'Autopilot', featureId: 'autopilot', component: () => import('../../../../cockpit/src/views/v3/AutopilotView.vue') },
  { path: 'control-tower', name: 'ControlTower', featureId: 'control-tower', component: () => import('../../../../cockpit/src/views/v4/ControlTowerView.vue') },
  { path: 'planning', name: 'Planning', featureId: 'time-planning', component: () => import('../../../../cockpit/src/views/v5/PlanningHubView.vue') },
  { path: 'line-optimization', name: 'LineOptimization', featureId: 'line-optimization', component: () => import('../../../../cockpit/src/views/LineOptimizationView.vue') },
];

export function buildPlanningRoutes() {
  return COCKPIT_ROUTE_DEFS.map((route) => ({
    path: route.path,
    name: route.name,
    component: route.component,
    meta: {
      featureId: route.featureId,
      requiresAuth: true,
      isPlanning: true,
    },
  }));
}
