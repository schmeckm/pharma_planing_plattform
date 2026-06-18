# Control Tower — API Specifications

**Base URL:** `/api/v4/control-tower`  
**Auth:** Headers `X-User-Id`, `X-User-Role`, `X-User-Name`

## Endpoints

### GET /dashboard
Unified control tower view.

**Query:** `horizon=7|30|90`  
**Response:** `{ executive, inventory, demand, allocation, risk, events, recommendations, digitalTwin }`

### GET /inventory
Global inventory by plant, country, material, batch.

**Response:** `{ totals, finishedGoods: { byPlant, byCountry, byMaterial, byBatch }, bulkInventory }`

### GET /demand
Market demand view.

**Response:** `{ summary, salesOrders, forecasts, byCountry, byCustomer, byProduct }`

### GET /allocation
Allocation monitor.

**Response:** `{ summary, allocatedOrders, openOrders, blockedOrders, pendingDecisions }`

### GET /risk
Risk control center.

**Query:** `horizon=30`  
**Response:** `{ overallRisk, heatmap, rmslRisks, expiryRisks, complianceRisks, bottlenecks }`

### GET /executive
Executive KPIs only.

**Query:** `horizon=7`

### GET /events
Event feed.

**Query:** `limit=50`

### GET /twin
Digital twin snapshot.

**Query:** `horizon=7`

### GET /recommendations
Recommendation engine output.

## WebSocket

**URL:** `ws://host/ws/control-tower`

**Messages:** `CONNECTED`, `SNAPSHOT`, `UPDATE` (15s), `EVENT`

## Example

```bash
curl http://localhost:8001/api/v4/control-tower/dashboard?horizon=7 \
  -H "X-User-Role: PLANNER"
```

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| FORBIDDEN | 403 | Insufficient RBAC role |
| NOT_FOUND | 404 | Unknown route |
| INTERNAL_ERROR | 500 | Server error |

## Frontend Client

`cockpit/src/api/v4.js`
