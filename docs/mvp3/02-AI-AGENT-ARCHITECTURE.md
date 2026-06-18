# MVP 3.0 — AI Agent Architecture

## 1. Agent Landscape

```
                    ┌─────────────────────┐
                    │  Agent Orchestrator │
                    │  (LangGraph State)  │
                    └──────────┬──────────┘
                               │
       ┌───────────┬───────────┼───────────┬───────────┐
       ▼           ▼           ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Planning │ │    QA    │ │  Supply  │ │Compliance│ │ Copilot  │
│  Agent   │ │  Agent   │ │  Chain   │ │  Agent   │ │ (Conv.)  │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │            │            │
     └────────────┴────────────┴────────────┴────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   MCP Tool Layer    │
                    │ simulate │ query   │
                    │ graph    │ predict │
                    │ escalate │ notify  │
                    └─────────────────────┘
```

## 2. Agent Definitions

### 2.1 Planning Agent

| Attribute | Value |
|-----------|-------|
| **Role** | Proactive allocation planning |
| **Triggers** | Scheduled (daily), new order events, twin risk threshold |
| **Inputs** | Open POs, twin T+7 projection, exceptions |
| **Outputs** | Recommendations: reschedule, alternate batch, escalate |
| **Autonomy** | Recommend-only (MVP 3.0); semi-auto with approval (MVP 4) |

**Example workflow:**
```
Order PO-10001235 → RMSL violation in T+7 twin
  → Planning Agent runs what-if (+2 days, alt batch)
  → Recommendation: "Move planned start +2 days OR use BATCH-DE-002"
  → Planner notified via Exception Queue
```

### 2.2 QA Agent

| Attribute | Value |
|-----------|-------|
| **Role** | Quality release prioritization |
| **Inputs** | Inspection lots, batch status, blocked allocations |
| **Outputs** | Release priority, risk assessment |
| **Constraints** | Cannot override quality status; recommends only |

**Decision matrix:**
| Inspection Status | Blocked Orders | Priority |
|-------------------|----------------|----------|
| Pending | > 0 | HIGH |
| In Progress | Japan sequence waiting | CRITICAL |
| Released | N/A | Close exception |

### 2.3 Supply Chain Agent

| Attribute | Value |
|-----------|-------|
| **Role** | Inventory balancing across markets |
| **Inputs** | Plant inventory, market demand forecast, twin T+30 |
| **Outputs** | Redistribution suggestions, market balance report |

**Example:** "Move 5,000 EA from CH plant surplus to cover JP sequence gap in 14 days"

### 2.4 Compliance Agent

| Attribute | Value |
|-----------|-------|
| **Role** | TRIC, RMSL, regulatory monitoring |
| **Inputs** | Country rules, TRIC approvals, batch expiry curve |
| **Outputs** | Compliance alerts, rule change impact analysis |

### 2.5 AI Allocation Copilot (Conversational)

Enhanced from MVP 2.0 internal engine → graph-aware + LLM-ready:

| Layer | MVP 2.0 | MVP 3.0 |
|-------|---------|---------|
| Reasoning | Pattern match | Graph traversal + rule evidence |
| Context | Single order | Order + batch + market + twin |
| LLM | None | Optional Azure OpenAI (governed) |
| Explainability | Rule checks | Graph path + agent trace |

---

## 3. MCP Tool Catalog

Tools exposed to agents via Model Context Protocol:

| Tool | Description | Backend |
|------|-------------|---------|
| `simulate_allocation` | Run v1 simulate | AllocationService |
| `what_if` | Scenario comparison | WhatIfService |
| `query_graph` | Cypher-like queries | GraphRepository |
| `get_twin_projection` | T+7/30/90 | DigitalTwinService |
| `get_predictions` | Predictive risk | PredictiveRiskService |
| `create_exception` | Queue exception | ExceptionService |
| `get_inspection_lots` | QA data | SAP QM adapter |
| `optimize_global` | Multi-objective | OptimizationEngine |

---

## 4. LangGraph Orchestration Model

```text
Conceptual state machine (LangGraph)

State = {
  trigger: Event | Schedule
  context: GraphContext
  agent_outputs: []
  recommendations: []
  human_approval_required: boolean
}

Flow:
START → classify_trigger → route_to_agent → execute_tools
      → merge_recommendations → compliance_check → END
                                    ↓ (if critical)
                              human_approval_gate
```

**Node routing rules:**
- `ORDER_BLOCKED` → Planning Agent → QA Agent (if quality-related)
- `INVENTORY_IMBALANCE` → Supply Chain Agent
- `TRIC_EXPIRY` → Compliance Agent
- `USER_QUESTION` → Copilot (direct)

---

## 5. Agent Communication Protocol

```json
{
  "agentId": "planning-agent",
  "runId": "RUN-ABC123",
  "timestamp": "2026-06-10T12:00:00Z",
  "trigger": "TWIN_RISK_THRESHOLD",
  "recommendations": [{
    "type": "RESCHEDULE_ORDER",
    "targetId": "PO-10001235",
    "action": "Move planned start +2 days",
    "rationale": "RMSL margin improves from 4.2 to 6.1 months",
    "confidence": 0.87,
    "evidence": ["RULE-003", "twin:T+7:projection-42"],
    "requiresApproval": true,
    "approverRole": "PLANNER"
  }]
}
```

---

## 6. Governance & Safety

| Control | Implementation |
|---------|----------------|
| Agent action whitelist | MCP tools only; no direct DB write without service layer |
| Confidence threshold | < 0.7 → flag for human review |
| Audit | Every agent run → `data/agentRuns.json` + audit trail |
| Kill switch | `AGENTS_ENABLED=false` env var |
| Role matrix | QA Agent blocked from `execute_allocation` tool |

---

## 7. Implementation Scaffold (This Repo)

```
agents/
  baseAgent.js           # Abstract agent with MCP tool registry
  planningAgent.js
  qaAgent.js
  supplyChainAgent.js
  complianceAgent.js
  orchestrator.js        # State machine (LangGraph-inspired)
services/
  agentOrchestrationService.js
```

See [08-MULTI-AGENT-WORKFLOW.md](./08-MULTI-AGENT-WORKFLOW.md) for sequence diagrams.
