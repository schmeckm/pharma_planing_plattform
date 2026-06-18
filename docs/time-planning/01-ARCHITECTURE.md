# Time-Based Allocation Planning — Architecture

**Edition:** MVP 5.0  
**Extends:** Compliance-first allocation (MVP 2.1+) + Control Tower (MVP 4.0)

## Vision

Make the allocation engine **time-aware** by incorporating production scheduling dates, triple-point RMSL forecasting, line capacity, and sequencing into every allocation decision.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  PLANNING COCKPIT (Vue 5.0)                                      │
│  Timeline │ Gantt │ Capacity │ RMSL Risk │ Delivery │ Twin      │
└────────────────────────────┬────────────────────────────────────┘
                             │ /api/v5/planning
┌────────────────────────────▼────────────────────────────────────┐
│  TimePlanningService                                             │
└───┬──────────┬──────────────┬──────────────┬───────────────────┘
    ▼          ▼              ▼              ▼
RmslForecast  Production    Capacity      TimeBasedAllocation
Engine        Sequencing    Planning      Engine + Digital Twin
              Engine        Engine
    │          │              │              │
    └──────────┴──────────────┴──────────────┘
                             ▼
              AllocationService (time RMSL in audit)
              ComplianceEngine (RMSL @ plannedStartDate)
```

## Rule Execution (unchanged priority)

1. Compliance (incl. time-based RMSL @ packaging start)
2. Market Rules (Japan sequence in production schedule)
3. FIFO
4. Optimization

## Key Engines

| Engine | File | Responsibility |
|--------|------|----------------|
| RMSL Forecast | `rmslForecastEngine.js` | Triple-point RMSL + warnings |
| Production Sequencing | `productionSequencingEngine.js` | Line sequence, JP batch, FIFO impact |
| Capacity Planning | `capacityPlanningEngine.js` | Line calendars, heatmap, bottlenecks |
| Time-Based Allocation | `timeBasedAllocationEngine.js` | Gantt, future twin T+7/30/90 |

## API Base

`/api/v5/planning`

See [08-API-SPECIFICATIONS.md](./08-API-SPECIFICATIONS.md)
