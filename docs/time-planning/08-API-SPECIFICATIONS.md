# Time Planning — API Specifications

**Base:** `/api/v5/planning`  
**Auth:** `X-User-Role: PLANNER`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard?lineId=&horizon=` | Unified planning dashboard |
| GET | `/timeline?lineId=` | Production timeline |
| GET | `/gantt?lineId=` | Gantt bar data |
| GET | `/capacity?horizon=14` | Capacity heatmap + bottlenecks |
| GET | `/rmsl-risk` | Triple-point RMSL portfolio |
| GET | `/market-delivery` | Delivery risk by market |
| GET | `/sequencing?lineId=` | Production sequence evaluation |
| GET | `/twin?horizon=7\|30\|90` | Time-aware digital twin |
| GET | `/orders/:id/rmsl?batchId=` | Order RMSL forecast |
| POST | `/what-if` | Time shift / line / sequence simulation |

## POST /what-if Body

```json
{
  "packagingOrderId": "PO-20001",
  "shiftDays": 2,
  "productionLine": "PACK_LINE_02",
  "newSequence": ["PO-20003", "PO-20004", "PO-20005"],
  "lineId": "PACK_LINE_01"
}
```

## RMSL Response Shape

```json
{
  "checkpoints": [
    { "checkpoint": "PACKAGING_START", "rmslMonths": 24.2, "percentOfThreshold": 201.7, "passed": true },
    { "checkpoint": "PACKAGING_END", "rmslMonths": 24.1, "percentOfThreshold": 200.8, "passed": true },
    { "checkpoint": "CUSTOMER_DELIVERY", "rmslMonths": 23.5, "percentOfThreshold": 195.8, "passed": true }
  ],
  "warnings": []
}
```

## Example

```bash
curl http://localhost:8000/api/v5/planning/gantt?lineId=PACK_LINE_01 -H "X-User-Role: PLANNER"
curl -X POST http://localhost:8000/api/v5/planning/what-if -H "Content-Type: application/json" -H "X-User-Role: PLANNER" -d "{\"packagingOrderId\":\"PO-20001\",\"shiftDays\":2}"
```
