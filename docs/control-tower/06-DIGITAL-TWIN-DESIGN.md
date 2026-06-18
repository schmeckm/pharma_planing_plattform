# Control Tower — Digital Twin Design

## Purpose

Virtual representation of the supply chain state with forward projection (T+7, T+30, T+90) for proactive decision-making.

## Twin Entities

| Entity | Source | Attributes |
|--------|--------|------------|
| PackagingOrder | orders.json | status, country, plannedStartDate, qty |
| SalesOrder | orders.json | customer, deliveryDate |
| Batch (FG) | batches.json | expiry, availableQty, approvedCountries |
| Bulk | bulkInventory.json | plant, expiry, blockedQty |
| Plant | plants.json | capacity, type |
| Market | markets.json | region, priority |

## Snapshot Structure

```json
{
  "timestamp": "2026-06-10T20:00:00Z",
  "horizonDays": 7,
  "entities": {
    "packagingOrders": 6,
    "batches": 8,
    "plants": ["1000"],
    "markets": ["DE", "GB", "JP", "CH"]
  },
  "projections": {
    "summary": { "totalOrders": 6, "projectedSuccess": 5, "projectedFailed": 1 },
    "allocationOutcomes": [...],
    "atRiskMarkets": [...],
    "rmslViolations": [...]
  }
}
```

## Projection Logic

1. For each OPEN packaging order at horizon date:
   - Find eligible batches (material, quality, country approval)
   - Calculate RMSL at planned start date
   - Compare against country threshold
   - Mark PASS/FAIL

2. Aggregate by market → `atRiskMarkets`

3. Feed into Risk Control Center heatmap

## Simulation Scenarios (Future)

| Scenario | Override |
|----------|----------|
| Delay order +3 days | plannedStartDate shift |
| Release blocked batch | qualityStatus → RELEASED |
| Transfer inventory | batch country approval change |
| Capacity increase | packagingCapacity adjustment |

## Integration

- Engine: `engines/digitalTwinEngine.js` (MVP 3.0)
- Control Tower: `GET /api/v4/control-tower/twin?horizon=7`
- Extends MVP 3 twin with bulk inventory and capacity entities

## GMP Note

Twin simulations are **non-GxP** decision support. Production allocation always requires validated rule engine execution.
