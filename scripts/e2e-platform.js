#!/usr/bin/env node
/**
 * End-to-end HTTP smoke test — verifies API server, auth, planning, and enterprise modules.
 * Usage: node scripts/e2e-platform.js [baseUrl]
 * Default baseUrl: http://localhost:8000
 */
const { WebSocket } = require('ws');

const BASE = (process.argv[2] || process.env.E2E_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const checks = [];

function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': 'USR-E2E01',
    'x-user-role': options.role || 'PLANNER',
    'x-user-name': 'E2E Tester',
    ...options.headers,
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, ok: res.ok };
}

function wsUrl(path) {
  const u = new URL(BASE);
  const proto = u.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${u.host}${path}`;
}

async function testWebSocket() {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl('/ws/control-tower'));
    const timer = setTimeout(() => {
      ws.terminate();
      resolve(false);
    }, 5000);
    ws.on('open', () => {
      clearTimeout(timer);
      ws.close();
      resolve(true);
    });
    ws.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function run() {
  console.log(`Hard Allocation Platform — E2E Test\nBase URL: ${BASE}\n`);

  // ── Infrastructure ──────────────────────────────────────────────
  const health = await request('/health');
  ok('GET /health', health.status === 200 && health.data?.status === 'healthy', health.data?.version);
  ok('Health edition', health.data?.edition?.includes('Pharmaceutical'));

  const docs = await fetch(`${BASE}/docs/`);
  ok('GET /docs (Swagger UI)', docs.status === 200);

  const openapi = await fetch(`${BASE}/openapi.yaml`);
  ok('GET /openapi.yaml', openapi.status === 200 && (await openapi.text()).includes('openapi'));

  // ── API v1 — Core & Planning ────────────────────────────────────
  const dashboard = await request('/api/v1/dashboard');
  ok('GET /api/v1/dashboard', dashboard.ok && typeof dashboard.data?.openOrders === 'number', `${dashboard.data?.openOrders} open orders`);

  const orders = await request('/api/v1/orders');
  const orderList = Array.isArray(orders.data) ? orders.data : orders.data?.orders;
  ok('GET /api/v1/orders', orders.ok && Array.isArray(orderList) && orderList.length > 0, `${orderList?.length || 0} orders`);

  const batches = await request('/api/v1/batches');
  const batchList = Array.isArray(batches.data) ? batches.data : batches.data?.batches;
  ok('GET /api/v1/batches', batches.ok && Array.isArray(batchList) && batchList.length > 0, `${batchList?.length || 0} batches`);

  const simulate = await request('/api/v1/allocation/simulate', {
    method: 'POST',
    body: { packagingOrderId: 'FG-20001' },
  });
  ok('POST /api/v1/allocation/simulate', simulate.ok && simulate.data?.status === 'SIMULATED', simulate.data?.recommendedBatchId);

  const plannerDash = await request('/api/v1/planning/planner-dashboard');
  ok('GET /api/v1/planning/planner-dashboard', plannerDash.ok && plannerDash.data?.kpis?.openOrders != null, `${plannerDash.data?.kpis?.openOrders} open`);
  ok('Planner recommendations', plannerDash.ok && plannerDash.data?.recommendations?.sequence?.length > 0);

  const dailyOrders = await request('/api/v1/planning/daily-orders');
  ok('GET /api/v1/planning/daily-orders', dailyOrders.ok && Array.isArray(dailyOrders.data?.orders), `${dailyOrders.data?.orders?.length || 0} orders`);

  const sequence = await request('/api/v1/planning/recommended-sequence');
  ok('GET /api/v1/planning/recommended-sequence', sequence.ok && Array.isArray(sequence.data?.sequence), `${sequence.data?.sequence?.length || 0} slots`);

  const lineScores = await request('/api/v1/performance/line-scores');
  ok('GET /api/v1/performance/line-scores', lineScores.ok && Array.isArray(lineScores.data?.items), `${lineScores.data?.items?.length || 0} line scores`);

  const recommendLine = await request('/api/v1/performance/recommend-line?materialNumber=DP-1000');
  ok('GET /api/v1/performance/recommend-line', recommendLine.ok && recommendLine.data?.recommendedLineId, recommendLine.data?.recommendedLineId);

  const planningExceptions = await request('/api/v1/planning/exceptions');
  ok('GET /api/v1/planning/exceptions', planningExceptions.ok && Array.isArray(planningExceptions.data?.exceptions));

  // ── API v2 — Enterprise ─────────────────────────────────────────
  const login = await request('/api/v2/auth/login', {
    method: 'POST',
    body: { username: 'planner' },
  });
  ok('POST /api/v2/auth/login', login.ok && login.data?.role === 'PLANNER', login.data?.displayName);

  const rules = await request('/api/v2/rules');
  ok('GET /api/v2/rules', rules.ok && rules.data?.rules?.length >= 7, `${rules.data?.rules?.length} rules`);

  const exceptions = await request('/api/v2/exceptions');
  ok('GET /api/v2/exceptions', exceptions.ok && exceptions.data?.length >= 7, `${exceptions.data?.length} exceptions`);

  const jobs = await request('/api/v2/jobs');
  ok('GET /api/v2/jobs', jobs.ok && Array.isArray(jobs.data));

  const copilot = await request('/api/v2/copilot/ask', {
    method: 'POST',
    body: { question: 'Why was this batch selected?', packagingOrderId: 'FG-20001' },
  });
  ok('POST /api/v2/copilot/ask', copilot.ok && copilot.data?.answer, copilot.data?.engine);

  const provider = await request('/api/v2/provider');
  ok('GET /api/v2/provider', provider.ok && provider.data?.name);

  const whatIf = await request('/api/v2/what-if/simulate', {
    method: 'POST',
    body: { packagingOrderId: 'FG-20001', scenarioType: 'BATCH_SWAP' },
  });
  ok('POST /api/v2/what-if/simulate', whatIf.ok && whatIf.data?.scenarioId);

  // RBAC: viewer cannot create jobs
  const forbidden = await request('/api/v2/jobs/mass-allocation', {
    method: 'POST',
    role: 'VIEWER',
    body: { period: 'DAILY', orderIds: ['FG-20001'], execute: false },
  });
  ok('RBAC: VIEWER denied job create', forbidden.status === 403);

  // ── API v3 — Intelligence ─────────────────────────────────────────
  const execDash = await request('/api/v3/executive/dashboard');
  ok('GET /api/v3/executive/dashboard', execDash.ok && execDash.data?.kpis);
  ok('Executive daily summary', execDash.ok && execDash.data?.dailySummary?.openOrders != null);

  const morning = await request('/api/v3/agents/morning-briefing');
  ok('GET /api/v3/agents/morning-briefing', morning.ok && morning.data?.summary?.openOrders != null);

  const copilotV3 = await request('/api/v3/copilot/ask', {
    method: 'POST',
    body: { question: 'Why was this line recommended?', packagingOrderId: 'FG-20001' },
  });
  ok('POST /api/v3/copilot/ask', copilotV3.ok && copilotV3.data?.answer);

  const predictions = await request('/api/v3/predictions');
  ok('GET /api/v3/predictions', predictions.ok);

  const recs = await request('/api/v3/recommendations');
  ok('GET /api/v3/recommendations', recs.ok && Array.isArray(recs.data?.recommendations));

  const autopilotStatus = await request('/api/v3/autopilot/status');
  ok('GET /api/v3/autopilot/status', autopilotStatus.ok && autopilotStatus.data?.policy?.enabled != null);

  const autopilotRun = await request('/api/v3/autopilot/run', {
    method: 'POST',
    body: { dryRun: true, maxOrders: 5 },
  });
  ok('POST /api/v3/autopilot/run (dry)', autopilotRun.ok && autopilotRun.data?.runId, `${autopilotRun.data?.summary?.autoAllocated} auto`);

  // ── API v4 — Control Tower ──────────────────────────────────────
  const ctDash = await request('/api/v4/control-tower/dashboard');
  ok('GET /api/v4/control-tower/dashboard', ctDash.ok && ctDash.data);

  const ctRisk = await request('/api/v4/control-tower/risk');
  ok('GET /api/v4/control-tower/risk', ctRisk.ok);

  // ── API v5 — Planning Hub ─────────────────────────────────────────
  const v5Dash = await request('/api/v5/planning/dashboard');
  ok('GET /api/v5/planning/dashboard', v5Dash.ok && v5Dash.data);

  const v5Gantt = await request('/api/v5/planning/gantt');
  ok('GET /api/v5/planning/gantt', v5Gantt.ok && Array.isArray(v5Gantt.data?.bars), `${v5Gantt.data?.bars?.length || 0} bars`);

  const v5Sequencing = await request('/api/v5/planning/sequencing');
  ok('GET /api/v5/planning/sequencing', v5Sequencing.ok);

  // ── WebSocket ─────────────────────────────────────────────────────
  const wsOk = await testWebSocket();
  ok('WebSocket /ws/control-tower', wsOk);

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.error('\nFailed:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
  console.log('\nE2E — all checks passed.');
}

run().catch((err) => {
  if (err.cause?.code === 'ECONNREFUSED') {
    console.error(`\nCannot reach ${BASE}. Start the server first: npm start`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
