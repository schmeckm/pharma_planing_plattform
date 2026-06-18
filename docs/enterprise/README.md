# Enterprise Platform Documentation

Pharmaceutical **Allocation & Production Sequencing Platform** — enterprise-grade architecture for GMP-compliant batch allocation and plant sequencing.

## Documents

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System context, allocation hierarchy, sequencing flow, line score, risk, audit, SAP layer |
| [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md) | Complete folder layout |
| [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md) | Phases 1–7 delivery status and future work |

## Key Engines

| Engine | File | Purpose |
|--------|------|---------|
| Historical Performance | `engines/historicalPerformanceEngine.js` | Line Score, OEE, throughput, reliability |
| Line Sequencing | `engines/lineSequencingEngine.js` | Gantt optimize, line recommendation |
| Allocation | `engines/allocationEngine.js` | Compliance-first hard allocation |
| Risk | `engines/riskEngine.js` | LOW/MEDIUM/HIGH with line reliability |
| Schedule Impact | `engines/scheduleImpactEngine.js` | What-if: OEE, capacity, compliance |
| Rule | `engines/ruleEngine.js` | 32-rule hierarchy evaluation |

## APIs

```
GET  /api/v1/planning/daily-orders
GET  /api/v1/planning/recommended-sequence
POST /api/v1/planning/what-if
POST /api/v1/planning/confirm-sequence
POST /api/v1/planning/simulate-batch-assignment
GET  /api/v1/planning/exceptions
GET  /api/v1/performance/line-scores
GET  /api/v1/performance/recommend-line
```

## Data Files

`historicalPerformance.json` · `roughPlannedOrders.json` · `productionLines.json` · `lineCalendars.json` · `optimizedSchedule.json`
