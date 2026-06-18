# Control Tower — Database Design

**Pattern:** JSON files (MVP) → PostgreSQL/Neo4j (Production) → SAP (System of Record)

## Entity Model

```
Plant ──< Batch (Finished Goods)
Plant ──< BulkInventory
Market ──< Forecast
Market ──< SalesOrder ──< PackagingOrder
PackagingOrder ──> Batch (allocation)
Batch ──> Country (approved_for)
PackagingOrder ──> Exception
ControlTowerEvent ──> Entity (polymorphic)
Recommendation ──> Action (pending)
```

## Data Files (MVP)

| File | Entities | Key Fields |
|------|----------|------------|
| `orders.json` | SalesOrder, PackagingOrder | salesOrderId, packagingOrderId, country, qty, status |
| `batches.json` | Batch (FG) | batchId, plant, availableQty, expiryDate, approvedCountries |
| `bulkInventory.json` | Bulk | bulkId, plantId, available/allocated/blocked qty |
| `plants.json` | Plant | plantId, type (BULK/PACKAGING/DISTRIBUTION) |
| `markets.json` | Market | marketId, countryCode, region, priority |
| `forecasts.json` | Forecast | marketId, materialNumber, forecastQuantity |
| `packagingCapacity.json` | Capacity | plantId, week, utilizationPercent |
| `controlTowerEvents.json` | Event | eventType, entityId, severity, timestamp |
| `exceptions.json` | Exception | type, packagingOrderId, riskScore |
| `auditTrail.json` | AllocationDecision | status, ruleChecks, executionMode |

## Production Schema (PostgreSQL)

```sql
CREATE TABLE ct_inventory_snapshot (
  snapshot_id UUID PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL,
  plant_id VARCHAR(10),
  material_number VARCHAR(20),
  batch_id VARCHAR(30),
  available_qty NUMERIC(15,3),
  allocated_qty NUMERIC(15,3),
  blocked_qty NUMERIC(15,3),
  rmsl_months NUMERIC(6,2)
);

CREATE TABLE ct_events (
  event_id UUID PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30),
  entity_id VARCHAR(50),
  severity VARCHAR(10),
  payload JSONB,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE ct_recommendations (
  recommendation_id UUID PRIMARY KEY,
  type VARCHAR(40) NOT NULL,
  priority VARCHAR(10),
  status VARCHAR(20) DEFAULT 'PENDING',
  action TEXT,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Neo4j Graph Extensions

See `knowledge-graph/schema.cypher` — add:
- `(:Plant)-[:HOLDS]->(:Batch)`
- `(:Market)-[:DEMANDS]->(:Material)`
- `(:PackagingOrder)-[:BLOCKED_BY]->(:Rule)`

## SAP Mapping (Future)

| Control Tower Entity | SAP Object |
|---------------------|------------|
| Batch (FG) | MCHB / MATDOC |
| Bulk | Process Order stock |
| Sales Order | VBAK/VBAP |
| Packaging Order | Custom Z-table / PP order |
| Forecast | IBP Key Figure |
| QA Release | QALS/QAVE |
