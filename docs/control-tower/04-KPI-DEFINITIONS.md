# Control Tower — KPI Definitions

## Executive KPIs

| KPI | Formula | Target | Source |
|-----|---------|--------|--------|
| **Service Level** | (Orders fulfilled on time / Total orders) × 100 | ≥ 98% | SAP delivery performance |
| **Inventory Coverage** | Available FG + Bulk / Open demand | ≥ 1.5x | Control Tower inventory + demand |
| **Allocation Success Rate** | Projected successful allocations / Total open POs | ≥ 95% | Digital Twin T+N |
| **RMSL Compliance** | POs meeting country RMSL threshold / Total POs | ≥ 99% | Compliance engine |
| **Market Fill Rate** | Allocated POs / (Allocated + Open POs) | ≥ 90% | Allocation monitor |
| **Inventory at Risk** | Blocked qty + Expiring within 90 days | Minimize | Risk engine |
| **Global Risk** | Composite score LOW/MEDIUM/HIGH | LOW | Predictive risk engine |
| **Open Exceptions** | Count of OPEN exceptions | 0 | Exception queue |

## Operational KPIs

| KPI | Definition |
|-----|------------|
| Packaging Capacity Utilization | Allocated capacity / Total weekly capacity |
| Bulk Availability | Released bulk / Total bulk demand |
| QA Release Lead Time | Days from inspection lot creation to release |
| Backorder Count | Open POs past planned start date |
| TRIC Compliance Rate | Allocations with valid TRIC / Total allocations |

## Risk KPIs

| KPI | Threshold | Action |
|-----|-----------|--------|
| RMSL Violations (T+7) | > 0 | Trigger batch reallocation recommendation |
| Expiry Risk (RMSL < 6mo) | Any FG/Bulk | Prioritize market allocation |
| Market Shortage | > 50% POs at risk | Escalate to Supply Chain |
| Capacity Bottleneck | Utilization > 85% | Packaging sequence optimization |

## Calculation (MVP Implementation)

```javascript
inventoryCoverage = availableInventory / openDemand
allocationSuccessRate = twin.projectedSuccess / twin.totalOrders * 100
marketFillRate = allocatedOrders / (allocated + open) * 100
inventoryAtRisk = blockedQty + sum(expiryRisk.availableQuantity)
```

## Refresh Cadence

| KPI | Refresh |
|-----|---------|
| Inventory | Real-time (WebSocket 15s) + SAP delta events |
| Demand | Hourly (IBP sync) |
| Risk | On demand + T+7/30/90 scheduled |
| Executive | Daily 06:00 + on significant event |
