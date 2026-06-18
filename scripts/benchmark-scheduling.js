#!/usr/bin/env node
/**
 * Benchmark scheduling — dashboard (cached) vs explicit optimize.
 * Usage: node scripts/benchmark-scheduling.js
 * Requires: OR-Tools sidecar when SCHEDULING_OPTIMIZER=ortools
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { DailyPlanningService } = require('../services/dailyPlanningService');
const { SchedulingService } = require('../services/schedulingService');

async function time(label, fn) {
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  console.log(`${label}: ${ms}ms`, result?.solverStatus || result?.engine || '');
  return { ms, result };
}

(async () => {
  const status = await new SchedulingService().getOptimizerStatus();
  console.log('Optimizer:', JSON.stringify(status, null, 2));
  console.log('');

  const svc = new DailyPlanningService();
  await time('planner-dashboard (cached)', () => svc.getPlannerDashboard({}));
  await time('optimize-sequence (explicit)', () => svc.optimizeSequence({}));
  await time('planner-dashboard (2nd, cache)', () => svc.getPlannerDashboard({}));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
