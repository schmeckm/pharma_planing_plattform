# MVP 3.0 — Event-Driven Architecture

## 1. Vision

Move from pull-based REST polling to **event-driven** reactive allocation intelligence — SAP and internal systems publish domain events; agents and twin update in near-real-time.

## 2. Event Topology

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  SAP S/4    │     │  Packing    │     │  Platform   │
│  (Orders)   │     │  System     │     │  Internal   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
              ┌────────────────────────┐
              │   Event Gateway        │
              │ SAP Event Mesh / Kafka │
              └────────────┬───────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Twin Sync   │   │ Graph Sync  │   │ Agent       │
│ Consumer    │   │ Consumer    │   │ Triggers    │
└─────────────┘   └─────────────┘   └─────────────┘
```

## 3. Event Catalog

| Event Type | Source | Payload | Consumers |
|------------|--------|---------|-----------|
| `sap.order.created` | SAP SD | salesOrderId, country | Twin, Graph, Planning Agent |
| `sap.packaging_order.released` | Packing | packagingOrderId | Twin, Planning Agent |
| `sap.batch.released` | SAP QM | batchId, qualityStatus | Graph, QA Agent, Twin |
| `sap.inventory.changed` | SAP MM | batchId, quantity, plant | Twin, SC Agent |
| `sap.tric.updated` | GTS | batchId, countries | Graph, Compliance Agent |
| `platform.allocation.executed` | Platform | orderId, batchId | Graph, Audit, Twin |
| `platform.exception.created` | Platform | exceptionId, type | QA Agent, Planning Agent |
| `platform.twin.risk_threshold` | Twin | horizon, market, score | Planning Agent, Executive |

## 4. Topic Design (Kafka)

```
hap.sap.orders          # SAP order events
hap.sap.inventory       # Inventory & batch
hap.sap.quality         # QM / inspection
hap.platform.allocation # Internal allocation
hap.platform.agents     # Agent triggers & outputs
hap.platform.twin        # Twin projections
hap.dlq                 # Dead letter queue
```

**Partition key:** `{countryCode}` or `{plantId}` for locality

## 5. SAP Event Mesh Alternative (BTP)

For cloud-first deployments:

| SAP Event Mesh | Kafka Equivalent |
|----------------|------------------|
| EM Topic `allocation/orders` | `hap.sap.orders` |
| EM Queue `agent/planning` | Consumer group |
| Webhook subscription | REST adapter |

## 6. Event Schema (CloudEvents 1.0)

```json
{
  "specversion": "1.0",
  "type": "sap.batch.released",
  "source": "sap/s4/qm",
  "id": "evt-uuid",
  "time": "2026-06-10T12:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "batchId": "BATCH-JP-002",
    "materialNumber": "MAT-1000",
    "qualityStatus": "RELEASED",
    "releaseDate": "2026-06-10",
    "inspectionLotId": "IL-90001"
  }
}
```

## 7. Processing Guarantees

| Pattern | Use Case |
|---------|----------|
| At-least-once | Inventory sync (idempotent upsert) |
| Exactly-once | Allocation audit (dedup by event id) |
| Saga | Multi-step redistribution (SC Agent) |

## 8. MVP 3.0 Scaffold

```
events/
  IEventBus.js           # Interface
  InMemoryEventBus.js    # Dev/test
  KafkaEventBus.js       # Production (mock in MVP 3)
  SAPEventMeshBus.js     # BTP adapter (mock)
  eventCatalog.js        # Event type registry
  handlers/              # Consumer handlers
```

**Shadow mode (MVP 3.0):** Events consumed and logged; no autonomous actions.

## 9. Failure Handling

- DLQ after 3 retries with exponential backoff
- Circuit breaker on SAP OData fallback
- Event replay from offset for twin rebuild
