# MVP 2.0 Enterprise — Implementation Roadmap

## Phase A — Scheduling Performance (completed)

- [x] `SchedulingService` facade with constraint pipeline + cache
- [x] `dailyPlanningService` delegates to `SchedulingService` (no auto-optimize on dashboard)
- [x] `POST /api/v1/planning/optimize-sequence` for explicit optimize
- [x] `sequenceScenarios.json` reset; slim scenario metadata only on line-opt simulate/optimize
- [x] Heuristic optimize capped at `SCHEDULING_MAX_HEURISTIC_ORDERS` (default 80)

## Phase B — OR-Tools Sidecar (completed)

- [x] Python CP-SAT sidecar (`scripts/ortools/`) with FastAPI
- [x] `OrtoolsOptimizer` HTTP client + Gantt enrichment
- [x] Docker Compose service `ortools` + backend `SCHEDULING_OPTIMIZER=ortools`
- [x] Dev startup: `start.ps1 dev` starts sidecar on port 8010
- [x] `GET /health` + `GET /api/v1/planning/scheduling-status`
- [x] `node scripts/benchmark-scheduling.js`

## Phase C — GPT Schedule Explanation (completed)

- [x] `SchedulingService.getExplanationEvidence()` — sync, no re-optimize on briefing
- [x] `PlanningAgent.buildDailySummary()` consumes scheduling evidence + constraint KPIs
- [x] `LlmAgentService.explainScheduleBriefing()` — GPT explains solver/constraints (no optimize)
- [x] `GET /api/v3/agents/morning-briefing` async + scheduling evidence in response
- [x] Wizard `AgentActivityPanel` shows solver status + plan explanation

## Phase D — Live Data Cache (completed)

- [x] `JsonRepository` in-memory cache (mtime invalidation + write-through)
- [x] Startup warmup for hot collections (`HAP_LIVE_CACHE_WARMUP`)
- [x] Constraint pipeline result cache (TTL, same as scheduling cache)
- [x] `SchedulingService` reads via `JsonRepository` (no direct `readFileSync`)
- [x] `/health` exposes `liveCache` stats

## Phase E — Demo-Ready Mock Data (completed)

- [x] `scripts/generate-demo-data.js` — RMSL-safe batch dates, material/country alignment, ~70% eligible
- [x] Intentional demo blockers: `NO_COUNTRY_RULE`, `ATP_SHORTAGE`, `NO_BATCH` (~30%)
- [x] Sync `inventory.json` + `atpReservations.json` with generated batches
- [x] `scripts/reset-demo-environment.js` + `npm run reset:demo`
- [x] Archive + trim `auditTrail.json`, `jobs.json`, `whatIfScenarios.json`

**Current focus:** Mock data + cockpit function/performance. SAP S/4 and HANA deferred.

**Reset demo:**
```bash
npm run reset:demo
# or: node scripts/reset-demo-environment.js 60 96 120
```

## Phase 1 — Completed (This Release)

- [x] IDataProvider abstraction (JsonProvider + SAPODataProvider mock)
- [x] Rule Management v2 (versioned, effective-dated, exportable)
- [x] Risk Scoring Engine (LOW/MEDIUM/HIGH)
- [x] Exception Queue (review, comment, escalate, resolve)
- [x] What-If Simulation with impact/risk comparison
- [x] Mass Allocation Jobs with progress tracking
- [x] Role-Based Security (5 roles, permission middleware)
- [x] Allocation Copilot (internal reasoning engine)
- [x] Vue 3 cockpit pages for all v2 features
- [x] PrimeVue integration for Enterprise UI modules
- [x] API v2 endpoints + Docker updates

## Phase 2 — SAP Integration (deferred)

- [ ] Real SAP OData client (batch, orders, inventory CDS views)
- [ ] RFC/BAPI for allocation confirmation
- [ ] Packing system → Sales Order linkage via SAP
- [ ] TRIC approvals from SAP GTS/custom tables
- [ ] Switch `HAP_DATA_PROVIDER=sap` in production

## Phase 3 — Scale & Performance (Q4)

- [ ] Redis job queue (replace in-process workers)
- [ ] PostgreSQL persistence (app state / audit — SAP remains system of record)
- [ ] Horizontal scaling with Kubernetes
- [ ] Mass allocation: 10,000+ orders benchmark
- [ ] WebSocket progress streaming for jobs

## Phase 4 — Advanced Analytics (Q1 next year)

- [ ] ML-based risk prediction (optional)
- [ ] OpenAI/Azure Copilot integration (optional, alongside internal engine)
- [ ] Power BI / SAP Analytics Cloud dashboards
- [ ] Predictive RMSL and expiry analytics

## Phase 5 — GxP Compliance (Q2 next year)

- [ ] Electronic signatures (21 CFR Part 11)
- [ ] Immutable audit blockchain / WORM storage
- [ ] Validation documentation (IQ/OQ/PQ)
- [ ] Role segregation enforcement in SAP GRC

## Demo Users (Login via API)

| Username | Role |
|----------|------|
| planner | PLANNER |
| qa | QA |
| supplychain | SUPPLY_CHAIN |
| admin | ADMIN |
| viewer | VIEWER |

```bash
curl -X POST http://localhost:8000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"planner"}'
```

## Key API Endpoints (v2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/rules` | List versioned rules |
| PUT | `/api/v2/rules/:ruleId` | Update with new version |
| GET | `/api/v2/rules/export` | Export all rules |
| GET | `/api/v2/exceptions` | Exception queue |
| POST | `/api/v2/exceptions/:id/resolve` | Resolve exception |
| POST | `/api/v2/what-if/simulate` | What-if scenario |
| POST | `/api/v2/jobs/mass-allocation` | Start mass job |
| GET | `/api/v2/jobs/:jobId` | Job progress |
| POST | `/api/v2/copilot/ask` | Copilot Q&A |
| POST | `/api/v2/auth/login` | Mock login |
