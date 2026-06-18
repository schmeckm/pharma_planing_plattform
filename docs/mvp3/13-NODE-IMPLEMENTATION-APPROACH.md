# Node.js Implementation Approach — MVP 3.0

## Architecture Pattern

**Modular monolith** — single Express process, clear domain boundaries, provider abstraction for SAP readiness.

```
server.js
├── /api/v1   Core allocation, planning, performance
├── /api/v2   Auth, rules v2, copilot v2, what-if, jobs
├── /api/v3   Intelligence layer (agents, twin, executive)
├── /api/v4   Control Tower
├── /api/v5   Production sequencing Gantt
└── /ws       WebSocket hub
```

## Intelligence Layer (`/api/v3`)

### Service Hub

`services/intelligenceService.js` is the single entry point for MVP 3.0 intelligence features.

| Method | Delegates To |
|--------|--------------|
| `simulateTwin(horizon)` | `DigitalTwinEngine` |
| `getPredictions(horizons)` | `PredictiveRiskEngine` |
| `optimizeGlobal()` | `GlobalOptimizationEngine` |
| `getDailyPlanningSummary()` | `PlanningAgent.buildDailySummary()` |
| `runAgents(trigger)` | `AgentOrchestrator` → 4 agents |
| `askCopilotV3()` | `CopilotService` + `GraphRepository` |
| `getExecutiveDashboard()` | Twin + Predictions + KPI aggregation |
| `approveRecommendation()` | JSON persistence + event publish |

### Agent Orchestrator

`agents/orchestrator.js`:

1. Route trigger → agent subset  
2. `Promise.all` parallel agent execution  
3. Merge recommendations  
4. Compliance gate: `confidence < 0.7` → `NEEDS_REVIEW`  
5. Return `dailySummary` from Planning Agent  

Triggers: `SCHEDULED_DAILY`, `MANUAL`, `BATCH_RELEASED`, `INVENTORY_IMBALANCE`, `ORDER_BLOCKED`, `TWIN_RISK_THRESHOLD`

### Copilot Pipeline

```
POST /api/v3/copilot/ask
  → CopilotService.ask()
    → JsonProvider.getOrder()
    → AllocationService.simulate()
    → HistoricalPerformanceEngine.calculateLineScore()
    → CopilotEngine.answer()  // pattern match + evidence
  → GraphRepository.query(ALLOCATION_EXPLAIN)
  → Response with evidence + suggestedQuestions
```

No external AI in MVP 3.0 — fully auditable deterministic reasoning.

### Digital Twin

`engines/digitalTwinEngine.js`:

- Loads open orders, batches, rules, production lines  
- Projects RMSL compliance per order at T+N  
- Computes line utilization (scheduled qty vs capacity × horizon)  
- Returns `atRiskMarkets`, `allocationOutcomes`, `lineUtilization`

### Predictive Risk

`engines/predictiveRiskEngine.js`:

- Horizons 7 / 30 / 90 days  
- RMSL violations, expiring inventory, market shortages, JP sequence bottlenecks  
- Overall risk: LOW / MEDIUM / HIGH  

### Historical Performance

`engines/historicalPerformanceEngine.js`:

Weighted line score:

| Factor | Weight |
|--------|--------|
| OEE | 30% |
| Throughput | 25% |
| Reliability | 20% |
| Yield | 15% |
| Setup time (inverse) | 10% |

Used by Copilot ("Why was this line recommended?") and Planning Agent morning briefing.

## Data Provider Abstraction

```javascript
// providers/IDataProvider.js
getOrders(), getBatches(), getRules(), getExceptions()
getProductionLines(), getLinePerformance()
```

Switch: `HAP_DATA_PROVIDER=json` (default) | `sap` (mock OData)

## Persistence

| File | Purpose |
|------|---------|
| `data/*.json` | Master data (orders, batches, rules, …) |
| `data/agentRecommendations.json` | Agent output queue (max 100) |

Approval workflow:

```
PENDING_APPROVAL → APPROVED | DISMISSED | NEEDS_REVIEW
```

## Event Bus

`events/eventService.js`:

- `HAP_EVENT_BUS=memory` — `InMemoryEventBus` (default)  
- `HAP_EVENT_BUS=kafka` — `KafkaEventBus` (mock → Redpanda)  

Published on:

- Agent run completion → `hap.agents.run`  
- Recommendation approve/dismiss → `hap.recommendations`  

Query: `GET /api/v3/events/log`

## Knowledge Graph

`knowledge-graph/graphRepository.js` — in-memory Map, seeded at `IntelligenceService` startup.

Neo4j migration (MVP 3.1):

1. `npm install neo4j-driver`  
2. Replace `GraphRepository` internals with Bolt Cypher  
3. Run `knowledge-graph/schema.cypher` on container  
4. `NEO4J_URI=bolt://localhost:7687`  

## Security

- `middleware/auth.js` — role-based (`PLANNER`, `QA`, `SUPPLY_CHAIN`, `ADMIN`, `VIEWER`)  
- Permissions: `orders:read`, `copilot:use`, `jobs:create`, `whatif:run`  
- Header: `X-User-Role`, `X-User-Id` (for approval audit)  

## Testing

```bash
npm run test:smoke   # Domain engines + copilot intents
npm run test:e2e     # HTTP v1–v5 + v3 executive/agents/copilot
```

## Extension Points

| Future | Hook |
|--------|------|
| SAP OData | `SAPODataProvider` implements `IDataProvider` |
| LLM Copilot | Wrap `CopilotEngine.answer()` with Azure OpenAI, keep evidence from rules |
| Cron morning run | Subscribe to `hap.agents.run` or `node-cron` → `runAgents('SCHEDULED_DAILY')` |
| OR-Tools | Replace `GlobalOptimizationEngine` greedy heuristic |
