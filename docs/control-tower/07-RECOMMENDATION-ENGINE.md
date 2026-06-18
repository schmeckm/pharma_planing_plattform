# Control Tower — Recommendation Engine Design

## Purpose

Generate actionable supply chain recommendations from inventory, demand, risk, and capacity signals.

## Recommendation Types

| Type | Trigger | Example Action |
|------|---------|----------------|
| `INVENTORY_TRANSFER` | Market shortage + surplus elsewhere | Move 3000 EA CH → JP |
| `BATCH_REALLOCATION` | RMSL block on current batch | Use BATCH-JP-002 for PO-20005 |
| `QA_PRIORITIZATION` | Inspection lot blocking orders | Escalate IL-90001 |
| `DEMAND_PRIORITIZATION` | Near-term backorders | Sequence JP orders first |
| `PACKAGING_SEQUENCE` | Capacity > 85% | Spread load across weeks |

## Output Schema

```json
{
  "recommendationId": "REC-001",
  "type": "BATCH_REALLOCATION",
  "priority": "HIGH",
  "packagingOrderId": "PO-20005",
  "title": "Use alternative batch for PO-20005",
  "action": "Reallocate to BATCH-JP-002",
  "rationale": "Resolves RMSL compliance risk",
  "impact": { "blockedOrdersDelta": -1 },
  "status": "PENDING"
}
```

## Decision Flow

```
Signals (inventory, demand, risk, capacity, QA lots)
        │
        ▼
┌─────────────────────┐
│ RecommendationEngine│
└──────────┬──────────┘
           ▼
    Priority sort (HIGH → LOW)
           │
           ▼
┌─────────────────────┐
│ Control Tower UI    │  Human review
└──────────┬──────────┘
           ▼ (approve)
┌─────────────────────┐
│ Allocation Service  │  Execute
└─────────────────────┘
```

## Engine Location

`engines/recommendationEngine.js`

## Future Enhancements

- OR-Tools for global inventory optimization
- ML demand forecast integration (SAP IBP)
- Agent-generated recommendations merged with rule-based
- Approval workflow with RBAC (Planner vs SC vs QA)

## GMP Governance

All recommendations remain **PENDING** until human approval. No autonomous execution in MVP 4.0.
