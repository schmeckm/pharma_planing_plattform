# MVP 3.0 — Multi-Agent Workflow

## 1. End-to-End Scenario: Blocked Order Resolution

**Trigger:** Planning Agent detects RMSL violation for PO-10001235 in T+7 twin projection

```mermaid
sequenceDiagram
    participant Twin as Digital Twin
    participant Orch as Orchestrator
    participant Plan as Planning Agent
    participant QA as QA Agent
    participant Comp as Compliance Agent
    participant Exc as Exception Queue
    participant Human as Planner
    participant SAP as SAP

    Twin->>Orch: TWIN_RISK_THRESHOLD (PO-10001235, RMSL)
    Orch->>Plan: Route: ORDER_AT_RISK
    Plan->>Plan: Run What-If (+2 days, alt batch)
    Plan->>Orch: Recommendation: reschedule OR alt batch
    Orch->>Comp: Validate TRIC + RMSL for alt batch
    Comp->>Orch: Compliance OK
    Orch->>Exc: Create/Update exception
    Orch->>Human: Notify (recommend-only)
    Human->>SAP: Approve & execute allocation
    SAP-->>Orch: sap.allocation.confirmed event
    Orch->>Exc: Resolve exception
```

## 2. QA Agent Workflow: Inspection Lot Prioritization

```mermaid
sequenceDiagram
    participant Event as sap.batch.released
    participant QA as QA Agent
    participant Graph as Knowledge Graph
    participant Exc as Exception Queue
    participant QAUser as QA Specialist

    Event->>QA: Batch BATCH-JP-002 released
    QA->>Graph: Query blocked JP orders waiting on sequence
    Graph->>QA: PO-20004, PO-20005 depend on sequence
    QA->>QA: Priority = CRITICAL (Japan market)
    QA->>Exc: Comment: "Prioritize release — 2 JP orders blocked"
    QA->>QAUser: Recommendation notification
```

## 3. Supply Chain Agent: Inventory Rebalancing

```mermaid
sequenceDiagram
    participant Twin as Twin T+30
    participant SC as Supply Chain Agent
    participant Opt as Optimization Engine
    participant Exec as Executive Cockpit

    Twin->>SC: CH surplus 15k EA, JP shortage 4k EA
    SC->>Opt: Optimize redistribution (min expiry, max service)
    Opt->>SC: Move 5000 EA MAT-1000 CH→JP plant
    SC->>Exec: Recommendation card
    Note over SC,Exec: Requires Supply Chain Manager approval
```

## 4. Orchestrator State Machine

```
States:
  IDLE → TRIGGERED → ROUTING → AGENT_RUNNING → MERGING
       → COMPLIANCE_GATE → AWAITING_APPROVAL → COMPLETED

Transitions:
  TRIGGERED: event or schedule
  ROUTING: classify trigger type
  AGENT_RUNNING: one or more agents parallel
  MERGING: deduplicate recommendations
  COMPLIANCE_GATE: Compliance Agent validates
  AWAITING_APPROVAL: human required if confidence < 0.9 or CRITICAL
  COMPLETED: audit logged
```

## 5. Agent Priority Matrix

| Trigger | Primary Agent | Secondary | SLA |
|---------|---------------|-----------|-----|
| RMSL risk | Planning | Compliance | 4h |
| TRIC gap | Compliance | Planning | 8h |
| Quality block | QA | Planning | 2h |
| Inventory imbalance | Supply Chain | Planning | 24h |
| Japan sequence | Planning | Compliance | 1h |
| User question | Copilot | — | 3s |

## 6. Conflict Resolution

When agents disagree:
1. Compliance Agent veto on regulatory issues
2. Higher confidence wins (non-regulatory)
3. Escalate to human if tie

## 7. Implementation Reference

See `agents/orchestrator.js` for MVP 3.0 scaffold implementing this state machine in Node.js (LangGraph-compatible interface).
