#!/usr/bin/env node
/**
 * MVP 2.0 Enterprise Edition smoke test — verifies core capabilities without HTTP server.
 */
const { DataService } = require('../services/dataService');
const { RuleManagementService, RULE_CATEGORIES } = require('../services/ruleManagementService');
const { ExceptionService } = require('../services/exceptionService');
const { JobService } = require('../services/jobService');
const { CopilotService } = require('../services/copilotService');
const { AllocationService } = require('../services/allocationService');
const { AuthService } = require('../services/authService');
const { getProvider } = require('../providers');
const { EXCEPTION_TYPES } = require('../engines/exceptionEngine');
const { RISK_LEVEL } = require('../engines/riskEngine');

const checks = [];
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function run() {
  console.log('MVP 2.0 Enterprise Edition — Smoke Test\n');

  // 1. Rule Management
  const ruleSvc = new RuleManagementService();
  const rules = ruleSvc.listRules();
  ok('Rule categories (7)', RULE_CATEGORIES.length === 7);
  ok('Versioned rules loaded', rules.rules.length >= 7, `${rules.rules.length} rules`);
  ok('Rule audit log', rules.auditLog.length > 0);
  ok('Rule export', ruleSvc.exportRules().rules.length >= 7);
  ok('Effective rules', ruleSvc.getEffectiveRules().length >= 7);

  // 2. Rules wired to allocation
  const dataSvc = new DataService();
  const runtimeRules = dataSvc.getRules();
  ok('Runtime rules from rulesV2', runtimeRules.rulesSource === 'rulesV2');
  ok('Country rules merged', runtimeRules.countryRules.length >= 5, `${runtimeRules.countryRules.length} countries`);
  ok('Enterprise rule set version', !!runtimeRules.ruleSetVersion, runtimeRules.ruleSetVersion);

  const allocSvc = new AllocationService();
  const sim = allocSvc.simulate({ packagingOrderId: 'FG-20001' });
  ok('Allocation simulation', sim.status === 'SIMULATED', sim.recommendedBatchId);
  ok('Risk engine in allocation', ['LOW', 'MEDIUM', 'HIGH'].includes(sim.risk?.level));
  ok('Risk factors present', (sim.risk?.factors || []).length >= 4, `${sim.risk?.factors?.length} factors`);

  // 3. Exception Management
  const excSvc = new ExceptionService();
  const exceptions = excSvc.list();
  const requiredTypes = [
    'TRIC_VIOLATION', 'RMSL_VIOLATION', 'MISSING_INVENTORY', 'BATCH_SPLIT_RESTRICTION',
    'JAPAN_SEQUENCE_VIOLATION', 'MISSING_SALES_ORDER_LINK', 'MISSING_PACKING_SYSTEM_REF',
  ];
  for (const type of requiredTypes) {
    ok(`Exception type: ${EXCEPTION_TYPES[type]}`, exceptions.some((e) => e.type === type));
  }

  // 4. Mass Allocation
  const jobSvc = new JobService();
  const jobs = jobSvc.listJobs();
  ok('Job history', jobs.length > 0, `${jobs.length} jobs`);
  const job = jobSvc.createMassAllocationJob({ period: 'DAILY', userId: 'SMOKE', execute: false, orderIds: ['FG-20001'] });
  ok('Mass job created', job.status === 'QUEUED', job.jobId);

  await new Promise((r) => setTimeout(r, 300));
  const completed = jobSvc.getJob(job.jobId);
  ok('Mass job progress', completed.progress === 100 || completed.status === 'COMPLETED');

  // 5. RBAC
  const authSvc = new AuthService();
  const roles = ['PLANNER', 'QA', 'SUPPLY_CHAIN', 'ADMIN', 'VIEWER'];
  for (const username of ['planner', 'qa', 'supplychain', 'admin', 'viewer']) {
    const user = authSvc.login(username);
    ok(`Login: ${username}`, user && roles.includes(user.role), user?.role);
  }

  // 6. SAP Integration Prep
  const provider = getProvider();
  ok('IDataProvider active', !!provider.getProviderName(), provider.getProviderName());
  ok('Provider info', !!provider.getProviderInfo().name);

  // 7. Copilot
  const copilot = new CopilotService();
  const answers = [
    'Why was this batch selected?',
    'Why is this order blocked?',
    'What happens if I move this order?',
    'Which batch is recommended?',
  ];
  for (const question of answers) {
    const resp = copilot.ask({ question, packagingOrderId: 'FG-20001' });
    ok(`Copilot: ${question.slice(0, 30)}…`, !!resp.answer && resp.engine === 'InternalReasoningEngine');
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.error('\nFailed:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
  console.log('\nMVP 2.0 Enterprise Edition — all checks passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
