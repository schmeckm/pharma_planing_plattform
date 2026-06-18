# Control Tower — Event Model

## Event Taxonomy

| Event Type | Trigger | Severity | Entity |
|------------|---------|----------|--------|
| `ORDER_CREATED` | New packaging order | INFO | PackagingOrder |
| `ORDER_CHANGED` | Qty/date change | MEDIUM | PackagingOrder |
| `INVENTORY_CHANGE` | Goods receipt/issue | MEDIUM | Batch |
| `QA_RELEASE` | Batch released | INFO | Batch |
| `QA_HOLD` | Batch blocked | HIGH | Batch |
| `ALLOCATION_SIMULATED` | Simulation run | INFO | PackagingOrder |
| `ALLOCATION_EXECUTED` | Hard allocation | INFO | PackagingOrder |
| `ALLOCATION_BLOCKED` | Rule failure | HIGH | PackagingOrder |
| `BATCH_EXPIRY_WARNING` | RMSL < 90 days | HIGH | Batch |
| `RMSL_VIOLATION` | Threshold breach | HIGH | PackagingOrder |
| `CAPACITY_BOTTLENECK` | Plant > 85% util | MEDIUM | Plant |
| `RECOMMENDATION_CREATED` | Engine output | INFO | Recommendation |

## Event Schema

```json
{
  "eventId": "EVT-001",
  "eventType": "ALLOCATION_BLOCKED",
  "timestamp": "2026-06-10T09:30:00Z",
  "entityType": "PackagingOrder",
  "entityId": "PO-20005",
  "severity": "HIGH",
  "message": "Allocation blocked — RMSL threshold not met",
  "payload": {
    "countryCode": "JP",
    "maxRmsl": 8.5,
    "threshold": 12
  }
}
```

## Event Flow

```
SAP Event Mesh / Kafka
        │
        ▼
┌───────────────┐     ┌──────────────────┐
│ Event Bus     │────▶│ Control Tower    │
│ (Redpanda)    │     │ Event Store      │
└───────────────┘     └────────┬─────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              WebSocket   Dashboard   Agents
              push        refresh     trigger
```

## Kafka Topics (Future)

| Topic | Producer | Consumer |
|-------|----------|----------|
| `hap.orders` | SAP / Platform | Control Tower, Planning Agent |
| `hap.inventory` | SAP MM | Control Tower, SC Agent |
| `hap.qa` | SAP QM | QA Agent, Control Tower |
| `hap.allocation` | Platform | Audit, Control Tower |
| `hap.risk` | Risk Engine | Executive Dashboard |

## WebSocket Messages

| Type | Direction | Payload |
|------|-----------|---------|
| `CONNECTED` | Server→Client | timestamp |
| `SNAPSHOT` | Server→Client | executive KPIs, events, allocation summary |
| `UPDATE` | Server→Client | 15s periodic refresh |
| `EVENT` | Server→Client | single new event |
| `PING`/`PONG` | Client↔Server | keepalive |

## Implementation

- Storage: `data/controlTowerEvents.json`
- Service: `ControlTowerService.getEvents()` / `appendEvent()`
- WebSocket: `websocket/wsHub.js` → `/ws/control-tower`
