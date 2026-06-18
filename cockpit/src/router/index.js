import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getFeatureIdForPath, findFirstAccessiblePath } from '@/config/features';
import CockpitLayout from '@/layouts/CockpitLayout.vue';

const routes = [
  {
    path: '/',
    component: CockpitLayout,
    redirect: '/wizard',
    children: [
      { path: 'wizard', name: 'DailyWizard', component: () => import('@/views/DailyWizardView.vue'), meta: { title: 'Tages-Wizard', featureId: 'daily-wizard' } },
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: 'Dashboard', featureId: 'dashboard' } },
      { path: 'help', name: 'Help', component: () => import('@/views/HelpView.vue'), meta: { title: 'Hilfe & Überblick', featureId: 'help' } },
      { path: 'daily-planning', name: 'DailyPlanning', component: () => import('@/views/DailyPlanningDashboardView.vue'), meta: { title: 'Daily Planning Dashboard', featureId: 'daily-planning' } },
      { path: 'simulation', name: 'Simulation', component: () => import('@/views/SimulationView.vue'), meta: { title: 'Batch Recommendations', featureId: 'simulation' } },
      { path: 'orders', name: 'Orders', component: () => import('@/views/OrdersView.vue'), meta: { title: "Today's Orders", featureId: 'orders' } },
      { path: 'allocations', name: 'Allocations', component: () => import('@/views/AllocationsView.vue'), meta: { title: 'Allocations', featureId: 'allocations' } },
      { path: 'confirmed-assignments', name: 'ConfirmedBatchAssignments', component: () => import('@/views/ConfirmedBatchAssignmentsView.vue'), meta: { title: 'Confirmed Batch Assignments', featureId: 'confirmed-assignments' } },
      { path: 'inventory', name: 'BatchInventory', component: () => import('@/views/BatchInventoryView.vue'), meta: { title: 'Batch Inventory', featureId: 'inventory' } },
      { path: 'rules', name: 'Rules', component: () => import('@/views/RulesView.vue'), meta: { title: 'Rules', featureId: 'rules-legacy' } },
      { path: 'reports', name: 'Reports', component: () => import('@/views/ReportsView.vue'), meta: { title: 'Reports', featureId: 'reports' } },
      { path: 'analytics', name: 'PerformanceAnalytics', component: () => import('@/views/PerformanceAnalyticsView.vue'), meta: { title: 'Leistungsgrad-Analyse', featureId: 'analytics' } },
      { path: 'prognosis', name: 'MlPrognosis', component: () => import('@/views/MlPrognosisView.vue'), meta: { title: 'ML-Prognose', featureId: 'ml-prognosis' } },
      { path: 'audit', name: 'AuditTrail', component: () => import('@/views/AuditTrailView.vue'), meta: { title: 'Audit Trail', featureId: 'audit' } },
      { path: 'admin', name: 'Administration', component: () => import('@/views/AdministrationView.vue'), meta: { title: 'Administration', featureId: 'admin-system' } },
      { path: 'rule-management', name: 'RuleManagement', component: () => import('@/views/v2/RuleManagementView.vue'), meta: { title: 'Rule Management', edition: '2.0', featureId: 'rule-management' } },
      { path: 'what-if', name: 'WhatIf', component: () => import('@/views/v2/WhatIfView.vue'), meta: { title: 'What-If Simulation', edition: '2.0', featureId: 'what-if' } },
      { path: 'exceptions', name: 'Exceptions', component: () => import('@/views/v2/ExceptionsView.vue'), meta: { title: 'Planning Exceptions', edition: '2.0', featureId: 'exceptions' } },
      { path: 'mass-jobs', name: 'MassJobs', component: () => import('@/views/v2/MassJobsView.vue'), meta: { title: 'Mass Allocation', edition: '2.0', featureId: 'mass-jobs' } },
      { path: 'copilot', name: 'Copilot', component: () => import('@/views/v2/CopilotView.vue'), meta: { title: 'Allocation Copilot', edition: '2.0', featureId: 'allocation-copilot' } },
      { path: 'executive', name: 'ExecutiveCockpit', component: () => import('@/views/v3/ExecutiveCockpitView.vue'), meta: { title: 'Executive Cockpit', edition: '3.0', featureId: 'executive-cockpit' } },
      { path: 'agents', name: 'AgentConsole', component: () => import('@/views/v3/AgentConsoleView.vue'), meta: { title: 'Agent Console', edition: '3.0', featureId: 'agent-console' } },
      { path: 'copilot-v3', name: 'CopilotV3', component: () => import('@/views/v3/CopilotV3View.vue'), meta: { title: 'Copilot v3', edition: '3.0', featureId: 'planning-copilot' } },
      { path: 'autopilot', name: 'Autopilot', component: () => import('@/views/v3/AutopilotView.vue'), meta: { title: 'Planning Autopilot', edition: '4.0', featureId: 'autopilot' } },
      { path: 'control-tower', name: 'ControlTower', component: () => import('@/views/v4/ControlTowerView.vue'), meta: { title: 'Control Tower', edition: '4.0', featureId: 'control-tower' } },
      { path: 'planning', name: 'Planning', component: () => import('@/views/v5/PlanningHubView.vue'), meta: { title: 'Time Planning', edition: '5.0', featureId: 'time-planning' } },
      { path: 'line-optimization', name: 'LineOptimization', component: () => import('@/views/LineOptimizationView.vue'), meta: { title: 'Production Sequencing', edition: '5.0', featureId: 'line-optimization' } },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export function setupRouterGuards(routerInstance) {
  routerInstance.beforeEach((to, _from, next) => {
    const auth = useAuthStore();
    const featureId = to.meta.featureId || getFeatureIdForPath(to.path);
    if (!featureId || !auth.isAuthenticated || auth.canAccessPath(to.path)) {
      next();
      return;
    }

    const fallback = findFirstAccessiblePath((path) => auth.canAccessPath(path), to.path);
    if (!fallback) {
      if (to.path === '/help') {
        next();
        return;
      }
      next({ path: '/help', query: { accessDenied: featureId } });
      return;
    }

    if (to.path === fallback) {
      next();
      return;
    }

    next({ path: fallback, query: { accessDenied: featureId } });
  });
}

router.afterEach(() => {
  // Document title is set reactively in CockpitLayout (locale-aware).
});

export default router;
