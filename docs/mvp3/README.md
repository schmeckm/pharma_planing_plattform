# MVP 3.0 — AI-Assisted Global Allocation Platform

**Status:** Implemented — AI-assisted advisory (planner approves all actions)  
**Baseline:** MVP 1.0 + MVP 2.0 Enterprise  
**As-built:** [11-AS-BUILT.md](./11-AS-BUILT.md)

## Vision

Transform the Hard Allocation Platform from a **rule-based allocation tool** into an **AI-assisted decision platform** that proactively identifies risks, shortages, and optimization opportunities.

## Document Index

| # | Document | Topic |
|---|----------|-------|
| 1 | [01-ENTERPRISE-ARCHITECTURE.md](./01-ENTERPRISE-ARCHITECTURE.md) | TOGAF reference architecture |
| 2 | [02-AI-AGENT-ARCHITECTURE.md](./02-AI-AGENT-ARCHITECTURE.md) | Planning, QA, SC, Compliance agents |
| 3 | [03-KNOWLEDGE-GRAPH-MODEL.md](./03-KNOWLEDGE-GRAPH-MODEL.md) | Neo4j schema & Cypher |
| 4 | [04-EVENT-DRIVEN-ARCHITECTURE.md](./04-EVENT-DRIVEN-ARCHITECTURE.md) | Kafka / SAP Event Mesh |
| 5 | [05-SAP-INTEGRATION-ARCHITECTURE.md](./05-SAP-INTEGRATION-ARCHITECTURE.md) | OData, RFC, Packing |
| 6 | [06-EXECUTIVE-COCKPIT-DESIGN.md](./06-EXECUTIVE-COCKPIT-DESIGN.md) | Management dashboards |
| 7 | [07-AI-COPILOT-DESIGN.md](./07-AI-COPILOT-DESIGN.md) | Conversational AI design |
| 8 | [08-MULTI-AGENT-WORKFLOW.md](./08-MULTI-AGENT-WORKFLOW.md) | Sequence diagrams |
| 9 | [09-ROADMAP-MVP3-TO-MVP5.md](./09-ROADMAP-MVP3-TO-MVP5.md) | Release roadmap |
| 10 | [10-SYSTEM-LANDSCAPE.md](./10-SYSTEM-LANDSCAPE.md) | C4 diagrams |
| 11 | [11-AS-BUILT.md](./11-AS-BUILT.md) | Implementation map |
| **12** | **[12-DELIVERABLES-MASTER.md](./12-DELIVERABLES-MASTER.md)** | **All 12 deliverables (start here)** |
| 13 | [13-NODE-IMPLEMENTATION-APPROACH.md](./13-NODE-IMPLEMENTATION-APPROACH.md) | Node.js architecture |
| 14 | [14-VUE-UI-DESIGN.md](./14-VUE-UI-DESIGN.md) | Vue cockpit screens |

## Executable Scaffold (Alpha)

```
agents/              Planning, QA, SC, Compliance + Orchestrator
engines/             digitalTwin, predictiveRisk, globalOptimization
knowledge-graph/     In-memory graph (Neo4j-ready)
events/              IEventBus, Kafka mock
services/            intelligenceService.js
routes/v3/           /api/v3 endpoints
```

## API v3 Endpoints (Alpha)

```bash
# Digital Twin T+7
curl http://localhost:8000/api/v3/twin/simulate?horizon=7 \
  -H "X-User-Role: PLANNER"

# Predictive Risk (7/30/90 days)
curl http://localhost:8000/api/v3/predictions \
  -H "X-User-Role: PLANNER"

# Run Multi-Agent Orchestration
curl -X POST http://localhost:8000/api/v3/agents/run \
  -H "Content-Type: application/json" \
  -H "X-User-Role: PLANNER" \
  -d '{"trigger":"SCHEDULED_DAILY","horizonDays":7}'

# Copilot v3 (graph-aware)
curl -X POST http://localhost:8000/api/v3/copilot/ask \
  -H "Content-Type: application/json" \
  -H "X-User-Role: PLANNER" \
  -d '{"question":"Why was this batch selected?","packagingOrderId":"PO-20001"}'

# Executive Dashboard
curl http://localhost:8000/api/v3/executive/dashboard?horizon=7 \
  -H "X-User-Role: PLANNER"

# Global Optimization
curl -X POST http://localhost:8000/api/v3/optimize \
  -H "Content-Type: application/json" \
  -H "X-User-Role: PLANNER" \
  -d '{}'
```

## GMP Principles

- MVP 3.0 is **decision support only** — not GxP validated
- Agents operate in **recommend-only** mode
- Human approval required for all allocation actions
- Full audit trail maintained
- SAP remains system of record

## Next Steps

See [09-ROADMAP-MVP3-TO-MVP5.md](./09-ROADMAP-MVP3-TO-MVP5.md) for MVP 3.1 → MVP 5.0 delivery plan.
